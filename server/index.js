const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const bcrypt = require('bcrypt');
const cron = require('node-cron');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const DEFAULT_PARENT_USERNAME = 'parent';
const DEFAULT_PARENT_PASSWORD = 'changeme';

// ── Points helper ─────────────────────────────────────────────────────────────
// 10 pt base for all chores + Math.round(baseValue * 4) scaled on top
function chorePointsPerDay(baseValue) {
  return 10 + Math.round(baseValue * 4);
}

// ── Notification helpers ──────────────────────────────────────────────────────
async function getNotifSettings() {
  return prisma.notificationSettings.findUnique({ where: { id: 'singleton' } });
}

async function sendPushover(title, message) {
  try {
    const ns = await getNotifSettings();
    if (!ns || !ns.pushoverEnabled || !ns.pushoverAppToken || !ns.pushoverUserKey) return;
    await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: ns.pushoverAppToken,
        user: ns.pushoverUserKey,
        title,
        message,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.error('[pushover] send error:', err.message);
  }
}

async function sendEmail(subject, htmlBody) {
  try {
    const ns = await getNotifSettings();
    if (!ns || !ns.smtpEnabled || !ns.smtpHost || !ns.smtpUser || !ns.smtpFrom) return;
    const transporter = nodemailer.createTransport({
      host: ns.smtpHost,
      port: ns.smtpPort || 587,
      secure: (ns.smtpPort || 587) === 465,
      auth: { user: ns.smtpUser, pass: ns.smtpPassword },
    });
    await transporter.sendMail({
      from: ns.smtpFrom,
      to: ns.smtpFrom,
      subject,
      html: htmlBody,
    });
  } catch (err) {
    console.error('[email] send error:', err.message);
  }
}

async function notify(event, title, message, htmlBody) {
  const ns = await getNotifSettings();
  if (!ns) return;
  const eventMap = {
    choreComplete: ns.notifyChoreComplete,
    streakBonus: ns.notifyStreakBonus,
    rewardRequest: ns.notifyRewardRequest,
    rewardIdea: ns.notifyRewardIdea,
    weeklyReset: ns.notifyWeeklyReset,
    rewardApproved: ns.notifyRewardApproved,
  };
  if (!eventMap[event]) return;
  await Promise.all([
    sendPushover(title, message),
    sendEmail(title, htmlBody || `<p>${message}</p>`),
  ]);
}

// ── Startup: init parent + seed rewards ───────────────────────────────────────
async function initParent() {
  const existing = await prisma.parent.findFirst();
  if (!existing) {
    const hashedPassword = await bcrypt.hash(
      process.env.PARENT_PASSWORD || DEFAULT_PARENT_PASSWORD,
      10,
    );
    await prisma.parent.create({
      data: {
        username: process.env.PARENT_USERNAME || DEFAULT_PARENT_USERNAME,
        password: hashedPassword,
        hasChanged: false,
      },
    });
    console.log('Parent credentials initialized');
  }
}

const DEFAULT_REWARDS = [
  { title: '30 min Video Game Time', description: 'Enjoy 30 minutes of your favorite video game', icon: '🎮', pointCost: 50, sortOrder: 0 },
  { title: 'Extra TV Episode', description: 'Watch one extra TV show episode', icon: '📺', pointCost: 40, sortOrder: 1 },
  { title: 'Stay Up 30 Min Later', description: 'Bedtime extended by 30 minutes tonight', icon: '🌙', pointCost: 60, sortOrder: 2 },
  { title: 'Pick Dinner Tonight', description: 'You choose what the family has for dinner', icon: '🍕', pointCost: 80, sortOrder: 3 },
  { title: 'Movie Night Pick', description: 'You choose the movie for family movie night', icon: '🎬', pointCost: 100, sortOrder: 4 },
  { title: 'Small Treat at Store', description: 'Pick a small treat next time we go shopping', icon: '🛒', pointCost: 120, sortOrder: 5 },
];

async function seedRewards() {
  const count = await prisma.rewardTemplate.count();
  if (count === 0) {
    await prisma.rewardTemplate.createMany({ data: DEFAULT_REWARDS });
    console.log('Default rewards seeded');
  }
}

initParent().catch(console.error);
seedRewards().catch(console.error);

// ── Kids Endpoints ────────────────────────────────────────────────────────────

app.get('/api/kids', async (req, res) => {
  const kids = await prisma.user.findMany({ where: { role: 'child' } });
  res.json(kids);
});

app.post('/api/kids', async (req, res) => {
  const { name } = req.body;
  const kid = await prisma.user.create({ data: { name, role: 'child' } });
  res.json(kid);
});

app.delete('/api/kids/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.user.delete({ where: { id } });
  res.sendStatus(200);
});

// ── Template Endpoints ────────────────────────────────────────────────────────

app.get('/api/templates', async (req, res) => {
  const templates = await prisma.choreTemplate.findMany();
  res.json(templates);
});

app.post('/api/templates', async (req, res) => {
  const { title, baseValue, isMandatory } = req.body;
  const template = await prisma.choreTemplate.create({
    data: { title, baseValue, isMandatory: isMandatory || false },
  });
  res.json(template);
});

app.delete('/api/templates/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.choreTemplate.delete({ where: { id } });
  res.sendStatus(200);
});

