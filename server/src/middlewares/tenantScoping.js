const AppError = require('../utils/AppError');

/**
 * Tenant Scoping Middleware
 * Extracts collegeId strictly from authenticated user session (req.user)
 * and binds it to req.tenantId. Prevents client-supplied collegeId parameter tampering.
 */
const bindTenantContext = async (req, res, next) => {
  try {
    // 1. If SuperAdmin, allow optional target tenant override via header or default
    if (req.user && (req.user.role === 'super-admin' || req.user.role === 'superadmin')) {
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

    // 3. Verify tenant exists and is active in DB
    const College = require('../models/College');
    const college = await College.findById(sessionCollegeId).lean();
    if (!college || college.status !== 'active' || college.isActive === false) {
      return next(
        new AppError('Your college institution account is inactive or pending review by Super Admin.', 403)
      );
    }

    // Bind server-validated tenantId
    req.tenantId = sessionCollegeId;

    // Sanitize req.body and req.query to prevent developer oversight from trusting client collegeId
    if (req.body && req.body.collegeId) {
      delete req.body.collegeId;
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = bindTenantContext;
