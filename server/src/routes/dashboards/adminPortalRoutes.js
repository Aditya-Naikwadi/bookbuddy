const express = require('express');
const router = express.Router();
const {
  getOverview,
  getAdmins,
  createAdmin,
  createCollege,
  getAuditLogs,
  listColleges,
  getCollegeDetails,
  updateCollege,
  patchCollegeStatus,
  getGlobalPendingEResources,
  moderateEResourceGlobal,
  publishEResourceGlobal,
  getPendingOnboardings,
  approveTenantOnboarding,
  rejectTenantOnboarding,
  getUsers,
  updateUserStatus,
  updateUserRole,
  resetUserPassword,
  impersonateUser,
  getSystemHealth,
  getCronLogs,
  getGlobalLoans,
  getGlobalFines,
  getGlobalCatalog,
  getGlobalComplaints,
  updateComplaintStatus,
  getSystemSettings,
  updateSystemSettings,
  triggerManualBackup,
  updateCollegeTier,
  getPredictiveDemandForecast,
  triggerDatabaseRestore,
} = require('../../controllers/dashboards/adminPortalController');
const { protect, requireRole } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const auditLog = require('../../middlewares/auditLog');
const { createCollegeSchema, createAdminSchema } = require('../../validations/admin.validation');
const { rejectOnboardingSchema } = require('../../validations/registration.validation');
const { paramIdSchema } = require('../../validations/common.validation');

const { userLimiter, expensiveRouteLimiter } = require('../../middlewares/rateLimiters');

// Require authentication and super_admin privileges globally for these endpoints.
// Note: super_admin operates globally and does not scope to a specific tenantFilter.
router.use(protect, requireRole('super-admin'));
router.use(userLimiter);

router.route('/overview').get(expensiveRouteLimiter, getOverview);
router
  .route('/admins')
  .get(getAdmins)
  .post(validate(createAdminSchema), auditLog('admin.create'), createAdmin);
router
  .route('/colleges')
  .get(listColleges)
  .post(validate(createCollegeSchema), auditLog('college.create'), createCollege);
router.route('/colleges/:id').get(validate(paramIdSchema), getCollegeDetails);

router
  .route('/colleges/:id/tier')
  .put(validate(paramIdSchema), auditLog('college.update_tier'), updateCollegeTier);

router
  .route('/colleges/:id/status')
  .patch(validate(paramIdSchema), auditLog('college.patch_status'), patchCollegeStatus);

router.route('/audit-logs').get(expensiveRouteLimiter, getAuditLogs);

// Global content moderation routes
router.route('/moderation/pending').get(getGlobalPendingEResources);
router
  .route('/moderation/:id')
  .put(validate(paramIdSchema), auditLog('eresource.moderate'), moderateEResourceGlobal);
router
  .route('/moderation/:id/publish')
  .post(validate(paramIdSchema), auditLog('eresource.publish'), publishEResourceGlobal);

// Tenant onboarding review routes
router.route('/onboardings/pending').get(getPendingOnboardings);
router
  .route('/onboardings/:id/approve')
  .post(validate(paramIdSchema), auditLog('onboarding.approve'), approveTenantOnboarding);
router
  .route('/onboardings/:id/reject')
  .post(
    validate(paramIdSchema),
    validate(rejectOnboardingSchema),
    auditLog('onboarding.reject'),
    rejectTenantOnboarding
  );

// Global User Management routes
router.route('/users').get(getUsers);
router
  .route('/users/:id/status')
  .patch(validate(paramIdSchema), auditLog('user.patch_status'), updateUserStatus);
router
  .route('/users/:id/role')
  .patch(validate(paramIdSchema), auditLog('user.patch_role'), updateUserRole);
router
  .route('/users/:id/reset-password')
  .post(validate(paramIdSchema), auditLog('user.reset_password'), resetUserPassword);
router
  .route('/users/:id/impersonate')
  .post(validate(paramIdSchema), auditLog('user.impersonate'), impersonateUser);

// Infrastructure Telemetry & Cron Job routes
router.route('/system/health').get(getSystemHealth);
router.route('/system/cron-logs').get(getCronLogs);
router.route('/predictive-forecasting').get(getPredictiveDemandForecast);

// Data Oversight routes
router.route('/data/loans').get(expensiveRouteLimiter, getGlobalLoans);
router.route('/data/fines').get(expensiveRouteLimiter, getGlobalFines);
router.route('/data/catalog').get(expensiveRouteLimiter, getGlobalCatalog);

// Support & Complaints routes
router.route('/support/complaints').get(getGlobalComplaints);
router
  .route('/support/complaints/:id')
  .patch(validate(paramIdSchema), auditLog('complaint.resolve'), updateComplaintStatus);

// System Settings & Backup routes
router
  .route('/settings')
  .get(getSystemSettings)
  .put(auditLog('system_settings.update'), updateSystemSettings);
router
  .route('/settings/trigger-backup')
  .post(auditLog('system_backup.trigger'), triggerManualBackup);
router
  .route('/settings/trigger-restore')
  .post(auditLog('system_restore.trigger'), triggerDatabaseRestore);

module.exports = router;
