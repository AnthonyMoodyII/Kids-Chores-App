const { Router } = require('express');
const prisma = require('../lib/prisma');
const crypto = require('crypto');
const { chorePointsPerDay, getWeekOf, isChoreEntry } = require('../lib/helpers');
const { notify, getBaseUrl, approveButtons } = require('../lib/notify');

const router = Router();

// ── Rewards catalog ───────────────────────────────────────────────────────────

router.get('/rewards', async (req, res) => {
  const rewards = await prisma.rewardTemplate.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(rewards);
});

router.post('/rewards', async (req, res) => {
  const { title, description, pointCost, icon } = req.body;
  if (!title || !pointCost) return res.status(400).json({ error: 'title and pointCost required' });
  const count = await prisma.rewardTemplate.count();
  const reward = await prisma.rewardTemplate.create({
    data: { title, description: description || null, pointCost: parseInt(pointCost), icon: icon || null, isCustom: true, sortOrder: count },
  });
  res.json(reward);
});

router.put('/rewards/:id', async (req, res) => {
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

router.delete('/rewards/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.rewardTemplate.delete({ where: { id } });
  res.sendStatus(200);
});

// ── Point balances ────────────────────────────────────────────────────────────

router.get('/points/balance', async (req, res) => {
  try {
    const weekOf = getWeekOf();
    const chores = await prisma.chore.findMany({ where: { isArchived: false } });
    const balances = {};

    for (const chore of chores) {
      const ptsPerDay = chorePointsPerDay(chore.baseValue);
      const earned = ptsPerDay * chore.completedDays.length;
      const streak = chore.completedDays.length === 7 ? Math.round(ptsPerDay * 0.25) : 0;
      balances[chore.assignedTo] = (balances[chore.assignedTo] || 0) + earned + streak;
    }

    const selections = await prisma.dailyChoreSelection.findMany({ where: { weekOf } });
    for (const s of selections) {
      const ptsPerCompletion = chorePointsPerDay(s.baseValue);
      balances[s.childId] = (balances[s.childId] || 0) + ptsPerCompletion * s.completions;
    }

    const ledger = await prisma.pointLedger.findMany();
    for (const e of ledger) {
      if (isChoreEntry(e.reason)) continue;
      balances[e.childId] = (balances[e.childId] || 0) + e.amount;
    }

    for (const id of Object.keys(balances)) {
      if (balances[id] < 0) balances[id] = 0;
    }
    res.json(balances);
  } catch (err) {
    console.error('Balance error:', err);
    res.status(500).json({ error: 'Failed to compute balances' });
  }
});

router.get('/points/ledger/:childId', async (req, res) => {
  const { childId } = req.params;
  const entries = await prisma.pointLedger.findMany({ where: { childId }, orderBy: { createdAt: 'desc' } });
  res.json(entries);
});

router.get('/points/ledger', async (req, res) => {
  const entries = await prisma.pointLedger.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(entries);
});

// ── Redemptions ───────────────────────────────────────────────────────────────

router.get('/points/redemptions', async (req, res) => {
  const redemptions = await prisma.rewardRedemption.findMany({ orderBy: { timestamp: 'desc' } });
  res.json(redemptions);
});

router.post('/points/redeem', async (req, res) => {
  const { childId, rewardTemplateId } = req.body;
  if (!childId || !rewardTemplateId) return res.status(400).json({ error: 'childId and rewardTemplateId required' });

  const kid = await prisma.user.findUnique({ where: { id: childId } });
  const reward = await prisma.rewardTemplate.findUnique({ where: { id: rewardTemplateId } });
  if (!kid || !reward) return res.status(404).json({ error: 'Kid or reward not found' });

  const ledger = await prisma.pointLedger.findMany({ where: { childId } });
  const balance = ledger.reduce((s, e) => s + e.amount, 0);
  if (balance < reward.pointCost) return res.status(400).json({ error: 'Insufficient points' });

  await prisma.pointLedger.create({ data: { childId, amount: -reward.pointCost, reason: `Redeemed: ${reward.title}` } });
  const redemption = await prisma.rewardRedemption.create({
    data: { childId, childName: kid.name, rewardTemplateId, rewardTitle: reward.title, pointCost: reward.pointCost },
  });

  notify('rewardApproved', `🎁 ${kid.name} redeemed a reward!`, `${kid.name} redeemed "${reward.title}" for ${reward.pointCost} pts`,
    `<p>🎁 <strong>${kid.name}</strong> redeemed <em>${reward.title}</em> for <strong>${reward.pointCost} pts</strong>.</p>`,
  ).catch(() => {});

  res.json(redemption);
});

router.post('/points/redemptions/:id/use', async (req, res) => {
  const { id } = req.params;
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id } });
  if (!redemption) return res.status(404).json({ error: 'Redemption not found' });
  const updated = await prisma.rewardRedemption.update({ where: { id }, data: { usedAt: new Date() } });
  res.json(updated);
});

