const express = require('express');
const router = express.Router();
const { getGeneralDashboardData } = require('../../controllers/dashboards/generalDashboardController');

// Public / General route to fetch aggregated home dashboard data
router.get('/home-data', getGeneralDashboardData);

module.exports = router;
