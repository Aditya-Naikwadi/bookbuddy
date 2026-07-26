const express = require('express');
const router = express.Router();
const {
  getMyCollegeConfig,
  enableOrRequestFeature,
  getPublicCollegeBySlug,
  checkSlugAvailability,
} = require('../controllers/collegeFeatureController');

const { protect, restrictTo } = require('../middlewares/auth');
const bindTenantContext = require('../middlewares/tenantScoping');

// Public endpoints
router.get('/slug-check', checkSlugAvailability);
router.get('/public/:slug', getPublicCollegeBySlug);

// Authenticated College Admin endpoints
router.get(
  '/my-config',
  protect,
  restrictTo('collegeadmin', 'superadmin'),
  bindTenantContext,
  getMyCollegeConfig
);
router.post(
  '/features/enable',
  protect,
  restrictTo('collegeadmin', 'superadmin'),
  bindTenantContext,
  enableOrRequestFeature
);

module.exports = router;
