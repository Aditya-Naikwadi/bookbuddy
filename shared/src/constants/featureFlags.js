/**
 * Canonical Feature Flag Keys for BookBuddy
 * Single source of truth shared by backend, frontend, and tests.
 * All newly introduced features sit behind per-college feature flags and are OFF by default.
 */

const FEATURE_FLAGS = Object.freeze({
  // Core / Baseline Existing Features
  CATALOG: 'catalog',
  LOANS: 'loans',
  FINES: 'fines',
  PATRON_CARD: 'patron-card',
  E_RESOURCES: 'e-resources',
  READING_LISTS: 'reading-lists',
  RECOMMENDATIONS: 'recommendations',
  FACILITIES: 'facilities',
  SUPPORT: 'support',
  GAMIFICATION: 'gamification',
  ANALYTICS: 'analytics',
  ACQUISITIONS: 'acquisitions',

  // Phase 1 Features (Off by Default)
  VERNACULAR_I18N: 'vernacular-i18n',
  ACCESSIBILITY_MODE: 'accessibility-mode',
  OFFLINE_SYNC: 'offline-sync',
  READING_DEBT_NUDGES: 'reading-debt-nudges',

  // Phase 2 Features (Off by Default)
  PREDICTIVE_ALERTS: 'predictive-alerts',
  ANALYTICS_EXPANSION: 'analytics-expansion',
  ANOMALY_DETECTION: 'anomaly-detection',
  SYLLABUS_SCANNER: 'syllabus-scanner',
  QR_SHELF_NAV: 'qr-shelf-nav',

  // Phase 3 Features (Off by Default)
  RAG_ASK_THIS_BOOK: 'rag-ask-this-book',
});

// The list of all approved new features (Phases 1-3), all strictly off by default
const PHASED_FEATURE_KEYS = Object.freeze([
  FEATURE_FLAGS.VERNACULAR_I18N,
  FEATURE_FLAGS.ACCESSIBILITY_MODE,
  FEATURE_FLAGS.OFFLINE_SYNC,
  FEATURE_FLAGS.READING_DEBT_NUDGES,
  FEATURE_FLAGS.PREDICTIVE_ALERTS,
  FEATURE_FLAGS.ANALYTICS_EXPANSION,
  FEATURE_FLAGS.ANOMALY_DETECTION,
  FEATURE_FLAGS.SYLLABUS_SCANNER,
  FEATURE_FLAGS.QR_SHELF_NAV,
  FEATURE_FLAGS.RAG_ASK_THIS_BOOK,
]);

module.exports = {
  FEATURE_FLAGS,
  PHASED_FEATURE_KEYS,
};

