const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

const scopeToTenant = (req, res, next) => {
  if (req.user && req.user.role !== 'super-admin' && req.user.role !== 'super_admin') {
    const rawCollegeId = req.user.collegeId;

    // Cross-tenant validation when request arrives on a tenant subdomain
    if (req.subdomainTenant && req.subdomainTenant._id) {
      if (!rawCollegeId || String(rawCollegeId) !== String(req.subdomainTenant._id)) {
        return next(
          new AppError(
            'Cross-tenant access violation: User credential belongs to a different institution.',
            403
          )
        );
      }
    }

    if (rawCollegeId && mongoose.Types.ObjectId.isValid(rawCollegeId)) {
      req.tenantFilter = { collegeId: rawCollegeId };
    } else {
      req.tenantFilter = { collegeId: rawCollegeId || null };
    }
  } else {
    req.tenantFilter = {};
  }
  next();
};

module.exports = scopeToTenant;