app.post('/api/templates/:id/toggle-mandatory', async (req, res) => {
  const { id } = req.params;
  const template = await prisma.choreTemplate.findUnique({ where: { id } });
  const updated = await prisma.choreTemplate.update({
    where: { id },
    data: { isMandatory: !template.isMandatory },
  });
  await prisma.chore.updateMany({
    where: { templateId: id, isArchived: false },
    data: { isMandatory: !template.isMandatory },
  });
  const templates = await prisma.choreTemplate.findMany();
  const chores = await prisma.chore.findMany({ where: { isArchived: false } });
  res.json({ templates, chores });
});

// ── Chore Endpoints ───────────────────────────────────────────────────────────

app.get('/api/chores', async (req, res) => {
  const chores = await prisma.chore.findMany({ where: { isArchived: false } });
  res.json(chores);
});

app.post('/api/chores/assign', async (req, res) => {
  const { templateId, kidIds } = req.body;
  const template = await prisma.choreTemplate.findUnique({ where: { id: templateId } });
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const newChores = [];
  for (const kidId of kidIds) {
    const existing = await prisma.chore.findFirst({
      where: { templateId, assignedTo: kidId, isArchived: false },
    });
    if (existing) continue;
    const chore = await prisma.chore.create({
      data: {
        title: template.title,
        baseValue: template.baseValue,
        isMandatory: template.isMandatory || false,
        templateId: template.id,
        assignedTo: kidId,
        completedDays: [],
        isApproved: false,
        isArchived: false,
      },
    });
    newChores.push(chore);
  }
  res.json(newChores);
});

// Toggle a day — awards/deducts points and fires notifications
app.post('/api/chores/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const { day } = req.body;
  const chore = await prisma.chore.findUnique({ where: { id } });
  if (!chore) return res.status(404).json({ error: 'Chore not found' });

  let newDays = [...chore.completedDays];
  const wasCompleted = newDays.includes(day);
  if (wasCompleted) {
    newDays = newDays.filter(d => d !== day);
  } else {
    newDays.push(day);
  }

  const updated = await prisma.chore.update({
    where: { id },
    data: {
      completedDays: newDays,
      isApproved: newDays.length < 4 ? false : chore.isApproved,
    },
  });

  const ptsPerDay = chorePointsPerDay(chore.baseValue);

  if (!wasCompleted) {
    // Award points for completing this day
    await prisma.pointLedger.create({
      data: {
        childId: chore.assignedTo,
        amount: ptsPerDay,
        reason: `Completed: ${chore.title} (${day})`,
        choreId: chore.id,
      },
    });

    // 7-day streak bonus
    if (newDays.length === 7) {
      const bonus = Math.round(ptsPerDay * 0.25);
      await prisma.pointLedger.create({
        data: {
          childId: chore.assignedTo,
          amount: bonus,
          reason: `7-day streak bonus: ${chore.title}`,
          choreId: chore.id,
        },
      });
      // Fire streak notification
      const kid = await prisma.user.findUnique({ where: { id: chore.assignedTo } });
      notify(
        'streakBonus',
        `🔥 ${kid?.name} hit a 7-day streak!`,
        `${kid?.name} completed "${chore.title}" all 7 days — streak bonus of ${bonus} pts awarded!`,
        `<p>🔥 <strong>${kid?.name}</strong> completed <em>${chore.title}</em> all 7 days this week!</p><p>Streak bonus: <strong>+${bonus} pts</strong></p>`,
      ).catch(() => {});
    } else {
      // Regular completion notification
      const kid = await prisma.user.findUnique({ where: { id: chore.assignedTo } });
      notify(
        'choreComplete',
        `⭐ ${kid?.name} earned points!`,
        `${kid?.name} completed "${chore.title}" and earned ${ptsPerDay} pts`,
        `<p>⭐ <strong>${kid?.name}</strong> completed <em>${chore.title}</em> on ${day} and earned <strong>+${ptsPerDay} pts</strong>.</p>`,
      ).catch(() => {});
    }
  } else {
    // Deduct points for un-toggling
    await prisma.pointLedger.create({
      data: {
        childId: chore.assignedTo,
        amount: -ptsPerDay,
        reason: `Unchecked: ${chore.title} (${day})`,
        choreId: chore.id,
      },
    });
    // If we're removing the 7th day, also remove the streak bonus
    if (chore.completedDays.length === 7) {
      const bonus = Math.round(ptsPerDay * 0.25);
      await prisma.pointLedger.create({
        data: {
          childId: chore.assignedTo,
          amount: -bonus,
          reason: `Streak bonus reversed: ${chore.title}`,
          choreId: chore.id,
        },
      });
    }
  }

  res.json(updated);
});

app.post('/api/chores/:id/approve', async (req, res) => {
  const { id } = req.params;
  const chore = await prisma.chore.findUnique({ where: { id } });
  const updated = await prisma.chore.update({
    where: { id },
    data: { isApproved: !chore.isApproved },
  });
  res.json(updated);
});

