// Middleware to inject tenant filters for non-super-admins.
const scopeToTenant = (req, res, next) => {
  if (req.user && req.user.role !== 'super-admin' && req.user.role !== 'super_admin') {
    req.tenantFilter = { collegeId: req.user.collegeId };
  } else {
    req.tenantFilter = {};
  }
  next();
};

module.exports = scopeToTenant;
