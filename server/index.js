const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const bcrypt = require('bcrypt');
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
  const { title, baseValue } = req.body;
  const template = await prisma.choreTemplate.create({ data: { title, baseValue } });
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

// --- Parent Endpoints ---

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

// Set new credentials
app.post('/api/parent/set', async (req, res) => {
  const { username, password } = req.body;
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
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});