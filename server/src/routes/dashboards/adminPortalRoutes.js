const express = require('express');
const router = express.Router();
const { getAdminDashboardSummary } = require('../../controllers/dashboards/adminPortalController');
const { protect } = require('../../middlewares/auth');

// Note: In a real app, you would add an admin-only middleware here
router.get('/', protect, getAdminDashboardSummary);

module.exports = router;
