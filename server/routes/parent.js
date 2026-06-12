const { Router } = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const requireParentPassword = require('../middleware/requireParentPassword');

const router = Router();

// ── OIDC discovery cache (per issuer) ────────────────────────────────────────

const _oidcCaches = new Map(); // issuer → { data, expiresAt }

async function discoverOidc(issuer) {
  const cached = _oidcCaches.get(issuer);
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  const url = issuer.includes('openid-configuration')
    ? issuer
    : `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  const data = await res.json();
  _oidcCaches.set(issuer, { data, expiresAt: Date.now() + 3600_000 });
  return data;
}

// ── OAuth state (carries providerId) ─────────────────────────────────────────

const _oauthStates = new Map(); // state → { expiresAt, providerId }
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _oauthStates) if (v.expiresAt < now) _oauthStates.delete(k);
}, 600_000);

function getAppUrl(req) {
  const cfg = process.env.APP_URL;
  if (cfg) return cfg.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers['host'] || 'localhost:8080'}`;
}

function maskProvider(p) {
  return { id: p.id, name: p.name, issuer: p.issuer, clientId: p.clientId, enabled: p.enabled, sortOrder: p.sortOrder, clientSecretSet: !!p.clientSecret };
}

// ── Status & Auth ─────────────────────────────────────────────────────────────

router.get('/parent/status', async (req, res) => {
  const parent = await prisma.parent.findFirst();
  res.json({ hasChanged: parent?.hasChanged ?? false });
});

router.post('/parent/login', async (req, res) => {
  const { username, password } = req.body;
  const parent = await prisma.parent.findUnique({ where: { username } });
  if (!parent) return res.json({ success: false });
  const isValid = await bcrypt.compare(password, parent.password);
  res.json({ success: isValid, hasChanged: parent.hasChanged });
});

router.get('/parent', async (req, res) => {
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent set' });
  res.json({ username: parent.username });
});

