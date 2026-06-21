const express = require('express');
const router = express.Router();
const {
  getSystemOverview,
  createCollegeAdmin,
  getCollegeAdmins,
  getSystemAuditLogs
} = require('../../controllers/dashboards/adminPortalController');
const { protect, restrictTo } = require('../../middlewares/auth');

// Note: For a real Super Admin, you might want a distinct role 'super_admin'. 
// For now, we reuse the `admin` middleware.
router.use(protect, restrictTo('admin'));

router.route('/overview').get(getSystemOverview);
router.route('/admins')
  .get(getCollegeAdmins)
  .post(createCollegeAdmin);
router.route('/audit-logs').get(getSystemAuditLogs);

module.exports = router;
