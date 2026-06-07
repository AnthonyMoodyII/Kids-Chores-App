const { Router } = require('express');
const nodemailer = require('nodemailer');
const prisma = require('../lib/prisma');
const { getNotifSettings } = require('../lib/notify');
const requireParentPassword = require('../middleware/requireParentPassword');

const router = Router();

function maskProviderConfig(type, config) {
  if (type === 'gotify') {
    return { url: config.url || '', tokenSet: !!config.token, priority: config.priority ?? 5 };
  }
  return {};
}

// ── Notification Settings ─────────────────────────────────────────────────────

router.get('/notifications/settings', async (req, res) => {
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

router.put('/notifications/settings', requireParentPassword, async (req, res) => {
  const { currentPassword: _pw, ...fields } = req.body;
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
  await prisma.notificationSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  });
  res.json({ ok: true });
});

router.post('/notifications/test-pushover', requireParentPassword, async (req, res) => {
  try {
    const ns = await getNotifSettings();
    if (!ns?.pushoverAppToken || !ns?.pushoverUserKey) {
      return res.status(400).json({ error: 'Pushover not configured.' });
    }
    const r = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: ns.pushoverAppToken, user: ns.pushoverUserKey, title: '🧪 Chore App Test', message: 'Pushover notifications are working!' }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    if (data.status === 1) return res.json({ ok: true });
    return res.status(400).json({ error: data.errors?.join(', ') || 'Pushover error' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/notifications/test-email', requireParentPassword, async (req, res) => {
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

// ── Notification Providers ────────────────────────────────────────────────────

router.get('/notification-providers', async (req, res) => {
  const providers = await prisma.notificationProvider.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(providers.map(p => ({
    id: p.id, type: p.type, name: p.name, enabled: p.enabled, createdAt: p.createdAt,
    config: maskProviderConfig(p.type, p.config),
  })));
});

router.post('/notification-providers', requireParentPassword, async (req, res) => {
  const { type, name, config = {} } = req.body;
  if (!type || !name?.trim()) return res.status(400).json({ error: 'type and name are required.' });
  const provider = await prisma.notificationProvider.create({
    data: { type, name: name.trim(), enabled: true, config },
  });
  res.json({ ...provider, config: maskProviderConfig(provider.type, provider.config) });
});

router.put('/notification-providers/:id', requireParentPassword, async (req, res) => {
  const { id } = req.params;
  const { name, enabled, config } = req.body;

  const existing = await prisma.notificationProvider.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Provider not found.' });

  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (enabled !== undefined) data.enabled = Boolean(enabled);
  if (config !== undefined) {
    const merged = { ...existing.config };
    for (const [k, v] of Object.entries(config)) {
      if (v !== undefined && v !== '') merged[k] = v;
    }
    data.config = merged;
  }

  const updated = await prisma.notificationProvider.update({ where: { id }, data });
  res.json({ ...updated, config: maskProviderConfig(updated.type, updated.config) });
});

router.delete('/notification-providers/:id', requireParentPassword, async (req, res) => {
  const { id } = req.params;
  await prisma.notificationProvider.delete({ where: { id } });
  res.json({ ok: true });
});

router.post('/notification-providers/:id/test', requireParentPassword, async (req, res) => {
  const { id } = req.params;
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

module.exports = router;