app.post('/api/chores/reset', async (req, res) => {
  try {
    // 1. Compute each kid's current balance before we clear completedDays
    const chores = await prisma.chore.findMany({ where: { isArchived: false } });
    const kids = await prisma.user.findMany({ where: { role: 'child' } });

    const weeklyEarned = {};
    for (const chore of chores) {
      const ptsPerDay = chorePointsPerDay(chore.baseValue);
      const earned = ptsPerDay * chore.completedDays.length;
      const streak = chore.completedDays.length === 7 ? Math.round(ptsPerDay * 0.25) : 0;
      weeklyEarned[chore.assignedTo] = (weeklyEarned[chore.assignedTo] || 0) + earned + streak;
    }

    // Apply existing ledger adjustments (previous carry-forwards and redemptions)
    const existingLedger = await prisma.pointLedger.findMany();
    const ledgerAdj = {};
    for (const e of existingLedger) {
      if (isChoreEntry(e.reason)) continue;
      ledgerAdj[e.childId] = (ledgerAdj[e.childId] || 0) + e.amount;
    }

    // 2. Create a carry-forward ledger entry for each kid with their net balance
    const today = new Date().toISOString().split('T')[0];
    for (const kid of kids) {
      const balance = Math.max(0, (weeklyEarned[kid.id] || 0) + (ledgerAdj[kid.id] || 0));
      // Remove old non-chore ledger entries for this kid (they're baked into balance now)
      await prisma.pointLedger.deleteMany({
        where: { childId: kid.id, NOT: [{ reason: { startsWith: 'Completed:' } }, { reason: { startsWith: 'Unchecked:' } }, { reason: { startsWith: '7-day streak bonus:' } }, { reason: { startsWith: 'Streak bonus reversed:' } }] },
      });
      if (balance > 0) {
        await prisma.pointLedger.create({
          data: { childId: kid.id, amount: balance, reason: `Week carry-forward: ${today}` },
        });
      }
    }

    // 3. Clear completedDays and approval for the new week
    await prisma.chore.updateMany({
      where: { isArchived: false },
      data: { completedDays: [], isApproved: false },
    });

    const allActive = await prisma.chore.findMany({ where: { isArchived: false } });
    res.json(allActive);
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ error: 'Reset failed' });
  }
});

app.post('/api/chores/approve-all', async (req, res) => {
  const candidates = await prisma.chore.findMany({
    where: { isArchived: false, isApproved: false },
  });
  const eligibleIds = candidates.filter(c => c.completedDays.length >= 4).map(c => c.id);
  if (eligibleIds.length > 0) {
    await prisma.chore.updateMany({
      where: { id: { in: eligibleIds } },
      data: { isApproved: true },
    });
  }
  const allActive = await prisma.chore.findMany({ where: { isArchived: false } });
  res.json({ updatedCount: eligibleIds.length, chores: allActive });
});

app.post('/api/chores/unassign', async (req, res) => {
  const { templateId, kidIds } = req.body;
  if (!templateId || !Array.isArray(kidIds) || kidIds.length === 0) {
    return res.status(400).json({ error: 'templateId and kidIds are required' });
  }
  const result = await prisma.chore.updateMany({
    where: { templateId, assignedTo: { in: kidIds }, isArchived: false },
    data: { isArchived: true },
  });
  const remaining = await prisma.chore.findMany({ where: { isArchived: false } });
  res.json({ removedCount: result.count, remaining });
});

// ── Payout Endpoints ──────────────────────────────────────────────────────────

app.get('/api/payouts', async (req, res) => {
  const payouts = await prisma.payoutRecord.findMany({ orderBy: { timestamp: 'desc' } });
  res.json(payouts);
});

app.delete('/api/payouts/:id', async (req, res) => {
  const { id } = req.params;
  const result = await prisma.payoutRecord.deleteMany({ where: { id } });
  if (result.count === 0) return res.status(404).json({ error: 'Payout not found' });
  res.json({ deleted: result.count });
});

app.delete('/api/payouts', async (req, res) => {
  const { childId } = req.query;
  const where = childId ? { childId: String(childId) } : {};
  const result = await prisma.payoutRecord.deleteMany({ where });
  res.json({ deleted: result.count });
});

app.post('/api/payouts/:kidId', async (req, res) => {
  const { kidId } = req.params;
  const kid = await prisma.user.findUnique({ where: { id: kidId } });
  const approvedChores = await prisma.chore.findMany({
    where: { assignedTo: kidId, isApproved: true, isArchived: false },
  });

  const totalAmount = approvedChores.reduce((sum, c) => {
    const n = c.completedDays.length;
    let earned = 0;
    if (n === 4) earned = c.baseValue * 0.8;
    else if (n >= 5 && n <= 6) earned = c.baseValue;
    else if (n === 7) earned = c.baseValue + 1;
    return sum + earned;
  }, 0);

  const payout = await prisma.payoutRecord.create({
    data: {
      childId: kidId,
      childName: kid.name,
      amount: Math.round(totalAmount * 100) / 100,
      choresPaid: approvedChores.map(c => c.title),
    },
  });

  await prisma.chore.updateMany({
    where: { id: { in: approvedChores.map(c => c.id) } },
    data: { completedDays: [], isApproved: false },
  });

  const updatedChores = await prisma.chore.findMany({ where: { isArchived: false } });
  res.json({ payout, updatedChores });
});

// ── Cash Payment Endpoints ────────────────────────────────────────────────────

app.get('/api/cash-payments', async (req, res) => {
  const { childId } = req.query;
  const where = childId ? { childId: String(childId) } : {};
  const payments = await prisma.cashPayment.findMany({ where, orderBy: { timestamp: 'desc' } });
  res.json(payments);
});

