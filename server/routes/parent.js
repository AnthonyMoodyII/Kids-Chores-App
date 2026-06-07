const { Router } = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const requireParentPassword = require('../middleware/requireParentPassword');

const router = Router();

// ── OIDC OAuth cache + state ──────────────────────────────────────────────────

let _oidcCache = null, _oidcCacheExpiry = 0;

async function discoverOidc(issuer) {
  if (_oidcCache && Date.now() < _oidcCacheExpiry) return _oidcCache;
  const url = issuer.includes('openid-configuration')
    ? issuer
    : `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  _oidcCache = await res.json();
  _oidcCacheExpiry = Date.now() + 3600_000;
  return _oidcCache;
}

const _oauthStates = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _oauthStates) if (v < now) _oauthStates.delete(k);
}, 600_000);

function getAppUrl(req) {
  const cfg = process.env.APP_URL;
  if (cfg) return cfg.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers['host'] || 'localhost:8080'}`;
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

// ── OAuth ─────────────────────────────────────────────────────────────────────

router.get('/parent/oauth/login', async (req, res) => {
  const parent = await prisma.parent.findFirst();
  const issuer = parent?.oauthIssuer, clientId = parent?.oauthClientId;
  if (!issuer || !clientId) {
    return res.redirect(`${getAppUrl(req)}/?oauth_error=${encodeURIComponent('OAuth is not configured. Set it up in the parent portal.')}`);
  }
  try {
    const oidc = await discoverOidc(issuer);
    const state = crypto.randomBytes(32).toString('hex');
    _oauthStates.set(state, Date.now() + 600_000);
    const params = new URLSearchParams({
      client_id: clientId,
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
  if (!code || !state || !_oauthStates.has(state)) {
    return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent('Invalid or expired OAuth state.')}`);
  }
  _oauthStates.delete(state);
  const parent = await prisma.parent.findFirst();
  const { oauthIssuer: issuer, oauthClientId: clientId, oauthClientSecret: clientSecret } = parent || {};
  if (!issuer || !clientId || !clientSecret) {
    return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent('OAuth not configured.')}`);
  }
  try {
    const oidc = await discoverOidc(issuer);
    const redirectUri = `${appUrl}/api/parent/oauth/callback`;
    const tokenRes = await fetch(oidc.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }),
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

router.get('/parent/oauth/settings', async (req, res) => {
  const parent = await prisma.parent.findFirst();
  res.json({
    oauthIssuer: parent?.oauthIssuer || '',
    oauthClientId: parent?.oauthClientId || '',
    oauthClientSecretSet: !!(parent?.oauthClientSecret),
    allowedEmails: parent?.allowedEmails || [],
  });
});

router.post('/parent/oauth/settings', requireParentPassword, async (req, res) => {
  const { oauthIssuer, oauthClientId, oauthClientSecret, clearCredentials } = req.body;
  const parent = req.parent;
  const data = {};
  if (clearCredentials) {
    data.oauthIssuer = null;
    data.oauthClientId = null;
    data.oauthClientSecret = null;
  } else {
    if (oauthIssuer !== undefined) data.oauthIssuer = oauthIssuer.trim() || null;
    if (oauthClientId !== undefined) data.oauthClientId = oauthClientId.trim() || null;
    if ('oauthClientSecret' in req.body) data.oauthClientSecret = oauthClientSecret?.trim() || null;
  }
  await prisma.parent.update({ where: { id: parent.id }, data });
  _oidcCache = null;
  res.json({ success: true });
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
