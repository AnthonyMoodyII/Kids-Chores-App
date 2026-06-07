const { Router } = require('express');
const prisma = require('../lib/prisma');
const { chorePointsPerDay, optionalDollarPerCompletion, getWeekOf } = require('../lib/helpers');
const { notify, getBaseUrl } = require('../lib/notify');

const router = Router();

router.get('/daily-selections', async (req, res) => {
  const { childId, weekOf } = req.query;
  const where = {};
  if (childId) where.childId = String(childId);
  if (weekOf) where.weekOf = String(weekOf);
  const selections = await prisma.dailyChoreSelection.findMany({ where, orderBy: { createdAt: 'asc' } });
  res.json(selections);
});

router.post('/daily-selections', async (req, res) => {
  const { childId, childName, templateId, day, weekOf } = req.body;
  if (!childId || !childName || !templateId || !day || !weekOf) {
    return res.status(400).json({ error: 'childId, childName, templateId, day, weekOf required' });
  }

  const template = await prisma.choreTemplate.findUnique({ where: { id: templateId } });
  if (!template) return res.status(404).json({ error: 'Template not found' });
  if (!template.isInPool) return res.status(400).json({ error: 'Chore is not available in the pool' });

  const mandatoryChore = await prisma.chore.findFirst({
    where: { templateId, assignedTo: childId, isArchived: false },
  });
  if (mandatoryChore) return res.status(400).json({ error: 'This chore is already assigned to you as a mandatory chore' });

  const alreadyPicked = await prisma.dailyChoreSelection.findFirst({ where: { childId, templateId, day, weekOf } });
  if (alreadyPicked) return res.json(alreadyPicked);

  const selection = await prisma.dailyChoreSelection.create({
    data: {
      childId,
      childName,
      templateId,
      title: template.title,
      baseValue: template.baseValue,
      maxPerDay: template.maxPerDay,
      icon: template.icon || null,
      day,
      weekOf,
      completions: 0,
    },
  });
  res.json(selection);
});

router.post('/daily-selections/:id/complete', async (req, res) => {
  const { id } = req.params;
  const selection = await prisma.dailyChoreSelection.findUnique({ where: { id } });
  if (!selection) return res.status(404).json({ error: 'Selection not found' });

  const globalAgg = await prisma.dailyChoreSelection.aggregate({
    _sum: { completions: true },
    where: { templateId: selection.templateId, day: selection.day, weekOf: selection.weekOf },
  });
  const globalTotal = globalAgg._sum.completions || 0;
  if (globalTotal >= selection.maxPerDay) {
    return res.status(400).json({ error: `This chore has been completed ${selection.maxPerDay}× across all kids today (global max reached)` });
  }

  const updated = await prisma.dailyChoreSelection.update({ where: { id }, data: { completions: { increment: 1 } } });

  const ptsPerCompletion = chorePointsPerDay(selection.baseValue);
  await prisma.pointLedger.create({
    data: {
      childId: selection.childId,
      amount: ptsPerCompletion,
      reason: `Optional: ${selection.title} (${selection.day}) ×${updated.completions}`,
    },
  });

  notify(
    'choreComplete',
    `⭐ ${selection.childName} earned points!`,
    `${selection.childName} completed "${selection.title}" on ${selection.day} (optional) and earned ${ptsPerCompletion} pts`,
    `<p>⭐ <strong><a href="${getBaseUrl()}" style="color:#7c3aed;text-decoration:none">${selection.childName}</a></strong> completed <em>${selection.title}</em> (optional pick) on ${selection.day} and earned <strong>+${ptsPerCompletion} pts</strong>.</p>`,
  ).catch(() => {});

  res.json({ selection: updated, pointsAwarded: ptsPerCompletion });
});

router.post('/daily-selections/:id/uncomplete', async (req, res) => {
  const { id } = req.params;
  const selection = await prisma.dailyChoreSelection.findUnique({ where: { id } });
  if (!selection) return res.status(404).json({ error: 'Selection not found' });
  if (selection.completions === 0) {
    return res.status(400).json({ error: 'Nothing to undo — no completions recorded' });
  }

  const ptsPerCompletion = chorePointsPerDay(selection.baseValue);
  await prisma.pointLedger.create({
    data: { childId: selection.childId, amount: -ptsPerCompletion, reason: `Undo optional: ${selection.title} (${selection.day})` },
  });

  const updated = await prisma.dailyChoreSelection.update({ where: { id }, data: { completions: selection.completions - 1 } });
  res.json({ selection: updated, pointsReversed: ptsPerCompletion });
});

router.get('/daily-selections/dollar-summary', async (req, res) => {
  const weekOf = getWeekOf();
  const selections = await prisma.dailyChoreSelection.findMany({ where: { weekOf } });
  const summary = {};
  for (const s of selections) {
    summary[s.childId] = (summary[s.childId] || 0) + optionalDollarPerCompletion(s.baseValue) * s.completions;
  }
  for (const id of Object.keys(summary)) summary[id] = Math.round(summary[id] * 100) / 100;
  res.json(summary);
});

router.delete('/daily-selections/:id', async (req, res) => {
  const { id } = req.params;
  const selection = await prisma.dailyChoreSelection.findUnique({ where: { id } });
  if (!selection) return res.status(404).json({ error: 'Selection not found' });
  if (selection.completions > 0) {
    return res.status(400).json({ error: 'Cannot remove a chore you have already started' });
  }
  await prisma.dailyChoreSelection.delete({ where: { id } });
  res.sendStatus(200);
});

module.exports = router;