app.post('/api/cash-payments', async (req, res) => {
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

app.delete('/api/cash-payments/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.cashPayment.delete({ where: { id } });
  res.sendStatus(200);
});

// Convert cash owed → points (kid-initiated)
// $0.50 = 50 pts, i.e. $1 = 100 pts
app.post('/api/cash-to-points', async (req, res) => {
  const { childId, childName, dollarAmount } = req.body;
  if (!childId || !childName || !dollarAmount) {
    return res.status(400).json({ error: 'childId, childName, and dollarAmount are required' });
  }
  const amount = Math.round(parseFloat(dollarAmount) * 100) / 100;
  if (amount < 0.50) return res.status(400).json({ error: 'Minimum conversion is $0.50' });

  // Verify the kid actually has enough money owed
  const payouts = await prisma.payoutRecord.findMany({ where: { childId } });
  const payments = await prisma.cashPayment.findMany({ where: { childId } });
  const totalEarned = payouts.reduce((s, p) => s + p.amount, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const owed = Math.round((totalEarned - totalPaid) * 100) / 100;
  if (amount > owed + 0.001) {
    return res.status(400).json({ error: `Only $${owed.toFixed(2)} is owed` });
  }

  const points = Math.round(amount * 100); // $1 = 100 pts

  // Mark the cash as "received" (converted to points instead of handed over)
  const cashPayment = await prisma.cashPayment.create({
    data: {
      childId,
      childName,
      amount,
      note: `Converted to ${points} pts`,
    },
  });

  // Award the points via the ledger
  const ledgerEntry = await prisma.pointLedger.create({
    data: {
      childId,
      amount: points,
      reason: `Cash converted to points: $${amount.toFixed(2)}`,
    },
  });

  res.json({ cashPayment, ledgerEntry, points, dollarAmount: amount });
});

// ── Rewards Endpoints ─────────────────────────────────────────────────────────

app.get('/api/rewards', async (req, res) => {
  const rewards = await prisma.rewardTemplate.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(rewards);
});

app.post('/api/rewards', async (req, res) => {
  const { title, description, pointCost, icon } = req.body;
  if (!title || !pointCost) return res.status(400).json({ error: 'title and pointCost required' });
  const count = await prisma.rewardTemplate.count();
  const reward = await prisma.rewardTemplate.create({
    data: { title, description: description || null, pointCost: parseInt(pointCost), icon: icon || null, isCustom: true, sortOrder: count },
  });
  res.json(reward);
});

app.put('/api/rewards/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, pointCost, isActive, icon, sortOrder } = req.body;
  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (pointCost !== undefined) data.pointCost = parseInt(pointCost);
  if (isActive !== undefined) data.isActive = isActive;
  if (icon !== undefined) data.icon = icon;
  if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder);
  const reward = await prisma.rewardTemplate.update({ where: { id }, data });
  res.json(reward);
});

app.delete('/api/rewards/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.rewardTemplate.delete({ where: { id } });
  res.sendStatus(200);
});

// ── Points Endpoints ──────────────────────────────────────────────────────────

// Labels for ledger entries that come from chore toggle events.
// These are intentionally excluded from the balance sum because
// completedDays is the authoritative source for current-week earnings.
const CHORE_ENTRY_PREFIXES = ['Completed:', 'Unchecked:', '7-day streak bonus:', 'Streak bonus reversed:'];
function isChoreEntry(reason) {
  return CHORE_ENTRY_PREFIXES.some(p => reason.startsWith(p));
}

// Get point balances for all kids.
// Balance = (current week earned from completedDays) + (ledger adjustments:
//   carry-forward from prior weeks, minus redemptions). Chore completion ledger
//   entries are ignored here — completedDays is always the accurate source.
app.get('/api/points/balance', async (req, res) => {
  try {
    // 1. Earned this week — computed from completedDays (matches the chart exactly)
    const chores = await prisma.chore.findMany({ where: { isArchived: false } });
    const balances = {};
    for (const chore of chores) {
      const ptsPerDay = chorePointsPerDay(chore.baseValue);
      const earned = ptsPerDay * chore.completedDays.length;
      const streak = chore.completedDays.length === 7 ? Math.round(ptsPerDay * 0.25) : 0;
      balances[chore.assignedTo] = (balances[chore.assignedTo] || 0) + earned + streak;
    }

    // 2. Apply carry-forward (from prior week resets) and redemptions from ledger.
    //    Skip chore-toggle entries — they're accounted for by completedDays above.
    const ledger = await prisma.pointLedger.findMany();
    for (const e of ledger) {
      if (isChoreEntry(e.reason)) continue;
      balances[e.childId] = (balances[e.childId] || 0) + e.amount;
    }

    // Floor at 0
    for (const id of Object.keys(balances)) {
      if (balances[id] < 0) balances[id] = 0;
    }

    res.json(balances);
  } catch (err) {
    console.error('Balance error:', err);
    res.status(500).json({ error: 'Failed to compute balances' });
  }
});