router.post('/parent/set', async (req, res) => {
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

router.post('/parent/reset', async (req, res) => {
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

// ── OAuth Providers (CRUD) ────────────────────────────────────────────────────

router.get('/parent/oauth/providers', async (req, res) => {
  const providers = await prisma.oAuthProvider.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(providers.map(maskProvider));
});

router.post('/parent/oauth/providers', requireParentPassword, async (req, res) => {
  const { name, issuer, clientId, clientSecret } = req.body;
  if (!name?.trim() || !issuer?.trim() || !clientId?.trim() || !clientSecret?.trim()) {
    return res.status(400).json({ error: 'name, issuer, clientId, and clientSecret are all required.' });
  }
  const count = await prisma.oAuthProvider.count();
  const provider = await prisma.oAuthProvider.create({
    data: { name: name.trim(), issuer: issuer.trim().replace(/\/$/, ''), clientId: clientId.trim(), clientSecret: clientSecret.trim(), sortOrder: count },
  });
  res.json(maskProvider(provider));
});

router.put('/parent/oauth/providers/:id', requireParentPassword, async (req, res) => {
  const { id } = req.params;
  const { name, issuer, clientId, clientSecret, enabled } = req.body;
  const existing = await prisma.oAuthProvider.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Provider not found.' });
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (issuer !== undefined) data.issuer = issuer.trim().replace(/\/$/, '');
  if (clientId !== undefined) data.clientId = clientId.trim();
  if (clientSecret?.trim()) data.clientSecret = clientSecret.trim();
  if (enabled !== undefined) data.enabled = Boolean(enabled);
  const updated = await prisma.oAuthProvider.update({ where: { id }, data });
  // Bust the OIDC discovery cache for this issuer
  _oidcCaches.delete(existing.issuer);
  res.json(maskProvider(updated));
});

router.delete('/parent/oauth/providers/:id', requireParentPassword, async (req, res) => {
  const { id } = req.params;
  await prisma.oAuthProvider.delete({ where: { id } });
  res.json({ ok: true });
});

// ── OAuth Login / Callback ────────────────────────────────────────────────────

router.get('/parent/oauth/login', async (req, res) => {
  const { provider: providerId } = req.query;

  let provider;
  if (providerId) {
    provider = await prisma.oAuthProvider.findUnique({ where: { id: String(providerId) } });
  } else {
    // Fall back to first enabled provider
    provider = await prisma.oAuthProvider.findFirst({ where: { enabled: true }, orderBy: { sortOrder: 'asc' } });
  }

  if (!provider || !provider.enabled) {
    return res.redirect(`${getAppUrl(req)}/?oauth_error=${encodeURIComponent('OAuth provider not configured or disabled.')}`);
  }

  try {
    const oidc = await discoverOidc(provider.issuer);
    const state = crypto.randomBytes(32).toString('hex');
    _oauthStates.set(state, { expiresAt: Date.now() + 600_000, providerId: provider.id });
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: `${getAppUrl(req)}/api/parent/oauth/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });
    res.redirect(`${oidc.authorization_endpoint}?${params}`);
  } catch (err) {
    console.error('[oauth] login:', err.message);
    res.redirect(`${getAppUrl(req)}/?oauth_error=${encodeURIComponent('Could not reach OAuth provider.')}`);
  }
});

router.get('/parent/oauth/callback', async (req, res) => {
  const appUrl = getAppUrl(req);
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent(`OAuth error: ${error}`)}`);

  const stateEntry = _oauthStates.get(state);
  if (!code || !state || !stateEntry) {
    return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent('Invalid or expired OAuth state.')}`);
  }
  _oauthStates.delete(state);

  const provider = await prisma.oAuthProvider.findUnique({ where: { id: stateEntry.providerId } });
  if (!provider) {
    return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent('OAuth provider no longer exists.')}`);
  }

  try {
    const oidc = await discoverOidc(provider.issuer);
    const redirectUri = `${appUrl}/api/parent/oauth/callback`;
    const tokenRes = await fetch(oidc.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: provider.clientId, client_secret: provider.clientSecret }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
    const tokens = await tokenRes.json();

    let email = null;
    if (tokens.id_token) {
      const p = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString());
      email = p.email;
    }
    if (!email && tokens.access_token && oidc.userinfo_endpoint) {
      const ui = await fetch(oidc.userinfo_endpoint, { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(5000) });
      if (ui.ok) email = (await ui.json()).email;
    }
    if (!email) return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent('OAuth provider did not return an email.')}`);

    const parent = await prisma.parent.findFirst();
    const allowed = (parent?.allowedEmails || []).map(e => e.toLowerCase());
    if (!allowed.includes(email.toLowerCase())) {
      return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent(`${email} is not authorized as a parent.`)}`);
    }
    res.redirect(`${appUrl}/?parent_authed=1`);
  } catch (err) {
    console.error('[oauth] callback:', err.message);
    res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent(`OAuth login failed: ${err.message}`)}`);
  }
});

// ── Legacy single-provider settings (kept for backward compatibility) ─────────
// These map old GET/POST /parent/oauth/settings to the new provider model.
// The frontend no longer calls these; they exist only for any external scripts.

router.get('/parent/oauth/settings', async (req, res) => {
  const providers = await prisma.oAuthProvider.findMany({ orderBy: { sortOrder: 'asc' } });
  const first = providers[0];
  res.json({
    oauthIssuer: first?.issuer || '',
    oauthClientId: first?.clientId || '',
    oauthClientSecretSet: !!first?.clientSecret,
    allowedEmails: (await prisma.parent.findFirst())?.allowedEmails || [],
  });
});

// ── Allowed emails ────────────────────────────────────────────────────────────

router.get('/parent/cf-emails', async (req, res) => {
  const parent = await prisma.parent.findFirst();
  res.json({ emails: parent?.allowedEmails || [] });
});

router.post('/parent/cf-emails', requireParentPassword, async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email.' });
  const parent = req.parent;
  const normalized = email.trim().toLowerCase();
  if (parent.allowedEmails.map(e => e.toLowerCase()).includes(normalized)) {
    return res.json({ emails: parent.allowedEmails });
  }
  const updated = await prisma.parent.update({
    where: { id: parent.id },
    data: { allowedEmails: { push: email.trim() } },
  });
  res.json({ emails: updated.allowedEmails });
});

router.delete('/parent/cf-emails/:email', requireParentPassword, async (req, res) => {
  const { email } = req.params;
  const parent = req.parent;
  const updated = await prisma.parent.update({
    where: { id: parent.id },
    data: { allowedEmails: parent.allowedEmails.filter(e => e.toLowerCase() !== email.toLowerCase()) },
  });
  res.json({ emails: updated.allowedEmails });
});

module.exports = router;
