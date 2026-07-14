const express = require('express');
const router = express.Router();
const {
  getOverview,
  getAdmins,
  createAdmin,
  createCollege,
  getAuditLogs,
} = require('../../controllers/dashboards/adminPortalController');
const { protect, requireRole } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const auditLog = require('../../middlewares/auditLog');
const { createCollegeSchema, createAdminSchema } = require('../../validations/admin.validation');

const { userLimiter, expensiveRouteLimiter } = require('../../middlewares/rateLimiters');

// Require authentication and super_admin privileges globally for these endpoints.
// Note: super_admin operates globally and does not scope to a specific tenantFilter.
router.use(protect, requireRole('super-admin'));
router.use(userLimiter);

router.route('/overview').get(expensiveRouteLimiter, getOverview);
router.route('/admins').get(getAdmins).post(validate(createAdminSchema), auditLog('college_admin.create'), createAdmin);
router.route('/colleges').post(validate(createCollegeSchema), auditLog('college.create'), createCollege);
router.route('/audit-logs').get(expensiveRouteLimiter, getAuditLogs);

module.exports = router;
