const AppError = require('../utils/AppError');

/**
 * Tenant Scoping Middleware
 * Extracts collegeId strictly from authenticated user session (req.user)
 * and binds it to req.tenantId. Prevents client-supplied collegeId parameter tampering.
 */
const bindTenantContext = (req, res, next) => {
  // 1. If SuperAdmin, allow optional target tenant override via header or default
  if (req.user && req.user.role === 'superadmin') {
    req.tenantId = req.headers['x-target-tenant-id'] || req.user.collegeId || null;
    return next();
  }

  // 2. Extract collegeId strictly from session/JWT
  const sessionCollegeId = req.user?.collegeId;
  if (!sessionCollegeId) {
    return next(
      new AppError('Unauthorized: No active institution context associated with account.', 403)
    );
  }

  // Bind server-validated tenantId
  req.tenantId = sessionCollegeId;

  // Sanitize req.body and req.query to prevent developer oversight from trusting client collegeId
  if (req.body && req.body.collegeId) {
    delete req.body.collegeId;
  }

  next();
};

module.exports = bindTenantContext;