router.post('/points/redemptions/:id/unuse', async (req, res) => {
  const { id } = req.params;
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id } });
  if (!redemption) return res.status(404).json({ error: 'Redemption not found' });
  const updated = await prisma.rewardRedemption.update({ where: { id }, data: { usedAt: null } });
  res.json(updated);
});

router.post('/points/redemptions/:id/request-use', async (req, res) => {
  const { id } = req.params;
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id } });
  if (!redemption) return res.status(404).json({ error: 'Redemption not found' });
  if (redemption.usedAt) return res.status(400).json({ error: 'Reward already used' });

  const useApprovalToken = crypto.randomBytes(24).toString('hex');
  const updated = await prisma.rewardRedemption.update({ where: { id }, data: { useApprovalToken } });

  const approveUrl = `${getBaseUrl()}/api/approve-reward-use?token=${useApprovalToken}`;
  const denyUrl = `${getBaseUrl()}/api/deny-reward-use?token=${useApprovalToken}`;

  await notify(
    'rewardRequest',
    `🎁 ${redemption.childName} wants to use a reward`,
    `${redemption.childName} wants to use "${redemption.rewardTitle}".`,
    `<p style="font-size:16px;margin:0 0 6px">🎁 <strong>${redemption.childName}</strong> wants to use a reward</p>
<p style="font-size:22px;font-weight:800;margin:0 0 4px;color:#0d0b1a">${redemption.rewardTitle}</p>
<p style="font-size:14px;color:#64748b;margin:0 0 4px">${redemption.pointCost} pts</p>
${approveButtons(approveUrl, denyUrl)}`,
    approveUrl,
    denyUrl,
    `${redemption.childName} wants to use "${redemption.rewardTitle}".\n\nApprove:\n${approveUrl}\n\nDeny:\n${denyUrl}`,
  );
  res.json(updated);
});

router.get('/approve-reward-use', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect(`${getBaseUrl()}/?reward_use=missing_token`);
  const appUrl = getBaseUrl();
  const redemption = await prisma.rewardRedemption.findUnique({ where: { useApprovalToken: String(token) } });
  if (!redemption) return res.redirect(`${appUrl}/?reward_use=already_handled`);
  await prisma.rewardRedemption.update({ where: { id: redemption.id }, data: { usedAt: new Date(), useApprovalToken: null } });
  await notify('rewardApproved', `✅ ${redemption.childName} can use their reward!`,
    `${redemption.childName}'s request to use "${redemption.rewardTitle}" was approved`,
    `<p>✅ <strong>${redemption.childName}</strong>'s request to use <em>${redemption.rewardTitle}</em> was approved.</p>`,
  );
  return res.redirect(`${appUrl}/?reward_use=approved&kid=${encodeURIComponent(redemption.childName)}&reward=${encodeURIComponent(redemption.rewardTitle)}`);
});

router.get('/deny-reward-use', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect(`${getBaseUrl()}/?reward_use=missing_token`);
  const appUrl = getBaseUrl();
  const redemption = await prisma.rewardRedemption.findUnique({ where: { useApprovalToken: String(token) } });
  if (!redemption) return res.redirect(`${appUrl}/?reward_use=already_handled`);
  await prisma.rewardRedemption.update({ where: { id: redemption.id }, data: { useApprovalToken: null } });
  await notify('rewardApproved', `❌ ${redemption.childName}'s reward use request was denied`,
    `${redemption.childName}'s request to use "${redemption.rewardTitle}" was denied`,
    `<p>❌ <strong>${redemption.childName}</strong>'s request to use <em>${redemption.rewardTitle}</em> was denied.</p>`,
  );
  return res.redirect(`${appUrl}/?reward_use=denied&kid=${encodeURIComponent(redemption.childName)}&reward=${encodeURIComponent(redemption.rewardTitle)}`);
});

router.put('/points/redemptions/:id/approve-use', async (req, res) => {
  const { id } = req.params;
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id } });
  if (!redemption) return res.status(404).json({ error: 'Redemption not found' });
  if (redemption.usedAt) return res.status(400).json({ error: 'Already used' });
  const updated = await prisma.rewardRedemption.update({ where: { id }, data: { usedAt: new Date(), useApprovalToken: null } });
  res.json(updated);
});

