const express = require('express');
const router = express.Router();
const {
  getGeneralDashboardData,
  getCollegeDashboard,
} = require('../../controllers/dashboards/generalDashboardController');
const { generalDashboardLimiter } = require('../../middlewares/rateLimiters');
const scopeToTenant = require('../../middlewares/scopeToTenant');
const { optionalAuth } = require('../../middlewares/auth');

// Single aggregated dashboard route (Tenant Scoped & Rate Limited)
router.get(
  '/:id/dashboard',
  generalDashboardLimiter,
  optionalAuth,
  scopeToTenant,
  getCollegeDashboard
);
router.get(
  '/college/:id/dashboard',
  generalDashboardLimiter,
  optionalAuth,
  scopeToTenant,
  getCollegeDashboard
);

// Public / General route to fetch aggregated home dashboard data (protected by rate limiter)
router.get('/home-data', generalDashboardLimiter, getGeneralDashboardData);

module.exports = router;
