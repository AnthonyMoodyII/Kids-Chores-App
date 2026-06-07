const { Router } = require('express');
const prisma = require('../lib/prisma');

const router = Router();

router.get('/kids', async (req, res) => {
  const kids = await prisma.user.findMany({ where: { role: 'child' } });
  res.json(kids);
});

router.post('/kids', async (req, res) => {
  const { name } = req.body;
  const kid = await prisma.user.create({ data: { name, role: 'child' } });
  res.json(kid);
});

router.delete('/kids/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.user.delete({ where: { id } });
  res.sendStatus(200);
});

module.exports = router;
