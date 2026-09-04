// Permission middleware for role and sub-role capability checks.
const { requirePermission, requireRole } = require('./auth');

module.exports = {
  requirePermission,
  requireRole,
};
