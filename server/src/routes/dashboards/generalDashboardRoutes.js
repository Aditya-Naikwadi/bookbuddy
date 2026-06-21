const express = require('express');
const router = express.Router();
const {
  searchPublicCatalog,
  getPublicEResources,
  getGeneralDashboardSummary
} = require('../../controllers/dashboards/generalDashboardController');

// All General Dashboard routes are PUBLIC (no auth middleware)

router.route('/search').get(searchPublicCatalog);
router.route('/eresources').get(getPublicEResources);
router.route('/summary').get(getGeneralDashboardSummary);

module.exports = router;
