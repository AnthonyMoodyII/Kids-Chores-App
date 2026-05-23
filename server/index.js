const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const bcrypt = require('bcrypt');
const cron = require('node-cron');
const crypto = require('crypto');
require('dotenv').config();

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const DEFAULT_PARENT_USERNAME = 'parent';
const DEFAULT_PARENT_PASSWORD = 'changeme';

// Initialize parent credentials if not exist
async function initParent() {
  const existing = await prisma.parent.findFirst();
  if (!existing) {
    const initialUsername = process.env.PARENT_USERNAME || DEFAULT_PARENT_USERNAME;
    const initialPassword = process.env.PARENT_PASSWORD || DEFAULT_PARENT_PASSWORD;
    const hashedPassword = await bcrypt.hash(initialPassword, 10);
    await prisma.parent.create({
      data: {
        username: initialUsername,
        password: hashedPassword,
        hasChanged: false
      }
    });
    console.log('Parent credentials initialized');
  }
}

initParent().catch(console.error);

// --- Kids Endpoints ---

// Get all kids
app.get('/api/kids', async (req, res) => {
  const kids = await prisma.user.findMany({ where: { role: 'child' } });
  res.json(kids);
});

// Add a new kid
app.post('/api/kids', async (req, res) => {
  const { name } = req.body;
  const kid = await prisma.user.create({ data: { name, role: 'child' } });
  res.json(kid);
});

// Delete a kid and their associated chores
app.delete('/api/kids/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.user.delete({ where: { id } });
  res.sendStatus(200);
});

// --- Template Endpoints ---

// Get all chore templates
app.get('/api/templates', async (req, res) => {
  const templates = await prisma.choreTemplate.findMany();
  res.json(templates);
});

// Create a new chore template
app.post('/api/templates', async (req, res) => {
  const { title, baseValue, isMandatory } = req.body;
  const template = await prisma.choreTemplate.create({ data: { title, baseValue, isMandatory: isMandatory || false } });
  res.json(template);
});

// --- Chore Endpoints ---

// Get all active chores
app.get('/api/chores', async (req, res) => {
  const chores = await prisma.chore.findMany({ where: { isArchived: false } });
  res.json(chores);
});

// Delete chore template (when removing from library)
app.delete('/api/templates/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.choreTemplate.delete({ where: { id } });
  res.sendStatus(200);
});

// Toggle mandatory for chore template and assigned active chores
app.post('/api/templates/:id/toggle-mandatory', async (req, res) => {
  const { id } = req.params;
  const template = await prisma.choreTemplate.findUnique({ where: { id } });
  
  const updated = await prisma.choreTemplate.update({
    where: { id },
    data: { isMandatory: !template.isMandatory }
  });
  
  await prisma.chore.updateMany({
    where: { templateId: id, isArchived: false },
    data: { isMandatory: !template.isMandatory }
  });
  
  const templates = await prisma.choreTemplate.findMany();
  const chores = await prisma.chore.findMany({ where: { isArchived: false } });
  
  res.json({ templates, chores });
});

// Assign a template to multiple kids
app.post('/api/chores/assign', async (req, res) => {
  const { templateId, kidIds } = req.body;
  const template = await prisma.choreTemplate.findUnique({ where: { id: templateId } });
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const newChores = [];

  for (const kidId of kidIds) {
    const existing = await prisma.chore.findFirst({
      where: { templateId, assignedTo: kidId, isArchived: false }
    });

    if (existing) {
      continue; // skip duplicates for this kid/template pair
    }

    const chore = await prisma.chore.create({
      data: {
        title: template.title,
        baseValue: template.baseValue,
        isMandatory: template.isMandatory || false,
        templateId: template.id,
        assignedTo: kidId,
        completedDays: [],
        isApproved: false,
        isArchived: false
      }
    });
    newChores.push(chore);
  }

  res.json(newChores);
});

