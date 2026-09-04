const mongoose = require('mongoose');

const scopeToTenant = (req, res, next) => {
  if (req.user && req.user.role !== 'super-admin' && req.user.role !== 'super_admin') {
    const rawCollegeId = req.user.collegeId;
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
