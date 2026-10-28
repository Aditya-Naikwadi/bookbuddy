const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const bindTenantContext = require('../middlewares/tenantScoping');
const requireFeature = require('../middlewares/requireFeature');
const { FEATURE_FLAGS } = require('@bookbuddy/shared');

// All phased feature routes require authentication and multi-tenant scoping
router.use(protect);
router.use(bindTenantContext);

/**
 * Phased Feature Flag Protection Gateways
 * Returns 403 Forbidden if the feature is not explicitly enabled in the tenant's configuration.
 */

// Phase 1
router.get('/vernacular-i18n', requireFeature(FEATURE_FLAGS.VERNACULAR_I18N), (req, res) => {
  res.json({
    success: true,
    feature: FEATURE_FLAGS.VERNACULAR_I18N,
    message: 'Vernacular i18n access granted for tenant.',
  });
});

router.get('/accessibility-mode', requireFeature(FEATURE_FLAGS.ACCESSIBILITY_MODE), (req, res) => {
  res.json({
    success: true,
    feature: FEATURE_FLAGS.ACCESSIBILITY_MODE,
    message: 'Accessibility mode access granted for tenant.',
  });
});

router.get('/offline-sync', requireFeature(FEATURE_FLAGS.OFFLINE_SYNC), (req, res) => {
  res.json({
    success: true,
    feature: FEATURE_FLAGS.OFFLINE_SYNC,
    message: 'Offline sync gateway access granted for tenant.',
  });
});

router.get(
  '/reading-debt-nudges',
  requireFeature(FEATURE_FLAGS.READING_DEBT_NUDGES),
  (req, res) => {
    res.json({
      success: true,
      feature: FEATURE_FLAGS.READING_DEBT_NUDGES,
      message: 'Reading-debt nudges and badges access granted for tenant.',
    });
  }
);

// Phase 2
router.get('/predictive-alerts', requireFeature(FEATURE_FLAGS.PREDICTIVE_ALERTS), (req, res) => {
  res.json({
    success: true,
    feature: FEATURE_FLAGS.PREDICTIVE_ALERTS,
    message: 'Predictive stock-out alerts access granted for tenant.',
  });
});

router.get(
  '/analytics-expansion',
  requireFeature(FEATURE_FLAGS.ANALYTICS_EXPANSION),
  (req, res) => {
    res.json({
      success: true,
      feature: FEATURE_FLAGS.ANALYTICS_EXPANSION,
      message: 'Analytics expansion & daily snapshots access granted for tenant.',
    });
  }
);

router.get('/anomaly-detection', requireFeature(FEATURE_FLAGS.ANOMALY_DETECTION), (req, res) => {
  res.json({
    success: true,
    feature: FEATURE_FLAGS.ANOMALY_DETECTION,
    message: 'Security anomaly detection access granted for tenant.',
  });
});

router.get('/syllabus-scanner', requireFeature(FEATURE_FLAGS.SYLLABUS_SCANNER), (req, res) => {
  res.json({
    success: true,
    feature: FEATURE_FLAGS.SYLLABUS_SCANNER,
    message: 'Syllabus scanner access granted for tenant.',
  });
});

router.get('/qr-shelf-nav', requireFeature(FEATURE_FLAGS.QR_SHELF_NAV), (req, res) => {
  res.json({
    success: true,
    feature: FEATURE_FLAGS.QR_SHELF_NAV,
    message: 'QR shelf navigation access granted for tenant.',
  });
});

// Phase 3
router.get('/rag-ask-this-book', requireFeature(FEATURE_FLAGS.RAG_ASK_THIS_BOOK), (req, res) => {
  res.json({
    success: true,
    feature: FEATURE_FLAGS.RAG_ASK_THIS_BOOK,
    message: 'Ask This Book RAG gateway access granted for tenant.',
  });
});

module.exports = router;
