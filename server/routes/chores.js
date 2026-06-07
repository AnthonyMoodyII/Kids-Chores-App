const { Router } = require('express');
const prisma = require('../lib/prisma');
const { chorePointsPerDay, getWeekOf } = require('../lib/helpers');
const { notify, getBaseUrl } = require('../lib/notify');

const router = Router();

// ── Templates ─────────────────────────────────────────────────────────────────

router.get('/templates', async (req, res) => {
  const templates = await prisma.choreTemplate.findMany();
  res.json(templates);
});

router.post('/templates', async (req, res) => {
  const { title, baseValue, isMandatory, maxPerDay, isInPool, icon } = req.body;
  const template = await prisma.choreTemplate.create({
    data: {
      title,
      baseValue,
      isMandatory: isMandatory || false,
      maxPerDay: maxPerDay != null ? parseInt(maxPerDay) : 1,
      isInPool: isInPool !== undefined ? Boolean(isInPool) : true,
      icon: icon || null,
    },
  });
  res.json(template);
});

router.put('/templates/:id', async (req, res) => {
  const { id } = req.params;
  const { title, baseValue, maxPerDay, isInPool, icon } = req.body;
  const data = {};
  if (title !== undefined) data.title = title;
  if (baseValue !== undefined) data.baseValue = parseFloat(baseValue);
  if (maxPerDay !== undefined) data.maxPerDay = Math.max(1, parseInt(maxPerDay));
  if (isInPool !== undefined) data.isInPool = Boolean(isInPool);
  if (icon !== undefined) data.icon = icon || null;
  const template = await prisma.choreTemplate.update({ where: { id }, data });
  res.json(template);
});

router.delete('/templates/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.choreTemplate.delete({ where: { id } });
  res.sendStatus(200);
});

router.post('/templates/:id/toggle-mandatory', async (req, res) => {
  const { id } = req.params;
  const template = await prisma.choreTemplate.findUnique({ where: { id } });
  await prisma.choreTemplate.update({ where: { id }, data: { isMandatory: !template.isMandatory } });
  await prisma.chore.updateMany({
    where: { templateId: id, isArchived: false },
    data: { isMandatory: !template.isMandatory },
  });
  const templates = await prisma.choreTemplate.findMany();
  const chores = await prisma.chore.findMany({ where: { isArchived: false } });
  res.json({ templates, chores });
});

// ── Chores ────────────────────────────────────────────────────────────────────

router.get('/chores', async (req, res) => {
  const chores = await prisma.chore.findMany({ where: { isArchived: false } });
  res.json(chores);
});

router.post('/chores/assign', async (req, res) => {
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
        icon: template.icon || null,
      },
    });
    newChores.push(chore);
  }
  res.json(newChores);
});

router.post('/chores/:id/toggle', async (req, res) => {
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
    await prisma.pointLedger.create({
      data: {
        childId: chore.assignedTo,
        amount: ptsPerDay,
        reason: `Completed: ${chore.title} (${day})`,
        choreId: chore.id,
      },
    });

    if (newDays.length === 7) {
      const bonus = Math.round(ptsPerDay * 0.25);
      await prisma.pointLedger.create({
        data: { childId: chore.assignedTo, amount: bonus, reason: `7-day streak bonus: ${chore.title}`, choreId: chore.id },
      });
      const kid = await prisma.user.findUnique({ where: { id: chore.assignedTo } });
      notify(
        'streakBonus',
        `🔥 ${kid?.name} hit a 7-day streak!`,
        `${kid?.name} completed "${chore.title}" all 7 days — streak bonus of ${bonus} pts awarded!`,
        `<p>🔥 <strong><a href="${getBaseUrl()}" style="color:#7c3aed;text-decoration:none">${kid?.name}</a></strong> completed <em>${chore.title}</em> all 7 days this week!</p><p>Streak bonus: <strong>+${bonus} pts</strong></p>`,
      ).catch(() => {});
    } else {
      const kid = await prisma.user.findUnique({ where: { id: chore.assignedTo } });
      notify(
        'choreComplete',
        `⭐ ${kid?.name} earned points!`,
        `${kid?.name} completed "${chore.title}" on ${day} and earned ${ptsPerDay} pts`,
        `<p>⭐ <strong><a href="${getBaseUrl()}" style="color:#7c3aed;text-decoration:none">${kid?.name}</a></strong> completed <em>${chore.title}</em> on ${day} and earned <strong>+${ptsPerDay} pts</strong>.</p>`,
      ).catch(() => {});
    }
  } else {
    await prisma.pointLedger.create({
      data: { childId: chore.assignedTo, amount: -ptsPerDay, reason: `Unchecked: ${chore.title} (${day})`, choreId: chore.id },
    });
    if (chore.completedDays.length === 7) {
      const bonus = Math.round(ptsPerDay * 0.25);
      await prisma.pointLedger.create({
        data: { childId: chore.assignedTo, amount: -bonus, reason: `Streak bonus reversed: ${chore.title}`, choreId: chore.id },
      });
    }
  }

  res.json(updated);
});

router.post('/chores/:id/approve', async (req, res) => {
  const { id } = req.params;
  const chore = await prisma.chore.findUnique({ where: { id } });
  const updated = await prisma.chore.update({ where: { id }, data: { isApproved: !chore.isApproved } });
  res.json(updated);
});

router.post('/chores/reset', async (req, res) => {
  try {
    const weekOf = getWeekOf();
    const kids = await prisma.user.findMany({ where: { role: 'child' } });
    for (const kid of kids) {
      await prisma.pointLedger.deleteMany({ where: { childId: kid.id } });
    }
    await prisma.chore.updateMany({ where: { isArchived: false }, data: { completedDays: [], isApproved: false } });
    await prisma.dailyChoreSelection.deleteMany({ where: { weekOf } });
    const allActive = await prisma.chore.findMany({ where: { isArchived: false } });
    res.json(allActive);
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ error: 'Reset failed' });
  }
});

router.post('/chores/approve-all', async (req, res) => {
  const candidates = await prisma.chore.findMany({ where: { isArchived: false, isApproved: false } });
  const eligibleIds = candidates.filter(c => c.completedDays.length >= 4).map(c => c.id);
  if (eligibleIds.length > 0) {
    await prisma.chore.updateMany({ where: { id: { in: eligibleIds } }, data: { isApproved: true } });
  }
  const allActive = await prisma.chore.findMany({ where: { isArchived: false } });
  res.json({ updatedCount: eligibleIds.length, chores: allActive });
});

router.post('/chores/unassign', async (req, res) => {
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

module.exports = router;