// Get full ledger for one kid
app.get('/api/points/ledger/:childId', async (req, res) => {
  const { childId } = req.params;
  const entries = await prisma.pointLedger.findMany({
    where: { childId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(entries);
});

// Get all point ledger entries (for bootstrap)
app.get('/api/points/ledger', async (req, res) => {
  const entries = await prisma.pointLedger.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(entries);
});

// Get all redemptions
app.get('/api/points/redemptions', async (req, res) => {
  const redemptions = await prisma.rewardRedemption.findMany({ orderBy: { timestamp: 'desc' } });
  res.json(redemptions);
});

// Parent redeems a reward for a kid
app.post('/api/points/redeem', async (req, res) => {
  const { childId, rewardTemplateId } = req.body;
  if (!childId || !rewardTemplateId) return res.status(400).json({ error: 'childId and rewardTemplateId required' });

  const kid = await prisma.user.findUnique({ where: { id: childId } });
  const reward = await prisma.rewardTemplate.findUnique({ where: { id: rewardTemplateId } });
  if (!kid || !reward) return res.status(404).json({ error: 'Kid or reward not found' });

  // Check balance
  const ledger = await prisma.pointLedger.findMany({ where: { childId } });
  const balance = ledger.reduce((s, e) => s + e.amount, 0);
  if (balance < reward.pointCost) return res.status(400).json({ error: 'Insufficient points' });

  // Deduct points
  await prisma.pointLedger.create({
    data: {
      childId,
      amount: -reward.pointCost,
      reason: `Redeemed: ${reward.title}`,
    },
  });

  const redemption = await prisma.rewardRedemption.create({
    data: {
      childId,
      childName: kid.name,
      rewardTemplateId,
      rewardTitle: reward.title,
      pointCost: reward.pointCost,
    },
  });

  notify(
    'rewardApproved',
    `🎁 ${kid.name} redeemed a reward!`,
    `${kid.name} redeemed "${reward.title}" for ${reward.pointCost} pts`,
    `<p>🎁 <strong>${kid.name}</strong> redeemed <em>${reward.title}</em> for <strong>${reward.pointCost} pts</strong>.</p>`,
  ).catch(() => {});

  res.json(redemption);
});

// Delete a redemption and refund points
app.delete('/api/points/redemptions/:id', async (req, res) => {
  const { id } = req.params;
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id } });
  if (!redemption) return res.status(404).json({ error: 'Redemption not found' });

  await prisma.pointLedger.create({
    data: {
      childId: redemption.childId,
      amount: redemption.pointCost,
      reason: `Refund: ${redemption.rewardTitle}`,
    },
  });

  await prisma.rewardRedemption.delete({ where: { id } });
  res.json({ refunded: redemption.pointCost });
});

// ── Redemption Requests (kid asks parent) ─────────────────────────────────────

app.get('/api/redemption-requests', async (req, res) => {
  const requests = await prisma.redemptionRequest.findMany({ orderBy: { timestamp: 'desc' } });
  res.json(requests);
});

app.post('/api/redemption-requests', async (req, res) => {
  const { childId, childName, rewardTemplateId } = req.body;
  if (!childId || !rewardTemplateId) return res.status(400).json({ error: 'childId and rewardTemplateId required' });

  // Check balance first
  const ledger = await prisma.pointLedger.findMany({ where: { childId } });
  const balance = ledger.reduce((s, e) => s + e.amount, 0);
  const reward = await prisma.rewardTemplate.findUnique({ where: { id: rewardTemplateId } });
  if (!reward) return res.status(404).json({ error: 'Reward not found' });
  if (balance < reward.pointCost) return res.status(400).json({ error: 'Insufficient points' });

  // Cancel any existing pending request for same kid+reward
  await prisma.redemptionRequest.updateMany({
    where: { childId, rewardTemplateId, status: 'pending' },
    data: { status: 'cancelled' },
  });

  const request = await prisma.redemptionRequest.create({
    data: {
      childId,
      childName: childName || 'Unknown',
      rewardTemplateId,
      rewardTitle: reward.title,
      pointCost: reward.pointCost,
    },
  });

  notify(
    'rewardRequest',
    `🎁 ${childName} wants a reward`,
    `${childName} wants to redeem "${reward.title}" (${reward.pointCost} pts). Open the app to approve.`,
    `<p>🎁 <strong>${childName}</strong> wants to redeem <em>${reward.title}</em> (<strong>${reward.pointCost} pts</strong>).</p><p>Open the parent portal to approve.</p>`,
  ).catch(() => {});

  res.json(request);
});

app.put('/api/redemption-requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  const request = await prisma.redemptionRequest.findUnique({ where: { id } });
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const kid = await prisma.user.findUnique({ where: { id: request.childId } });
  const reward = await prisma.rewardTemplate.findUnique({ where: { id: request.rewardTemplateId } });

  // Check balance
  const ledger = await prisma.pointLedger.findMany({ where: { childId: request.childId } });
  const balance = ledger.reduce((s, e) => s + e.amount, 0);
  if (balance < request.pointCost) return res.status(400).json({ error: 'Insufficient points' });

  // Deduct + log redemption
  await prisma.pointLedger.create({
    data: { childId: request.childId, amount: -request.pointCost, reason: `Redeemed: ${request.rewardTitle}` },
  });
  const redemption = await prisma.rewardRedemption.create({
    data: {
      childId: request.childId,
      childName: request.childName,
      rewardTemplateId: request.rewardTemplateId,
      rewardTitle: request.rewardTitle,
      pointCost: request.pointCost,
    },
  });

  await prisma.redemptionRequest.update({ where: { id }, data: { status: 'approved' } });
  res.json({ redemption });
});

app.put('/api/redemption-requests/:id/reject', async (req, res) => {
  const { id } = req.params;
  await prisma.redemptionRequest.update({ where: { id }, data: { status: 'rejected' } });
  res.json({ ok: true });
});

// ── Reward Requests (kid suggests a reward idea) ──────────────────────────────

app.get('/api/reward-requests', async (req, res) => {
  const requests = await prisma.rewardRequest.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(requests);
});