// Toggle a day completion for a chore
app.post('/api/chores/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const { day } = req.body;
  const chore = await prisma.chore.findUnique({ where: { id } });
  
  let newDays = [...chore.completedDays];
  if (newDays.includes(day)) {
    newDays = newDays.filter(d => d !== day);
  } else {
    newDays.push(day);
  }

  const updated = await prisma.chore.update({
    where: { id },
    data: { 
      completedDays: newDays,
      isApproved: newDays.length < 4 ? false : chore.isApproved
    }
  });
  res.json(updated);
});

// Approve a chore (Parent Portal)
app.post('/api/chores/:id/approve', async (req, res) => {
  const { id } = req.params;
  const chore = await prisma.chore.findUnique({ where: { id } });
  const updated = await prisma.chore.update({
    where: { id },
    data: { isApproved: !chore.isApproved }
  });
  res.json(updated);
});

// Reset week for all active chores
app.post('/api/chores/reset', async (req, res) => {
  await prisma.chore.updateMany({
    where: { isArchived: false },
    data: { completedDays: [], isApproved: false }
  });
  const allActive = await prisma.chore.findMany({ where: { isArchived: false } });
  res.json(allActive);
});

// Approve all eligible chores (>= 4 days completed, not yet approved)
app.post('/api/chores/approve-all', async (req, res) => {
  const candidates = await prisma.chore.findMany({
    where: { isArchived: false, isApproved: false }
  });
  const eligibleIds = candidates
    .filter(c => c.completedDays.length >= 4)
    .map(c => c.id);

  if (eligibleIds.length > 0) {
    await prisma.chore.updateMany({
      where: { id: { in: eligibleIds } },
      data: { isApproved: true }
    });
  }

  const allActive = await prisma.chore.findMany({ where: { isArchived: false } });
  res.json({ updatedCount: eligibleIds.length, chores: allActive });
});

// Unassign a template from multiple kids
app.post('/api/chores/unassign', async (req, res) => {
  const { templateId, kidIds } = req.body;
  if (!templateId || !Array.isArray(kidIds) || kidIds.length === 0) {
    return res.status(400).json({ error: 'templateId and kidIds are required' });
  }

  const result = await prisma.chore.updateMany({
    where: {
      templateId,
      assignedTo: { in: kidIds },
      isArchived: false
    },
    data: { isArchived: true }
  });

  const remaining = await prisma.chore.findMany({ where: { isArchived: false } });
  res.json({ removedCount: result.count, remaining });
});

// --- Payout Endpoints ---

// Get all payout history
app.get('/api/payouts', async (req, res) => {
  const payouts = await prisma.payoutRecord.findMany({ orderBy: { timestamp: 'desc' } });
  res.json(payouts);
});

// Delete a single payout entry
app.delete('/api/payouts/:id', async (req, res) => {
  const { id } = req.params;
  const result = await prisma.payoutRecord.deleteMany({ where: { id } });
  if (result.count === 0) return res.status(404).json({ error: 'Payout entry not found' });
  res.json({ deleted: result.count });
});

// Clear payout history for a child or all children
app.delete('/api/payouts', async (req, res) => {
  const { childId } = req.query;
  const where = childId ? { childId: String(childId) } : {};
  const result = await prisma.payoutRecord.deleteMany({ where });
  res.json({ deleted: result.count });
});

// Process payout for a kid
app.post('/api/payouts/:kidId', async (req, res) => {
  const { kidId } = req.params;
  const kid = await prisma.user.findUnique({ where: { id: kidId } });
  const approvedChores = await prisma.chore.findMany({
    where: { assignedTo: kidId, isApproved: true, isArchived: false }
  });

  const totalAmount = approvedChores.reduce((sum, c) => {
    // Shared calculation logic with frontend
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
      choresPaid: approvedChores.map(c => c.title)
    }
  });

  // Reset chores after payout instead of archiving so they remain assigned
  await prisma.chore.updateMany({
    where: { id: { in: approvedChores.map(c => c.id) } },
    data: { completedDays: [], isApproved: false }
  });

  const updatedChores = await prisma.chore.findMany({ where: { isArchived: false } });
  res.json({ payout, updatedChores });
});

