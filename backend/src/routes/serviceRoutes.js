const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middlewares/auth');
const {
  getAvailableServices,
  getCollegeFeaturesHandler,
  updateCollegeFeaturesHandler,
} = require('../controllers/serviceController');

// Service catalog listing
router.get('/available', getAvailableServices);

// College feature management routes
router.get('/college/:id/features', protect, getCollegeFeaturesHandler);
router.patch(
  '/college/:id/features',
  protect,
  requireRole('college-admin', 'super-admin', 'super_admin'),
  updateCollegeFeaturesHandler
);

module.exports = router;