app.post('/api/reward-requests', async (req, res) => {
  const { childId, childName, title, description } = req.body;
  if (!childId || !title) return res.status(400).json({ error: 'childId and title required' });

  const request = await prisma.rewardRequest.create({
    data: { childId, childName: childName || 'Unknown', title, description: description || null },
  });

  notify(
    'rewardIdea',
    `💡 New reward idea from ${childName}`,
    `${childName} suggested: "${title}" — review it in the parent portal.`,
    `<p>💡 <strong>${childName}</strong> suggested a new reward: <em>${title}</em></p>${description ? `<p>${description}</p>` : ''}<p>Review and approve it in the parent portal.</p>`,
  ).catch(() => {});

  res.json(request);
});

app.put('/api/reward-requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { pointCost } = req.body;
  if (!pointCost) return res.status(400).json({ error: 'pointCost required' });

  const request = await prisma.rewardRequest.update({
    where: { id },
    data: { status: 'approved', pointCost: parseInt(pointCost) },
  });

  const count = await prisma.rewardTemplate.count();
  const reward = await prisma.rewardTemplate.create({
    data: {
      title: request.title,
      description: request.description,
      pointCost: request.pointCost,
      isCustom: true,
      sortOrder: count,
    },
  });

  res.json({ request, reward });
});

app.put('/api/reward-requests/:id/reject', async (req, res) => {
  const { id } = req.params;
  await prisma.rewardRequest.update({ where: { id }, data: { status: 'rejected' } });
  res.json({ ok: true });
});

// ── Notification Settings ─────────────────────────────────────────────────────

app.get('/api/notifications/settings', async (req, res) => {
  const ns = await prisma.notificationSettings.findUnique({ where: { id: 'singleton' } });
  if (!ns) return res.json({
    pushoverAppToken: '', pushoverUserKey: '', pushoverEnabled: false,
    smtpHost: '', smtpPort: 587, smtpUser: '', smtpFrom: '', smtpEnabled: false,
    notifyChoreComplete: true, notifyStreakBonus: true, notifyRewardRequest: true,
    notifyRewardIdea: true, notifyWeeklyReset: true, notifyRewardApproved: true,
    pushoverTokenSet: false, smtpPasswordSet: false,
  });
  res.json({
    ...ns,
    pushoverAppToken: ns.pushoverAppToken ? '●●●● saved' : '',
    pushoverTokenSet: !!ns.pushoverAppToken,
    smtpPassword: ns.smtpPassword ? '●●●● saved' : '',
    smtpPasswordSet: !!ns.smtpPassword,
  });
});

app.put('/api/notifications/settings', async (req, res) => {
  const { currentPassword, ...fields } = req.body;

  // Verify parent password
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent found.' });
  const isValid = await bcrypt.compare(currentPassword, parent.password);
  if (!isValid) return res.status(403).json({ error: 'Current password is incorrect.' });

  const data = {};
  const allowed = [
    'pushoverEnabled', 'smtpEnabled', 'smtpHost', 'smtpPort', 'smtpUser', 'smtpFrom',
    'notifyChoreComplete', 'notifyStreakBonus', 'notifyRewardRequest',
    'notifyRewardIdea', 'notifyWeeklyReset', 'notifyRewardApproved',
  ];
  for (const key of allowed) {
    if (fields[key] !== undefined) data[key] = fields[key];
  }
  if (fields.pushoverAppToken?.trim()) data.pushoverAppToken = fields.pushoverAppToken.trim();
  if (fields.pushoverUserKey?.trim()) data.pushoverUserKey = fields.pushoverUserKey.trim();
  if (fields.smtpPassword?.trim()) data.smtpPassword = fields.smtpPassword.trim();

  const ns = await prisma.notificationSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  });
  res.json({ ok: true });
});