// --- OIDC OAuth helpers ---

// OIDC discovery cache
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

// OAuth state store
const _oauthStates = new Map();
setInterval(() => { const now = Date.now(); for (const [k,v] of _oauthStates) if (v < now) _oauthStates.delete(k); }, 600_000);

function getAppUrl(req) {
  const cfg = process.env.APP_URL; if (cfg) return cfg.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers['host'] || 'localhost:8080'}`;
}

// --- Parent Endpoints ---

// Status — returns whether default credentials have been changed (no auth required)
app.get('/api/parent/status', async (req, res) => {
  const parent = await prisma.parent.findFirst();
  res.json({ hasChanged: parent?.hasChanged ?? false });
});

// GET /api/parent/oauth/login — initiates the OAuth flow
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

// GET /api/parent/oauth/callback — handles Google's redirect back
app.get('/api/parent/oauth/callback', async (req, res) => {
  const appUrl = getAppUrl(req);
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent(`OAuth error: ${error}`)}`);
  if (!code || !state || !_oauthStates.has(state)) return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent('Invalid or expired OAuth state. Please try again.')}`);
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
      console.log(`[auth] OAuth denied for ${email}`);
      return res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent(`${email} is not authorized as a parent. Add this email in OAuth Settings.`)}`);
    }
    console.log(`[auth] OAuth sign-in by ${email}`);
    res.redirect(`${appUrl}/?parent_authed=1`);
  } catch (err) {
    console.error('[oauth] callback:', err.message);
    res.redirect(`${appUrl}/?oauth_error=${encodeURIComponent(`OAuth login failed: ${err.message}`)}`);
  }
});

// GET /api/parent/oauth/settings — returns current config (secret masked)
app.get('/api/parent/oauth/settings', async (req, res) => {
  const parent = await prisma.parent.findFirst();
  res.json({ oauthIssuer: parent?.oauthIssuer || '', oauthClientId: parent?.oauthClientId || '', oauthClientSecretSet: !!(parent?.oauthClientSecret), allowedEmails: parent?.allowedEmails || [] });
});

// POST /api/parent/oauth/settings — update OAuth config (requires password)
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
  _oidcCache = null; // bust cache when config changes
  res.json({ success: true });
});

// Get allowed CF emails
app.get('/api/parent/cf-emails', async (req, res) => {
  const parent = await prisma.parent.findFirst();
  res.json({ emails: parent?.allowedEmails || [] });
});

// Add an email to the allowed CF list
app.post('/api/parent/cf-emails', async (req, res) => {
  const { email, currentPassword } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email.' });
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent found.' });
  const isValid = await bcrypt.compare(currentPassword, parent.password);
  if (!isValid) return res.status(403).json({ error: 'Current password is incorrect.' });
  const normalized = email.trim().toLowerCase();
  if (parent.allowedEmails.map(e => e.toLowerCase()).includes(normalized)) {
    return res.json({ emails: parent.allowedEmails }); // already there
  }
  const updated = await prisma.parent.update({
    where: { id: parent.id },
    data: { allowedEmails: { push: email.trim() } },
  });
  res.json({ emails: updated.allowedEmails });
});

// Remove an email from the allowed CF list
app.delete('/api/parent/cf-emails/:email', async (req, res) => {
  const { email } = req.params;
  const { currentPassword } = req.body;
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent found.' });
  const isValid = await bcrypt.compare(currentPassword, parent.password);
  if (!isValid) return res.status(403).json({ error: 'Current password is incorrect.' });
  const updated = await prisma.parent.update({
    where: { id: parent.id },
    data: { allowedEmails: parent.allowedEmails.filter(e => e.toLowerCase() !== email.toLowerCase()) },
  });
  res.json({ emails: updated.allowedEmails });
});

