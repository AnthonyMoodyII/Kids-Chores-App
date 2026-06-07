const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');

/**
 * Express middleware that reads `currentPassword` from req.body,
 * verifies it against the stored parent hash, and attaches `req.parent`
 * on success. Returns 404 / 403 on failure so the route handler never runs.
 */
async function requireParentPassword(req, res, next) {
  const { currentPassword } = req.body;
  const parent = await prisma.parent.findFirst();
  if (!parent) return res.status(404).json({ error: 'No parent found.' });
  const isValid = await bcrypt.compare(currentPassword, parent.password);
  if (!isValid) return res.status(403).json({ error: 'Current password is incorrect.' });
  req.parent = parent;
  next();
}

module.exports = requireParentPassword;