app.post('/api/notifications/test-pushover', async (req, res) => {
  const { currentPassword } = req.body;
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent found.' });
  const isValid = await bcrypt.compare(currentPassword, parent.password);
  if (!isValid) return res.status(403).json({ error: 'Current password is incorrect.' });

  try {
    const ns = await getNotifSettings();
    if (!ns?.pushoverAppToken || !ns?.pushoverUserKey) {
      return res.status(400).json({ error: 'Pushover not configured.' });
    }
    const r = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: ns.pushoverAppToken,
        user: ns.pushoverUserKey,
        title: '🧪 Chore App Test',
        message: 'Pushover notifications are working!',
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    if (data.status === 1) return res.json({ ok: true });
    return res.status(400).json({ error: data.errors?.join(', ') || 'Pushover error' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/test-email', async (req, res) => {
  const { currentPassword } = req.body;
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent found.' });
  const isValid = await bcrypt.compare(currentPassword, parent.password);
  if (!isValid) return res.status(403).json({ error: 'Current password is incorrect.' });

  try {
    const ns = await getNotifSettings();
    if (!ns?.smtpHost || !ns?.smtpUser || !ns?.smtpFrom) {
      return res.status(400).json({ error: 'SMTP not configured.' });
    }
    const transporter = nodemailer.createTransport({
      host: ns.smtpHost,
      port: ns.smtpPort || 587,
      secure: (ns.smtpPort || 587) === 465,
      auth: { user: ns.smtpUser, pass: ns.smtpPassword },
    });
    await transporter.sendMail({
      from: ns.smtpFrom,
      to: ns.smtpFrom,
      subject: '🧪 Chore App Test Email',
      html: '<p>Email notifications are working!</p>',
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── OIDC OAuth helpers ────────────────────────────────────────────────────────

let _oidcCache = null, _oidcCacheExpiry = 0;
async function discoverOidc(issuer) {
  if (_oidcCache && Date.now() < _oidcCacheExpiry) return _oidcCache;
  const url = issuer.includes('openid-configuration') ? issuer : `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  _oidcCache = await res.json();
  _oidcCacheExpiry = Date.now() + 3600_000;
  return _oidcCache;
}

const _oauthStates = new Map();
setInterval(() => { const now = Date.now(); for (const [k, v] of _oauthStates) if (v < now) _oauthStates.delete(k); }, 600_000);

function getAppUrl(req) {
  const cfg = process.env.APP_URL; if (cfg) return cfg.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers['host'] || 'localhost:8080'}`;
}

// ── Parent Endpoints ──────────────────────────────────────────────────────────

app.get('/api/parent/status', async (req, res) => {
  const parent = await prisma.parent.findFirst();
  res.json({ hasChanged: parent?.hasChanged ?? false });
});

app.get('/api/parent/oauth/login', async (req, res) => {
  const parent = await prisma.parent.findFirst();
  const issuer = parent?.oauthIssuer, clientId = parent?.oauthClientId;
  if (!issuer || !clientId) return res.redirect(`${getAppUrl(req)}/?oauth_error=${encodeURIComponent('OAuth is not configured. Set it up in the parent portal.')}`);
  try {
    const oidc = await discoverOidc(issuer);
    const state = crypto.randomBytes(32).toString('hex');
    _oauthStates.set(state, Date.now() + 600_000);
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: `${getAppUrl(req)}/api/parent/oauth/callback`, response_type: 'code', scope: 'openid email profile', state });
    res.redirect(`${oidc.authorization_endpoint}?${params}`);
  } catch (err) {
    console.error('[oauth] login:', err.message);
    res.redirect(`${getAppUrl(req)}/?oauth_error=${encodeURIComponent('Could not reach OAuth provider.')}`);
  }
});

app.get('/api/parent/oauth/callback', async (req, res) => {
  const appUrl = getAppUrl(req);
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent(`OAuth error: ${error}`)}`);
  if (!code || !state || !_oauthStates.has(state)) return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent('Invalid or expired OAuth state.')}`);
  _oauthStates.delete(state);
  const parent = await prisma.parent.findFirst();
  const { oauthIssuer: issuer, oauthClientId: clientId, oauthClientSecret: clientSecret } = parent || {};
  if (!issuer || !clientId || !clientSecret) return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent('OAuth not configured.')}`);
  try {
    const oidc = await discoverOidc(issuer);
    const redirectUri = `${appUrl}/api/parent/oauth/callback`;
    const tokenRes = await fetch(oidc.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }), signal: AbortSignal.timeout(10000) });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
    const tokens = await tokenRes.json();
    let email = null;
    if (tokens.id_token) { const p = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString()); email = p.email; }
    if (!email && tokens.access_token && oidc.userinfo_endpoint) {
      const ui = await fetch(oidc.userinfo_endpoint, { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(5000) });
      if (ui.ok) email = (await ui.json()).email;
    }
    if (!email) return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent('OAuth provider did not return an email.')}`);
    const allowed = (parent.allowedEmails || []).map(e => e.toLowerCase());
    if (!allowed.includes(email.toLowerCase())) {
      return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent(`${email} is not authorized as a parent.`)}`);
    }
    res.redirect(`${appUrl}/?parent_authed=1`);
  } catch (err) {
    console.error('[oauth] callback:', err.message);
    res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent(`OAuth login failed: ${err.message}`)}`);
  }
});

app.get('/api/parent/oauth/settings', async (req, res) => {
  const parent = await prisma.parent.findFirst();
  res.json({ oauthIssuer: parent?.oauthIssuer || '', oauthClientId: parent?.oauthClientId || '', oauthClientSecretSet: !!(parent?.oauthClientSecret), allowedEmails: parent?.allowedEmails || [] });
});

app.post('/api/parent/oauth/settings', async (req, res) => {
  const { currentPassword, oauthIssuer, oauthClientId, oauthClientSecret } = req.body;
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent found.' });
  const isValid = await bcrypt.compare(currentPassword, parent.password);
  if (!isValid) return res.status(403).json({ error: 'Current password is incorrect.' });
  const data = {};
  if (oauthIssuer !== undefined) data.oauthIssuer = oauthIssuer.trim() || null;
  if (oauthClientId !== undefined) data.oauthClientId = oauthClientId.trim() || null;
  if (oauthClientSecret?.trim()) data.oauthClientSecret = oauthClientSecret.trim();
  await prisma.parent.update({ where: { id: parent.id }, data });
  _oidcCache = null;
  res.json({ success: true });
});

app.get('/api/parent/cf-emails', async (req, res) => {
  const parent = await prisma.parent.findFirst();
  res.json({ emails: parent?.allowedEmails || [] });
});

app.post('/api/parent/cf-emails', async (req, res) => {
  const { email, currentPassword } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email.' });
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent found.' });
  const isValid = await bcrypt.compare(currentPassword, parent.password);
  if (!isValid) return res.status(403).json({ error: 'Current password is incorrect.' });
  const normalized = email.trim().toLowerCase();
  if (parent.allowedEmails.map(e => e.toLowerCase()).includes(normalized)) return res.json({ emails: parent.allowedEmails });
  const updated = await prisma.parent.update({ where: { id: parent.id }, data: { allowedEmails: { push: email.trim() } } });
  res.json({ emails: updated.allowedEmails });
});