// Login
app.post('/api/parent/login', async (req, res) => {
  const { username, password } = req.body;
  const parent = await prisma.parent.findUnique({ where: { username } });
  if (!parent) return res.json({ success: false });
  const isValid = await bcrypt.compare(password, parent.password);
  res.json({ success: isValid, hasChanged: parent.hasChanged });
});

// Get current parent (for checking if set)
app.get('/api/parent', async (req, res) => {
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent set' });
  res.json({ username: parent.username });
});

// Set new credentials — requires current password to prevent unauthorized changes
app.post('/api/parent/set', async (req, res) => {
  const { username, password, currentPassword } = req.body;
  const parent = await prisma.parent.findFirst();
  // If a parent record exists, verify the current password before allowing change
  if (parent && currentPassword !== undefined) {
    const isValid = await bcrypt.compare(currentPassword, parent.password);
    if (!isValid) return res.status(403).json({ success: false, error: 'Current password is incorrect.' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  if (parent) {
    await prisma.parent.update({
      where: { id: parent.id },
      data: { username, password: hashedPassword, hasChanged: true }
    });
  } else {
    await prisma.parent.create({
      data: { username, password: hashedPassword, hasChanged: true }
    });
  }
  res.json({ success: true });
});

// Emergency reset — requires PARENT_RESET_CODE env var (set in docker-compose.yml)
app.post('/api/parent/reset', async (req, res) => {
  const { resetCode, username, password } = req.body;
  const expectedCode = process.env.PARENT_RESET_CODE;
  if (!expectedCode) {
    return res.status(503).json({ success: false, error: 'Reset code not configured on this server.' });
  }
  if (!resetCode || resetCode !== expectedCode) {
    return res.status(403).json({ success: false, error: 'Invalid reset code.' });
  }
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const parent = await prisma.parent.findFirst();
  if (parent) {
    await prisma.parent.update({
      where: { id: parent.id },
      data: { username, password: hashedPassword, hasChanged: true }
    });
  } else {
    await prisma.parent.create({
      data: { username, password: hashedPassword, hasChanged: true }
    });
  }
  console.log('[security] Parent credentials reset via emergency reset code.');
  res.json({ success: true });
});

// --- Cash Payment Endpoints ---

// Get all cash payments (optionally filtered by childId)
app.get('/api/cash-payments', async (req, res) => {
  const { childId } = req.query;
  const where = childId ? { childId: String(childId) } : {};
  const payments = await prisma.cashPayment.findMany({ where, orderBy: { timestamp: 'desc' } });
  res.json(payments);
});

// Log a new cash payment
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

// Delete a cash payment entry
app.delete('/api/cash-payments/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.cashPayment.delete({ where: { id } });
  res.sendStatus(200);
});

// --- Auto Weekly Close-Out (Sunday midnight) ---
// Order: approve all eligible → payout each kid → reset chores

async function runWeeklyCloseOut() {
  console.log('[cron] Starting weekly close-out...');

  // 1. Approve all eligible chores (>= 4 days, not yet approved)
  const candidates = await prisma.chore.findMany({ where: { isArchived: false, isApproved: false } });
  const eligibleIds = candidates.filter(c => c.completedDays.length >= 4).map(c => c.id);
  if (eligibleIds.length > 0) {
    await prisma.chore.updateMany({ where: { id: { in: eligibleIds } }, data: { isApproved: true } });
    console.log(`[cron] Approved ${eligibleIds.length} chore(s).`);
  }

  // 2. Process payout for each kid who has approved chores
  const kids = await prisma.user.findMany({ where: { role: 'child' } });
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

    console.log(`[cron] Paid out $${totalAmount.toFixed(2)} to ${kid.name}.`);
  }

  // 3. Reset any remaining unapproved chores
  await prisma.chore.updateMany({
    where: { isArchived: false },
    data: { completedDays: [], isApproved: false },
  });

  console.log('[cron] Weekly close-out complete.');
}

// Schedule: Sunday at midnight (00:00)
cron.schedule('0 0 * * 0', runWeeklyCloseOut, { timezone: 'America/Chicago' });

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});