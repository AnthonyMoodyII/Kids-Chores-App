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
  return Math.max(10, 10 + Math.round(baseValue * 4));
}

// ── Notification helpers ──────────────────────────────────────────────────────
async function getNotifSettings() {
  return prisma.notificationSettings.findUnique({ where: { id: 'singleton' } });
}

// Resolve base URL without a request object (for async notifications)
function getBaseUrl() {
  return (process.env.APP_URL || 'http://localhost:8080').replace(/\/$/, '');
}

async function sendPushover(title, message, actionUrl = null) {
  try {
    const ns = await getNotifSettings();
    if (!ns || !ns.pushoverEnabled || !ns.pushoverAppToken || !ns.pushoverUserKey) return;
    const body = {
      token: ns.pushoverAppToken,
      user: ns.pushoverUserKey,
      title,
      message,
    };
    if (actionUrl) {
      body.url = actionUrl;
      body.url_title = '✅ Approve now';
    }
    await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.error('[pushover] send error:', err.message);
  }
}

// ── Email HTML wrapper ────────────────────────────────────────────────────────
function buildEmail(bodyHtml, textBody = '') {
  const siteUrl = getBaseUrl();
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Moody Family Chores</title></head>
<body style="margin:0;padding:0;background:#f7f6f3;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6f3;padding:32px 16px">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%">
      <tr>
        <td style="background:#0d0b1a;border-radius:16px 16px 0 0;padding:16px 24px">
          <a href="${siteUrl}" style="color:#a78bfa;font-weight:700;font-size:15px;text-decoration:none">🏠 Moody Family Chores</a>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:28px 24px;border-radius:0 0 16px 16px;border:1px solid #f1f0ee;border-top:none">
          ${bodyHtml}
          <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #f1f0ee;font-size:12px;color:#94a3b8">
            <a href="${siteUrl}" style="color:#7c3aed;text-decoration:none;font-weight:600">Open Moody Chores →</a>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  return { html, text: textBody || '' };
}

// Reusable approve/deny button pair (table-based for email client compatibility)
function approveButtons(approveUrl, denyUrl) {
  return `
<table cellpadding="0" cellspacing="0" style="margin-top:20px">
  <tr>
    <td style="padding-right:10px">
      <a href="${approveUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px">✅ Approve</a>
    </td>
    <td>
      <a href="${denyUrl}" style="display:inline-block;background:#e11d48;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px">❌ Deny</a>
    </td>
  </tr>
</table>`;
}

async function sendEmail(subject, htmlBody, textBody = '') {
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
      text: textBody,
    });
  } catch (err) {
    console.error('[email] send error:', err.message);
  }
}

