const { Router } = require('express');
const prisma = require('../lib/prisma');
const { getWeekOf, optionalDollarPerCompletion } = require('../lib/helpers');

const router = Router();

// ── Payout Records ────────────────��───────────────────────────────────────────

router.get('/payouts', async (req, res) => {
  const payouts = await prisma.payoutRecord.findMany({ orderBy: { timestamp: 'desc' } });
  res.json(payouts);
});

router.delete('/payouts/:id', async (req, res) => {
  const { id } = req.params;
  const result = await prisma.payoutRecord.deleteMany({ where: { id } });
  if (result.count === 0) return res.status(404).json({ error: 'Payout not found' });
  res.json({ deleted: result.count });
});

router.delete('/payouts', async (req, res) => {
  const { childId } = req.query;
  const where = childId ? { childId: String(childId) } : {};
  const result = await prisma.payoutRecord.deleteMany({ where });
  res.json({ deleted: result.count });
});

router.post('/payouts/:kidId', async (req, res) => {
  const { kidId } = req.params;
  const { customAmount } = req.body;
  const kid = await prisma.user.findUnique({ where: { id: kidId } });
  const approvedChores = await prisma.chore.findMany({
    where: { assignedTo: kidId, isApproved: true, isArchived: false },
  });

  const mandatoryAmount = approvedChores.reduce((sum, c) => {
    const n = c.completedDays.length;
    let earned = 0;
    if (n === 4) earned = c.baseValue * 0.8;
    else if (n >= 5 && n <= 6) earned = c.baseValue;
    else if (n === 7) earned = c.baseValue + 1;
    return sum + earned;
  }, 0);

  const weekOf = getWeekOf();
  const selections = await prisma.dailyChoreSelection.findMany({ where: { childId: kidId, weekOf } });
  const optionalAmount = selections.reduce((sum, s) => sum + optionalDollarPerCompletion(s.baseValue) * s.completions, 0);

  const calculatedAmount = mandatoryAmount + optionalAmount;
  const totalAmount = customAmount != null
    ? Math.min(Math.max(0.01, parseFloat(customAmount)), calculatedAmount)
    : calculatedAmount;

  const choreNames = [
    ...approvedChores.map(c => c.title),
    ...selections.filter(s => s.completions > 0).map(s => `${s.title} (optional ×${s.completions})`),
  ];

  const payout = await prisma.payoutRecord.create({
    data: {
      childId: kidId,
      childName: kid.name,
      amount: Math.round(totalAmount * 100) / 100,
      choresPaid: choreNames,
    },
  });

  await prisma.chore.updateMany({
    where: { id: { in: approvedChores.map(c => c.id) } },
    data: { completedDays: [], isApproved: false },
  });
  await prisma.dailyChoreSelection.deleteMany({ where: { childId: kidId, weekOf } });

  const updatedChores = await prisma.chore.findMany({ where: { isArchived: false } });
  res.json({ payout, updatedChores });
});

// ── Cash Payments ─────────────────────────────────────────────────────────────

router.get('/cash-payments', async (req, res) => {
  const { childId } = req.query;
  const where = childId ? { childId: String(childId) } : {};
  const payments = await prisma.cashPayment.findMany({ where, orderBy: { timestamp: 'desc' } });
  res.json(payments);
});

router.post('/cash-payments', async (req, res) => {
  const { childId, childName, amount, note } = req.body;
  if (!childId || !childName || amount == null) {
    return res.status(400).json({ error: 'childId, childName, and amount are required' });
  }
  const payment = await prisma.cashPayment.create({
    data: {
      childId,
      childName,
      amount: Math.round(parseFloat(amount) * 100) / 100,
      note: note || null,
    },
  });
  res.json(payment);
});

router.delete('/cash-payments/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.cashPayment.delete({ where: { id } });
  res.sendStatus(200);
});

// ── Cash-to-Points ────���───────────────────────────────────────────────────────

router.post('/cash-to-points', async (req, res) => {
  const { childId, childName, dollarAmount } = req.body;
  if (!childId || !childName || !dollarAmount) {
    return res.status(400).json({ error: 'childId, childName, and dollarAmount are required' });
  }
  const amount = Math.round(parseFloat(dollarAmount) * 100) / 100;
  if (amount < 0.50) return res.status(400).json({ error: 'Minimum conversion is $0.50' });

  const payouts = await prisma.payoutRecord.findMany({ where: { childId } });
  const payments = await prisma.cashPayment.findMany({ where: { childId } });
  const totalEarned = payouts.reduce((s, p) => s + p.amount, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const owed = Math.round((totalEarned - totalPaid) * 100) / 100;
  if (amount > owed + 0.001) {
    return res.status(400).json({ error: `Only $${owed.toFixed(2)} is owed` });
  }

  const points = Math.round(amount * 100);

  const cashPayment = await prisma.cashPayment.create({
    data: { childId, childName, amount, note: `Converted to ${points} pts` },
  });
  const ledgerEntry = await prisma.pointLedger.create({
    data: { childId, amount: points, reason: `Cash converted to points: $${amount.toFixed(2)}` },
  });

  res.json({ cashPayment, ledgerEntry, points, dollarAmount: amount });
});

module.exports = router;