router.put('/points/redemptions/:id/deny-use', async (req, res) => {
  const { id } = req.params;
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id } });
  if (!redemption) return res.status(404).json({ error: 'Redemption not found' });
  const updated = await prisma.rewardRedemption.update({ where: { id }, data: { useApprovalToken: null } });
  res.json(updated);
});

router.delete('/points/redemptions/:id', async (req, res) => {
  const { id } = req.params;
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id } });
  if (!redemption) return res.status(404).json({ error: 'Redemption not found' });
  await prisma.pointLedger.create({ data: { childId: redemption.childId, amount: redemption.pointCost, reason: `Refund: ${redemption.rewardTitle}` } });
  await prisma.rewardRedemption.delete({ where: { id } });
  res.json({ refunded: redemption.pointCost });
});

// ── Redemption Requests (kid asks parent) ─────────────────────────────────────

router.get('/redemption-requests', async (req, res) => {
  const requests = await prisma.redemptionRequest.findMany({ orderBy: { timestamp: 'desc' } });
  res.json(requests);
});

router.post('/redemption-requests', async (req, res) => {
  const { childId, childName, rewardTemplateId } = req.body;
  if (!childId || !rewardTemplateId) return res.status(400).json({ error: 'childId and rewardTemplateId required' });

  const ledger = await prisma.pointLedger.findMany({ where: { childId } });
  const balance = ledger.reduce((s, e) => s + e.amount, 0);
  const reward = await prisma.rewardTemplate.findUnique({ where: { id: rewardTemplateId } });
  if (!reward) return res.status(404).json({ error: 'Reward not found' });
  if (balance < reward.pointCost) return res.status(400).json({ error: 'Insufficient points' });

  await prisma.redemptionRequest.updateMany({
    where: { childId, rewardTemplateId, status: 'pending' },
    data: { status: 'cancelled' },
  });

  const approvalToken = crypto.randomBytes(24).toString('hex');
  const request = await prisma.redemptionRequest.create({
    data: { childId, childName: childName || 'Unknown', rewardTemplateId, rewardTitle: reward.title, pointCost: reward.pointCost, approvalToken },
  });

  const approvalUrl = `${getBaseUrl()}/api/approve-reward?token=${approvalToken}`;
  const denyUrl = `${getBaseUrl()}/api/deny-reward?token=${approvalToken}`;
  notify('rewardRequest', `🎁 ${childName} wants a reward`, `${childName} wants to redeem "${reward.title}" (${reward.pointCost} pts).`,
    `<p style="font-size:16px;margin:0 0 6px">🎁 <strong>${childName}</strong> wants to redeem a reward</p>
<p style="font-size:22px;font-weight:800;margin:0 0 4px;color:#0d0b1a">${reward.title}</p>
<p style="font-size:14px;color:#64748b;margin:0 0 4px">${reward.pointCost} pts</p>
${approveButtons(approvalUrl, denyUrl)}`,
    approvalUrl, denyUrl,
    `${childName} wants to redeem "${reward.title}" (${reward.pointCost} pts).\n\nApprove:\n${approvalUrl}\n\nDeny:\n${denyUrl}`,
  ).catch(() => {});

  res.json(request);
});

router.get('/approve-reward', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token.');
  const request = await prisma.redemptionRequest.findUnique({ where: { approvalToken: String(token) } });
  if (!request) return res.status(404).send('Invalid or expired approval link.');
  if (request.status !== 'pending') {
    const appUrl = getBaseUrl();
    const msg = request.status === 'approved' ? 'already_approved' : 'already_handled';
    return res.redirect(`${appUrl}/?reward_approval=${msg}`);
  }

  const ledger = await prisma.pointLedger.findMany({ where: { childId: request.childId } });
  const balance = ledger.reduce((s, e) => s + e.amount, 0);
  if (balance < request.pointCost) {
    return res.status(400).send(
      `<html><body style="font-family:sans-serif;padding:2rem">
        <h2>❌ Insufficient points</h2>
        <p>${request.childName} only has ${balance} pts but this reward costs ${request.pointCost} pts.</p>
        <p><a href="${getBaseUrl()}">← Back to app</a></p>
      </body></html>`
    );
  }

  await prisma.pointLedger.create({ data: { childId: request.childId, amount: -request.pointCost, reason: `Redeemed: ${request.rewardTitle}` } });
  await prisma.rewardRedemption.create({
    data: { childId: request.childId, childName: request.childName, rewardTemplateId: request.rewardTemplateId, rewardTitle: request.rewardTitle, pointCost: request.pointCost },
  });
  await prisma.redemptionRequest.update({ where: { id: request.id }, data: { status: 'approved', approvalToken: null } });

  notify('rewardApproved', `🎁 ${request.childName} redeemed a reward!`, `${request.childName} redeemed "${request.rewardTitle}" for ${request.pointCost} pts`,
    `<p>🎁 <strong>${request.childName}</strong> redeemed <em>${request.rewardTitle}</em> for <strong>${request.pointCost} pts</strong>.</p>`,
  ).catch(() => {});

  const appUrl = getBaseUrl();
  return res.redirect(`${appUrl}/?reward_approval=approved&kid=${encodeURIComponent(request.childName)}&reward=${encodeURIComponent(request.rewardTitle)}`);
});

