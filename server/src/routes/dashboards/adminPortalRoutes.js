const express = require('express');
const router = express.Router();
const {
  getSystemOverview,
  createCollegeAdmin,
  getCollegeAdmins,
  getSystemAuditLogs
} = require('../../controllers/dashboards/adminPortalController');
const { protect, restrictTo } = require('../../middlewares/auth');

// Note: 'super-admin' acts as the Super Admin verifier. We also support 'admin' as a fallback.
router.use(protect, restrictTo('super-admin', 'admin'));

router.route('/overview').get(getSystemOverview);
router.route('/admins')
  .get(getCollegeAdmins)
  .post(createCollegeAdmin);
router.route('/audit-logs').get(getSystemAuditLogs);

module.exports = router;