app.delete('/api/parent/cf-emails/:email', async (req, res) => {
  const { email } = req.params;
  const { currentPassword } = req.body;
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent found.' });
  const isValid = await bcrypt.compare(currentPassword, parent.password);
  if (!isValid) return res.status(403).json({ error: 'Current password is incorrect.' });
  const updated = await prisma.parent.update({ where: { id: parent.id }, data: { allowedEmails: parent.allowedEmails.filter(e => e.toLowerCase() !== email.toLowerCase()) } });
  res.json({ emails: updated.allowedEmails });
});

app.post('/api/parent/login', async (req, res) => {
  const { username, password } = req.body;
  const parent = await prisma.parent.findUnique({ where: { username } });
  if (!parent) return res.json({ success: false });
  const isValid = await bcrypt.compare(password, parent.password);
  res.json({ success: isValid, hasChanged: parent.hasChanged });
});

app.get('/api/parent', async (req, res) => {
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent set' });
  res.json({ username: parent.username });
});

app.post('/api/parent/set', async (req, res) => {
  const { username, password, currentPassword } = req.body;
  const parent = await prisma.parent.findFirst();
  if (parent && currentPassword !== undefined) {
    const isValid = await bcrypt.compare(currentPassword, parent.password);
    if (!isValid) return res.status(403).json({ success: false, error: 'Current password is incorrect.' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  if (parent) {
    await prisma.parent.update({ where: { id: parent.id }, data: { username, password: hashedPassword, hasChanged: true } });
  } else {
    await prisma.parent.create({ data: { username, password: hashedPassword, hasChanged: true } });
  }
  res.json({ success: true });
});

app.post('/api/parent/reset', async (req, res) => {
  const { resetCode, username, password } = req.body;
  const expectedCode = process.env.PARENT_RESET_CODE;
  if (!expectedCode) return res.status(503).json({ success: false, error: 'Reset code not configured.' });
  if (!resetCode || resetCode !== expectedCode) return res.status(403).json({ success: false, error: 'Invalid reset code.' });
  if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password are required.' });
  const hashedPassword = await bcrypt.hash(password, 10);
  const parent = await prisma.parent.findFirst();
  if (parent) {
    await prisma.parent.update({ where: { id: parent.id }, data: { username, password: hashedPassword, hasChanged: true } });
  } else {
    await prisma.parent.create({ data: { username, password: hashedPassword, hasChanged: true } });
  }
  console.log('[security] Parent credentials reset via emergency code.');
  res.json({ success: true });
});

// ── Auto Weekly Close-Out ─────────────────────────────────────────────────────

async function runWeeklyCloseOut() {
  console.log('[cron] Starting weekly close-out...');

  const candidates = await prisma.chore.findMany({ where: { isArchived: false, isApproved: false } });
  const eligibleIds = candidates.filter(c => c.completedDays.length >= 4).map(c => c.id);
  if (eligibleIds.length > 0) {
    await prisma.chore.updateMany({ where: { id: { in: eligibleIds } }, data: { isApproved: true } });
  }

  const kids = await prisma.user.findMany({ where: { role: 'child' } });
  const summaryLines = [];

  for (const kid of kids) {
    const approvedChores = await prisma.chore.findMany({
      where: { assignedTo: kid.id, isApproved: true, isArchived: false },
    });
    if (approvedChores.length === 0) continue;

    const totalAmount = approvedChores.reduce((sum, c) => {
      const n = c.completedDays.length;
      let earned = 0;
      if (n === 4) earned = c.baseValue * 0.8;
      else if (n >= 5 && n <= 6) earned = c.baseValue;
      else if (n === 7) earned = c.baseValue + 1;
      return sum + earned;
    }, 0);

    await prisma.payoutRecord.create({
      data: {
        childId: kid.id,
        childName: kid.name,
        amount: Math.round(totalAmount * 100) / 100,
        choresPaid: approvedChores.map(c => c.title),
      },
    });

    await prisma.chore.updateMany({
      where: { id: { in: approvedChores.map(c => c.id) } },
      data: { completedDays: [], isApproved: false },
    });

    // Get point balance for summary
    const ledger = await prisma.pointLedger.findMany({ where: { childId: kid.id } });
    const pts = ledger.reduce((s, e) => s + e.amount, 0);
    summaryLines.push(`${kid.name}: $${totalAmount.toFixed(2)} earned, ${pts} pts balance`);
    console.log(`[cron] Paid out $${totalAmount.toFixed(2)} to ${kid.name}.`);
  }

  await prisma.chore.updateMany({
    where: { isArchived: false },
    data: { completedDays: [], isApproved: false },
  });

  if (summaryLines.length > 0) {
    notify(
      'weeklyReset',
      '📅 Weekly close-out complete',
      `New week started.\n${summaryLines.join('\n')}`,
      `<h2>📅 Weekly Close-Out Complete</h2><ul>${summaryLines.map(l => `<li>${l}</li>`).join('')}</ul>`,
    ).catch(() => {});
  }

  console.log('[cron] Weekly close-out complete.');
}

cron.schedule('0 0 * * 0', runWeeklyCloseOut, { timezone: 'America/Chicago' });

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
