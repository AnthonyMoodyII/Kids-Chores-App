const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const cron = require('node-cron');
require('dotenv').config();

const prisma = require('./lib/prisma');
const { optionalDollarPerCompletion, getWeekOf } = require('./lib/helpers');
const { notify } = require('./lib/notify');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Startup: seed parent + default rewards ────────────────────────────────────

const DEFAULT_PARENT_USERNAME = 'parent';
const DEFAULT_PARENT_PASSWORD = 'changeme';

async function initParent() {
  const existing = await prisma.parent.findFirst();
  if (!existing) {
    const hashedPassword = await bcrypt.hash(process.env.PARENT_PASSWORD || DEFAULT_PARENT_PASSWORD, 10);
    await prisma.parent.create({
      data: { username: process.env.PARENT_USERNAME || DEFAULT_PARENT_USERNAME, password: hashedPassword, hasChanged: false },
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

async function migrateOAuthToProviders() {
  const parent = await prisma.parent.findFirst();
  if (!parent?.oauthIssuer || !parent?.oauthClientId || !parent?.oauthClientSecret) return;
  const count = await prisma.oAuthProvider.count();
  if (count > 0) return; // already migrated
  await prisma.oAuthProvider.create({
    data: {
      name: 'Google',
      issuer: parent.oauthIssuer.replace(/\/$/, ''),
      clientId: parent.oauthClientId,
      clientSecret: parent.oauthClientSecret,
      enabled: true,
      sortOrder: 0,
    },
  });
  console.log('[oauth] Migrated legacy Google OAuth credentials to OAuthProvider table');
}

initParent().catch(console.error);
seedRewards().catch(console.error);
migrateOAuthToProviders().catch(console.error);

// ── Routes (all mounted at /api) ──────────────────────────────────────────────

app.use('/api', require('./routes/kids'));
app.use('/api', require('./routes/chores'));
app.use('/api', require('./routes/payouts'));
app.use('/api', require('./routes/dailySelections'));
app.use('/api', require('./routes/points'));
app.use('/api', require('./routes/notifications'));
app.use('/api', require('./routes/parent'));

// ── Weekly close-out cron ─────────────────────────────────────────────────────

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
      data: { childId: kid.id, childName: kid.name, amount: Math.round(totalAmount * 100) / 100, choresPaid: choreNames },
    });
    await prisma.chore.updateMany({
      where: { id: { in: approvedChores.map(c => c.id) } },
      data: { completedDays: [], isApproved: false },
    });

    const ledger = await prisma.pointLedger.findMany({ where: { childId: kid.id } });
    const pts = ledger.reduce((s, e) => s + e.amount, 0);
    summaryLines.push(`${kid.name}: $${totalAmount.toFixed(2)} earned, ${pts} pts balance`);
    console.log(`[cron] Paid out $${totalAmount.toFixed(2)} to ${kid.name}.`);
  }

  await prisma.chore.updateMany({ where: { isArchived: false }, data: { completedDays: [], isApproved: false } });
  await prisma.dailyChoreSelection.deleteMany({ where: { weekOf } });

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
