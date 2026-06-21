const express = require('express');
const router = express.Router();
const { getCollegeAdminDashboardSummary } = require('../../controllers/dashboards/collegeAdminController');
const { protect } = require('../../middlewares/auth');

router.get('/', protect, getCollegeAdminDashboardSummary);

module.exports = router;
