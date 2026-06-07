const nodemailer = require('nodemailer');
const prisma = require('./prisma');

// ── Base URL ───────────────────────────────────────────────────────────────────
function getBaseUrl() {
  return (process.env.APP_URL || 'http://localhost:8080').replace(/\/$/, '');
}

// ── Notification settings ──────────────────────────────────────────────────────
async function getNotifSettings() {
  return prisma.notificationSettings.findUnique({ where: { id: 'singleton' } });
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

// ── Transport helpers ──────────────────────────────────────────────────────────
async function sendPushover(title, message, actionUrl = null) {
  try {
    const ns = await getNotifSettings();
    if (!ns || !ns.pushoverEnabled || !ns.pushoverAppToken || !ns.pushoverUserKey) return;
    const body = { token: ns.pushoverAppToken, user: ns.pushoverUserKey, title, message };
    if (actionUrl) { body.url = actionUrl; body.url_title = '✅ Approve now'; }
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
    await transporter.sendMail({ from: ns.smtpFrom, to: ns.smtpFrom, subject, html: htmlBody, text: textBody });
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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ title, message: fullMessage, priority: Number(priority), extras: { 'client::display': { contentType: 'text/markdown' } } }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.error(`[gotify:${provider.name}] send error:`, err.message);
  }
}

// ── Fan-out notifier ───────────────────────────────────────────────────────────
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

module.exports = { getBaseUrl, getNotifSettings, buildEmail, approveButtons, sendPushover, sendEmail, sendGotify, notify };