router.get('/deny-reward', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token.');
  const request = await prisma.redemptionRequest.findUnique({ where: { approvalToken: String(token) } });
  if (!request) return res.status(404).send('Invalid or expired denial link.');
  const appUrl = getBaseUrl();
  if (request.status !== 'pending') {
    const msg = request.status === 'approved' ? 'already_approved' : 'already_handled';
    return res.redirect(`${appUrl}/?reward_approval=${msg}`);
  }
  await prisma.redemptionRequest.update({ where: { id: request.id }, data: { status: 'rejected', approvalToken: null } });
  notify('rewardApproved', `❌ Reward request denied`, `${request.childName}'s request for "${request.rewardTitle}" was denied`,
    `<p>❌ <strong>${request.childName}</strong>'s request for <em>${request.rewardTitle}</em> (<strong>${request.pointCost} pts</strong>) was denied.</p>`,
  ).catch(() => {});
  return res.redirect(`${appUrl}/?reward_approval=denied&kid=${encodeURIComponent(request.childName)}&reward=${encodeURIComponent(request.rewardTitle)}`);
});

router.put('/redemption-requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  const request = await prisma.redemptionRequest.findUnique({ where: { id } });
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const ledger = await prisma.pointLedger.findMany({ where: { childId: request.childId } });
  const balance = ledger.reduce((s, e) => s + e.amount, 0);
  if (balance < request.pointCost) return res.status(400).json({ error: 'Insufficient points' });

  await prisma.pointLedger.create({ data: { childId: request.childId, amount: -request.pointCost, reason: `Redeemed: ${request.rewardTitle}` } });
  const redemption = await prisma.rewardRedemption.create({
    data: { childId: request.childId, childName: request.childName, rewardTemplateId: request.rewardTemplateId, rewardTitle: request.rewardTitle, pointCost: request.pointCost },
  });
  await prisma.redemptionRequest.update({ where: { id }, data: { status: 'approved', approvalToken: null } });
  res.json({ redemption });
});

router.put('/redemption-requests/:id/reject', async (req, res) => {
  const { id } = req.params;
  await prisma.redemptionRequest.update({ where: { id }, data: { status: 'rejected' } });
  res.json({ ok: true });
});

// ── Reward Requests (kid suggests ideas) ─────────────────────────────────────

router.get('/reward-requests', async (req, res) => {
  const requests = await prisma.rewardRequest.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(requests);
});

router.post('/reward-requests', async (req, res) => {
  const { childId, childName, title, description } = req.body;
  if (!childId || !title) return res.status(400).json({ error: 'childId and title required' });
  const request = await prisma.rewardRequest.create({
    data: { childId, childName: childName || 'Unknown', title, description: description || null },
  });
  notify('rewardIdea', `💡 New reward idea from ${childName}`, `${childName} suggested: "${title}" — review it in the parent portal.`,
    `<p>💡 <strong>${childName}</strong> suggested a new reward: <em>${title}</em></p>${description ? `<p>${description}</p>` : ''}<p>Review and approve it in the parent portal.</p>`,
  ).catch(() => {});
  res.json(request);
});

router.put('/reward-requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { pointCost } = req.body;
  if (!pointCost) return res.status(400).json({ error: 'pointCost required' });
  const request = await prisma.rewardRequest.update({ where: { id }, data: { status: 'approved', pointCost: parseInt(pointCost) } });
  const count = await prisma.rewardTemplate.count();
  const reward = await prisma.rewardTemplate.create({
    data: { title: request.title, description: request.description, pointCost: request.pointCost, isCustom: true, sortOrder: count },
  });
  res.json({ request, reward });
});

router.put('/reward-requests/:id/reject', async (req, res) => {
  const { id } = req.params;
  await prisma.rewardRequest.update({ where: { id }, data: { status: 'rejected' } });
  res.json({ ok: true });
});

module.exports = router;
