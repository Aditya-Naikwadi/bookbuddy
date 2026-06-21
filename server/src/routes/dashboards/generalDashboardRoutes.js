const express = require('express');
const router = express.Router();
const { getGeneralDashboardSummary } = require('../../controllers/dashboards/generalDashboardController');

router.get('/', getGeneralDashboardSummary);

module.exports = router;