async function sendGotify(provider, title, message, approveUrl = null, denyUrl = null) {
  try {
    const { url, token, priority = 5 } = provider.config || {};
    if (!url || !token) return;
    const endpoint = url.replace(/\/$/, '') + '/message';

    let fullMessage = message;
    if (approveUrl && denyUrl) {
      fullMessage += `\n\n[✅ Approve](${approveUrl}) | [❌ Deny](${denyUrl})`;
    } else if (approveUrl) {
      fullMessage += `\n\n[✅ Approve](${approveUrl})`;
    } else {
      fullMessage += `\n\n[🏠 Open Moody Chores](${getBaseUrl()})`;
    }

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        message: fullMessage,
        priority: Number(priority),
        extras: {
          'client::display': { contentType: 'text/markdown' },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.error(`[gotify:${provider.name}] send error:`, err.message);
  }
}

async function notify(event, title, message, htmlBody, approveUrl = null, denyUrl = null, textBody = '') {
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

  // Fan out to all enabled providers
  const providers = await prisma.notificationProvider.findMany({ where: { enabled: true } });
  const providerSends = providers.map(p => {
    if (p.type === 'gotify') return sendGotify(p, title, message, approveUrl, denyUrl);
    return Promise.resolve();
  });

  const { html: wrappedHtml, text: wrappedText } = buildEmail(htmlBody || `<p>${message}</p>`, textBody || message);

  await Promise.all([
    sendPushover(title, message, approveUrl),
    sendEmail(title, wrappedHtml, wrappedText),
    ...providerSends,
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

app.put('/api/templates/:id', async (req, res) => {
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
        icon: template.icon || null,
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
        `<p>🔥 <strong><a href="${getBaseUrl()}" style="color:#7c3aed;text-decoration:none">${kid?.name}</a></strong> completed <em>${chore.title}</em> all 7 days this week!</p><p>Streak bonus: <strong>+${bonus} pts</strong></p>`,
      ).catch(() => {});
    } else {
      // Regular completion notification
      const kid = await prisma.user.findUnique({ where: { id: chore.assignedTo } });
      notify(
        'choreComplete',
        `⭐ ${kid?.name} earned points!`,
        `${kid?.name} completed "${chore.title}" on ${day} and earned ${ptsPerDay} pts`,
        `<p>⭐ <strong><a href="${getBaseUrl()}" style="color:#7c3aed;text-decoration:none">${kid?.name}</a></strong> completed <em>${chore.title}</em> on ${day} and earned <strong>+${ptsPerDay} pts</strong>.</p>`,
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
    const weekOf = getWeekOf();
    const chores = await prisma.chore.findMany({ where: { isArchived: false } });
    const kids = await prisma.user.findMany({ where: { role: 'child' } });
    const selections = await prisma.dailyChoreSelection.findMany({ where: { weekOf } });

    // 1. Compute each kid's current point balance before clearing
    const weeklyEarned = {};
    for (const chore of chores) {
      const ptsPerDay = chorePointsPerDay(chore.baseValue);
      const earned = ptsPerDay * chore.completedDays.length;
      const streak = chore.completedDays.length === 7 ? Math.round(ptsPerDay * 0.25) : 0;
      weeklyEarned[chore.assignedTo] = (weeklyEarned[chore.assignedTo] || 0) + earned + streak;
    }
    for (const s of selections) {
      weeklyEarned[s.childId] = (weeklyEarned[s.childId] || 0) + chorePointsPerDay(s.baseValue) * s.completions;
    }

    const existingLedger = await prisma.pointLedger.findMany();
    const ledgerAdj = {};
    for (const e of existingLedger) {
      if (isChoreEntry(e.reason)) continue;
      ledgerAdj[e.childId] = (ledgerAdj[e.childId] || 0) + e.amount;
    }

    // 2. Wipe ALL ledger entries for every kid — points do not carry forward.
    //    Money owed is tracked separately via PayoutRecord / CashPayment.
    for (const kid of kids) {
      await prisma.pointLedger.deleteMany({ where: { childId: kid.id } });
    }

    // 3. Clear mandatory chore completedDays and approval
    await prisma.chore.updateMany({
      where: { isArchived: false },
      data: { completedDays: [], isApproved: false },
    });

    // 4. Delete daily selections for the week (they reset daily/weekly)
    await prisma.dailyChoreSelection.deleteMany({ where: { weekOf } });

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
  const { customAmount } = req.body; // optional: parent-specified partial amount
  const kid = await prisma.user.findUnique({ where: { id: kidId } });
  const approvedChores = await prisma.chore.findMany({
    where: { assignedTo: kidId, isApproved: true, isArchived: false },
  });

  // Mandatory chore earnings (tier formula)
  const mandatoryAmount = approvedChores.reduce((sum, c) => {
    const n = c.completedDays.length;
    let earned = 0;
    if (n === 4) earned = c.baseValue * 0.8;
    else if (n >= 5 && n <= 6) earned = c.baseValue;
    else if (n === 7) earned = c.baseValue + 1;
    return sum + earned;
  }, 0);

  // Optional chore earnings (per-completion: baseValue / 5)
  const weekOf = getWeekOf();
  const selections = await prisma.dailyChoreSelection.findMany({ where: { childId: kidId, weekOf } });
  const optionalAmount = selections.reduce((sum, s) => sum + optionalDollarPerCompletion(s.baseValue) * s.completions, 0);

  const calculatedAmount = mandatoryAmount + optionalAmount;
  // Use parent-specified amount if provided (capped at calculated, min $0.01)
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

  // Delete this week's optional selections after payout
  await prisma.dailyChoreSelection.deleteMany({ where: { childId: kidId, weekOf } });

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

// ── Daily Chore Selections (Optional Pool) ────────────────────────────────────

// Compute Monday ISO date string for a given date (used as weekOf key)
function getWeekOf(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// Points per optional chore completion (same formula as mandatory)
// Dollar credit per completion: baseValue / 5 (5 completions across week = full value)
function optionalDollarPerCompletion(baseValue) {
  return Math.round((baseValue / 5) * 100) / 100;
}

app.get('/api/daily-selections', async (req, res) => {
  const { childId, weekOf } = req.query;
  const where = {};
  if (childId) where.childId = String(childId);
  if (weekOf) where.weekOf = String(weekOf);
  const selections = await prisma.dailyChoreSelection.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
  res.json(selections);
});

app.post('/api/daily-selections', async (req, res) => {
  const { childId, childName, templateId, day, weekOf } = req.body;
  if (!childId || !childName || !templateId || !day || !weekOf) {
    return res.status(400).json({ error: 'childId, childName, templateId, day, weekOf required' });
  }

  const template = await prisma.choreTemplate.findUnique({ where: { id: templateId } });
  if (!template) return res.status(404).json({ error: 'Template not found' });
  if (!template.isInPool) return res.status(400).json({ error: 'Chore is not available in the pool' });

  // Prevent picking if kid already has this as a mandatory assigned chore
  const mandatoryChore = await prisma.chore.findFirst({
    where: { templateId, assignedTo: childId, isArchived: false },
  });
  if (mandatoryChore) return res.status(400).json({ error: 'This chore is already assigned to you as a mandatory chore' });

  // Find-or-create: if the kid already picked this today, return the existing selection
  const alreadyPicked = await prisma.dailyChoreSelection.findFirst({
    where: { childId, templateId, day, weekOf },
  });
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

app.post('/api/daily-selections/:id/complete', async (req, res) => {
  const { id } = req.params;
  const selection = await prisma.dailyChoreSelection.findUnique({ where: { id } });
  if (!selection) return res.status(404).json({ error: 'Selection not found' });

  // Global limit: sum completions across ALL kids for this template today
  const globalAgg = await prisma.dailyChoreSelection.aggregate({
    _sum: { completions: true },
    where: { templateId: selection.templateId, day: selection.day, weekOf: selection.weekOf },
  });
  const globalTotal = globalAgg._sum.completions || 0;
  if (globalTotal >= selection.maxPerDay) {
    return res.status(400).json({ error: `This chore has been completed ${selection.maxPerDay}× across all kids today (global max reached)` });
  }

  const updated = await prisma.dailyChoreSelection.update({
    where: { id },
    data: { completions: { increment: 1 } },
  });

  // Award points
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

// Undo one completion — decrements by 1, reverses points, deletes selection if completions → 0
app.post('/api/daily-selections/:id/uncomplete', async (req, res) => {
  const { id } = req.params;
  const selection = await prisma.dailyChoreSelection.findUnique({ where: { id } });
  if (!selection) return res.status(404).json({ error: 'Selection not found' });
  if (selection.completions === 0) {
    return res.status(400).json({ error: 'Nothing to undo — no completions recorded' });
  }

  const newCount = selection.completions - 1;

  // Reverse the points for this completion
  const ptsPerCompletion = chorePointsPerDay(selection.baseValue);
  await prisma.pointLedger.create({
    data: {
      childId: selection.childId,
      amount: -ptsPerCompletion,
      reason: `Undo optional: ${selection.title} (${selection.day})`,
    },
  });

  const updated = await prisma.dailyChoreSelection.update({
    where: { id },
    data: { completions: newCount },
  });
  res.json({ selection: updated, pointsReversed: ptsPerCompletion });
});

// Return dollar summary for optional selections (current week, per kid)
app.get('/api/daily-selections/dollar-summary', async (req, res) => {
  const weekOf = getWeekOf();
  const selections = await prisma.dailyChoreSelection.findMany({ where: { weekOf } });
  const summary = {};
  for (const s of selections) {
    summary[s.childId] = (summary[s.childId] || 0) + optionalDollarPerCompletion(s.baseValue) * s.completions;
  }
  // Round values
  for (const id of Object.keys(summary)) summary[id] = Math.round(summary[id] * 100) / 100;
  res.json(summary);
});

app.delete('/api/daily-selections/:id', async (req, res) => {
  const { id } = req.params;
  const selection = await prisma.dailyChoreSelection.findUnique({ where: { id } });
  if (!selection) return res.status(404).json({ error: 'Selection not found' });
  if (selection.completions > 0) {
    return res.status(400).json({ error: 'Cannot remove a chore you have already started' });
  }
  await prisma.dailyChoreSelection.delete({ where: { id } });
  res.sendStatus(200);
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
// completedDays / dailyChoreSelections are the authoritative source.
const CHORE_ENTRY_PREFIXES = ['Completed:', 'Unchecked:', '7-day streak bonus:', 'Streak bonus reversed:', 'Optional:', 'Undo optional:'];
function isChoreEntry(reason) {
  return CHORE_ENTRY_PREFIXES.some(p => reason.startsWith(p));
}

// Get point balances for all kids.
// Balance = (mandatory chore pts from completedDays)
//         + (optional chore pts from dailyChoreSelections)
//         + (ledger: carry-forward, redemptions, cash-to-points, etc.)
app.get('/api/points/balance', async (req, res) => {
  try {
    const weekOf = getWeekOf();

    // 1. Mandatory chore pts — from completedDays (authoritative)
    const chores = await prisma.chore.findMany({ where: { isArchived: false } });
    const balances = {};
    for (const chore of chores) {
      const ptsPerDay = chorePointsPerDay(chore.baseValue);
      const earned = ptsPerDay * chore.completedDays.length;
      const streak = chore.completedDays.length === 7 ? Math.round(ptsPerDay * 0.25) : 0;
      balances[chore.assignedTo] = (balances[chore.assignedTo] || 0) + earned + streak;
    }

    // 2. Optional chore pts — from dailyChoreSelections (current week)
    const selections = await prisma.dailyChoreSelection.findMany({ where: { weekOf } });
    for (const s of selections) {
      const ptsPerCompletion = chorePointsPerDay(s.baseValue);
      balances[s.childId] = (balances[s.childId] || 0) + ptsPerCompletion * s.completions;
    }

    // 3. Apply carry-forward and redemptions from ledger (skip chore/optional entries).
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

// Mark a redeemed reward as used (moves out of inventory)
app.post('/api/points/redemptions/:id/use', async (req, res) => {
  const { id } = req.params;
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id } });
  if (!redemption) return res.status(404).json({ error: 'Redemption not found' });
  const updated = await prisma.rewardRedemption.update({
    where: { id },
    data: { usedAt: new Date() },
  });
  res.json(updated);
});

// Mark a redeemed reward as NOT yet used (move back to inventory)
app.post('/api/points/redemptions/:id/unuse', async (req, res) => {
  const { id } = req.params;
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id } });
  if (!redemption) return res.status(404).json({ error: 'Redemption not found' });
  const updated = await prisma.rewardRedemption.update({
    where: { id },
    data: { usedAt: null },
  });
  res.json(updated);
});

// Kid requests parent approval to USE a reward from their inventory
app.post('/api/points/redemptions/:id/request-use', async (req, res) => {
  const { id } = req.params;
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id } });
  if (!redemption) return res.status(404).json({ error: 'Redemption not found' });
  if (redemption.usedAt) return res.status(400).json({ error: 'Reward already used' });

  const useApprovalToken = require('crypto').randomBytes(24).toString('hex');
  const updated = await prisma.rewardRedemption.update({
    where: { id },
    data: { useApprovalToken },
  });

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

// Parent approves a reward "use" request via deep link token
app.get('/api/approve-reward-use', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect(`${getBaseUrl()}/?reward_use=missing_token`);

  const appUrl = getBaseUrl();
  const redemption = await prisma.rewardRedemption.findUnique({ where: { useApprovalToken: String(token) } });
  if (!redemption) {
    const msg = 'already_handled';
    return res.redirect(`${appUrl}/?reward_use=${msg}`);
  }

  await prisma.rewardRedemption.update({
    where: { id: redemption.id },
    data: { usedAt: new Date(), useApprovalToken: null },
  });

  await notify(
    'rewardApproved',
    `✅ ${redemption.childName} can use their reward!`,
    `${redemption.childName}'s request to use "${redemption.rewardTitle}" was approved`,
    `<p>✅ <strong>${redemption.childName}</strong>'s request to use <em>${redemption.rewardTitle}</em> was approved.</p>`,
  );

  return res.redirect(`${appUrl}/?reward_use=approved&kid=${encodeURIComponent(redemption.childName)}&reward=${encodeURIComponent(redemption.rewardTitle)}`);
});

// Parent denies a reward "use" request via deep link token
app.get('/api/deny-reward-use', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect(`${getBaseUrl()}/?reward_use=missing_token`);

  const appUrl = getBaseUrl();
  const redemption = await prisma.rewardRedemption.findUnique({ where: { useApprovalToken: String(token) } });
  if (!redemption) {
    return res.redirect(`${appUrl}/?reward_use=already_handled`);
  }

  await prisma.rewardRedemption.update({
    where: { id: redemption.id },
    data: { useApprovalToken: null },
  });

  await notify(
    'rewardApproved',
    `❌ ${redemption.childName}'s reward use request was denied`,
    `${redemption.childName}'s request to use "${redemption.rewardTitle}" was denied`,
    `<p>❌ <strong>${redemption.childName}</strong>'s request to use <em>${redemption.rewardTitle}</em> was denied.</p>`,
  );

  return res.redirect(`${appUrl}/?reward_use=denied&kid=${encodeURIComponent(redemption.childName)}&reward=${encodeURIComponent(redemption.rewardTitle)}`);
});

// Parent approves a "use" request from the dashboard (by redemption ID)
app.put('/api/points/redemptions/:id/approve-use', async (req, res) => {
  const { id } = req.params;
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id } });
  if (!redemption) return res.status(404).json({ error: 'Redemption not found' });
  if (redemption.usedAt) return res.status(400).json({ error: 'Already used' });

  const updated = await prisma.rewardRedemption.update({
    where: { id },
    data: { usedAt: new Date(), useApprovalToken: null },
  });
  res.json(updated);
});

// Parent denies a "use" request from the dashboard (by redemption ID)
app.put('/api/points/redemptions/:id/deny-use', async (req, res) => {
  const { id } = req.params;
  const redemption = await prisma.rewardRedemption.findUnique({ where: { id } });
  if (!redemption) return res.status(404).json({ error: 'Redemption not found' });

  const updated = await prisma.rewardRedemption.update({
    where: { id },
    data: { useApprovalToken: null },
  });
  res.json(updated);
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

  const approvalToken = crypto.randomBytes(24).toString('hex');
  const request = await prisma.redemptionRequest.create({
    data: {
      childId,
      childName: childName || 'Unknown',
      rewardTemplateId,
      rewardTitle: reward.title,
      pointCost: reward.pointCost,
      approvalToken,
    },
  });

  const approvalUrl = `${getBaseUrl()}/api/approve-reward?token=${approvalToken}`;
  const denyUrl = `${getBaseUrl()}/api/deny-reward?token=${approvalToken}`;
  notify(
    'rewardRequest',
    `🎁 ${childName} wants a reward`,
    `${childName} wants to redeem "${reward.title}" (${reward.pointCost} pts).`,
    `<p style="font-size:16px;margin:0 0 6px">🎁 <strong>${childName}</strong> wants to redeem a reward</p>
<p style="font-size:22px;font-weight:800;margin:0 0 4px;color:#0d0b1a">${reward.title}</p>
<p style="font-size:14px;color:#64748b;margin:0 0 4px">${reward.pointCost} pts</p>
${approveButtons(approvalUrl, denyUrl)}`,
    approvalUrl,
    denyUrl,
    `${childName} wants to redeem "${reward.title}" (${reward.pointCost} pts).\n\nApprove:\n${approvalUrl}\n\nDeny:\n${denyUrl}`,
  ).catch(() => {});

  res.json(request);
});

// ── One-click approval via deep link (no login required) ─────────────────────
app.get('/api/approve-reward', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token.');

  const request = await prisma.redemptionRequest.findUnique({ where: { approvalToken: String(token) } });
  if (!request) return res.status(404).send('Invalid or expired approval link.');
  if (request.status !== 'pending') {
    // Already handled — redirect to app with a message
    const appUrl = getBaseUrl();
    const msg = request.status === 'approved' ? 'already_approved' : 'already_handled';
    return res.redirect(`${appUrl}/?reward_approval=${msg}`);
  }

  const kid = await prisma.user.findUnique({ where: { id: request.childId } });
  const reward = await prisma.rewardTemplate.findUnique({ where: { id: request.rewardTemplateId } });

  // Check balance
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

  // Deduct points + create redemption
  await prisma.pointLedger.create({
    data: { childId: request.childId, amount: -request.pointCost, reason: `Redeemed: ${request.rewardTitle}` },
  });
  await prisma.rewardRedemption.create({
    data: {
      childId: request.childId,
      childName: request.childName,
      rewardTemplateId: request.rewardTemplateId,
      rewardTitle: request.rewardTitle,
      pointCost: request.pointCost,
    },
  });
  // Consume token — mark approved and clear token so link can't be reused
  await prisma.redemptionRequest.update({
    where: { id: request.id },
    data: { status: 'approved', approvalToken: null },
  });

  notify(
    'rewardApproved',
    `🎁 ${request.childName} redeemed a reward!`,
    `${request.childName} redeemed "${request.rewardTitle}" for ${request.pointCost} pts`,
    `<p>🎁 <strong>${request.childName}</strong> redeemed <em>${request.rewardTitle}</em> for <strong>${request.pointCost} pts</strong>.</p>`,
  ).catch(() => {});

  // Redirect to the app with a success indicator
  const appUrl = getBaseUrl();
  return res.redirect(`${appUrl}/?reward_approval=approved&kid=${encodeURIComponent(request.childName)}&reward=${encodeURIComponent(request.rewardTitle)}`);
});

// ── One-click DENY via deep link ──────────────────────────────────────────────
app.get('/api/deny-reward', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token.');

  const request = await prisma.redemptionRequest.findUnique({ where: { approvalToken: String(token) } });
  if (!request) return res.status(404).send('Invalid or expired denial link.');

  const appUrl = getBaseUrl();
  if (request.status !== 'pending') {
    const msg = request.status === 'approved' ? 'already_approved' : 'already_handled';
    return res.redirect(`${appUrl}/?reward_approval=${msg}`);
  }

  // Mark rejected and clear token so link can't be reused
  await prisma.redemptionRequest.update({
    where: { id: request.id },
    data: { status: 'rejected', approvalToken: null },
  });

  notify(
    'rewardApproved',
    `❌ Reward request denied`,
    `${request.childName}'s request for "${request.rewardTitle}" was denied`,
    `<p>❌ <strong>${request.childName}</strong>'s request for <em>${request.rewardTitle}</em> (<strong>${request.pointCost} pts</strong>) was denied.</p>`,
  ).catch(() => {});

  return res.redirect(`${appUrl}/?reward_approval=denied&kid=${encodeURIComponent(request.childName)}&reward=${encodeURIComponent(request.rewardTitle)}`);
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

  // Mark approved and consume the approval token so the deep link can't be reused
  await prisma.redemptionRequest.update({ where: { id }, data: { status: 'approved', approvalToken: null } });
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

// ── Notification Providers (multi-provider: Gotify, etc.) ────────────────────

// Helper: mask secrets from config before sending to client
function maskProviderConfig(type, config) {
  if (type === 'gotify') {
    return {
      url: config.url || '',
      tokenSet: !!config.token,
      priority: config.priority ?? 5,
    };
  }
  return {};
}

app.get('/api/notification-providers', async (req, res) => {
  const providers = await prisma.notificationProvider.findMany({
    orderBy: { createdAt: 'asc' },
  });
  res.json(providers.map(p => ({
    id: p.id,
    type: p.type,
    name: p.name,
    enabled: p.enabled,
    createdAt: p.createdAt,
    config: maskProviderConfig(p.type, p.config),
  })));
});

app.post('/api/notification-providers', async (req, res) => {
  const { currentPassword, type, name, config = {} } = req.body;
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent found.' });
  const isValid = await bcrypt.compare(currentPassword, parent.password);
  if (!isValid) return res.status(403).json({ error: 'Current password is incorrect.' });
  if (!type || !name?.trim()) return res.status(400).json({ error: 'type and name are required.' });

  const provider = await prisma.notificationProvider.create({
    data: { type, name: name.trim(), enabled: true, config },
  });
  res.json({ ...provider, config: maskProviderConfig(provider.type, provider.config) });
});

app.put('/api/notification-providers/:id', async (req, res) => {
  const { id } = req.params;
  const { currentPassword, name, enabled, config } = req.body;
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent found.' });
  const isValid = await bcrypt.compare(currentPassword, parent.password);
  if (!isValid) return res.status(403).json({ error: 'Current password is incorrect.' });

  const existing = await prisma.notificationProvider.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Provider not found.' });

  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (enabled !== undefined) data.enabled = Boolean(enabled);
  if (config !== undefined) {
    // Merge config — only overwrite keys that are provided; preserve stored secrets if not re-sent
    const merged = { ...existing.config };
    for (const [k, v] of Object.entries(config)) {
      if (v !== undefined && v !== '') merged[k] = v;
    }
    data.config = merged;
  }

  const updated = await prisma.notificationProvider.update({ where: { id }, data });
  res.json({ ...updated, config: maskProviderConfig(updated.type, updated.config) });
});

app.delete('/api/notification-providers/:id', async (req, res) => {
  const { id } = req.params;
  const { currentPassword } = req.body;
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent found.' });
  const isValid = await bcrypt.compare(currentPassword, parent.password);
  if (!isValid) return res.status(403).json({ error: 'Current password is incorrect.' });
  await prisma.notificationProvider.delete({ where: { id } });
  res.json({ ok: true });
});

app.post('/api/notification-providers/:id/test', async (req, res) => {
  const { id } = req.params;
  const { currentPassword } = req.body;
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent found.' });
  const isValid = await bcrypt.compare(currentPassword, parent.password);
  if (!isValid) return res.status(403).json({ error: 'Current password is incorrect.' });

  const provider = await prisma.notificationProvider.findUnique({ where: { id } });
  if (!provider) return res.status(404).json({ error: 'Provider not found.' });

  try {
    if (provider.type === 'gotify') {
      const { url, token, priority = 5 } = provider.config || {};
      if (!url || !token) return res.status(400).json({ error: 'Gotify URL and token are required.' });
      const endpoint = url.replace(/\/$/, '') + '/message';
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: '🧪 Chore App Test', message: 'Gotify notifications are working!', priority: Number(priority) }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        const txt = await r.text();
        return res.status(400).json({ error: `Gotify returned ${r.status}: ${txt}` });
      }
    } else {
      return res.status(400).json({ error: `No test handler for type: ${provider.type}` });
    }
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
  const { currentPassword, oauthIssuer, oauthClientId, oauthClientSecret, clearCredentials } = req.body;
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent found.' });
  const isValid = await bcrypt.compare(currentPassword, parent.password);
  if (!isValid) return res.status(403).json({ error: 'Current password is incorrect.' });
  const data = {};
  if (clearCredentials) {
    // Wipe all OAuth fields
    data.oauthIssuer = null;
    data.oauthClientId = null;
    data.oauthClientSecret = null;
  } else {
    if (oauthIssuer !== undefined) data.oauthIssuer = oauthIssuer.trim() || null;
    if (oauthClientId !== undefined) data.oauthClientId = oauthClientId.trim() || null;
    // Allow explicit clear (empty string) or update
    if ('oauthClientSecret' in req.body) {
      data.oauthClientSecret = oauthClientSecret?.trim() || null;
    }
  }
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
  const weekOf = getWeekOf();

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
    const selections = await prisma.dailyChoreSelection.findMany({ where: { childId: kid.id, weekOf } });
    const optionalAmount = selections.reduce((s, sel) => s + optionalDollarPerCompletion(sel.baseValue) * sel.completions, 0);

    if (approvedChores.length === 0 && optionalAmount === 0) continue;

    const mandatoryAmount = approvedChores.reduce((sum, c) => {
      const n = c.completedDays.length;
      let earned = 0;
      if (n === 4) earned = c.baseValue * 0.8;
      else if (n >= 5 && n <= 6) earned = c.baseValue;
      else if (n === 7) earned = c.baseValue + 1;
      return sum + earned;
    }, 0);

    const totalAmount = mandatoryAmount + optionalAmount;
    const choreNames = [
      ...approvedChores.map(c => c.title),
      ...selections.filter(s => s.completions > 0).map(s => `${s.title} (optional ×${s.completions})`),
    ];

    await prisma.payoutRecord.create({
      data: {
        childId: kid.id,
        childName: kid.name,
        amount: Math.round(totalAmount * 100) / 100,
        choresPaid: choreNames,
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

  // Clear all daily selections for the week
  await prisma.dailyChoreSelection.deleteMany({ where: { weekOf } });

  // Wipe all point ledger entries — points do NOT carry forward week to week.
  // Money is already banked via PayoutRecord above.
  const allKids = await prisma.user.findMany({ where: { role: 'child' } });
  for (const kid of allKids) {
    await prisma.pointLedger.deleteMany({ where: { childId: kid.id } });
  }

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
