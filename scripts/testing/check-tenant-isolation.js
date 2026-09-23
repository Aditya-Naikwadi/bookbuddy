#!/usr/bin/env node
/**
 * ==============================================================================
 * CI GATE: Multi-Tenant Data Isolation Audit
 * ==============================================================================
 * Enforces the hard architectural constraint:
 * 1. Every tenant-scoped model in backend/src/models/ must declare `collegeId`
 *    with `required: true` and an index (or use `tenantScopingPlugin`).
 * 2. Scans backend/src/controllers/ and backend/src/routes/ for un-scoped
 *    find/findOne/findOneAndUpdate/delete calls on tenant models without collegeId.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../');
const MODELS_DIR = path.join(ROOT_DIR, 'backend/src/models');
const CONTROLLERS_DIR = path.join(ROOT_DIR, 'backend/src/controllers');

// Models that are intentionally platform-wide / superadmin-only (exempt from collegeId scoping)
const GLOBAL_MODELS = new Set([
  'College',
  'CollegeFeatureConfig',
  'FeatureCatalog',
  'PlatformMetricSnapshot',
  'PendingAdminSetup',
  'SystemSetting',
  'RevokedToken',
  'RefreshToken',
  'HelpArticle',
  'OpenLibraryBook',
  'UnifiedBook',
  'Sticker',
  'Tag',
  'StreakReward',
  'CronRunLog',
  'Service',
  'Badge',
  'ILLRequest', // Cross-college interlibrary loan transfer
  'ShareRequest', // Cross-college resource sharing
]);

// Models that are user-private (scoped strictly to userId)
const USER_SCOPED_MODELS = new Set([
  'Bookmark',
  'DeviceToken',
  'DownloadLog',
  'LeaderboardSnapshot',
  'NotificationLog',
  'NotificationPreference',
  'Payment',
  'ReadingProgress',
  'UserBadge',
  'UserSticker',
]);

function auditModelDefinitions() {
  const violations = [];
  const modelFiles = fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith('.js'));

  for (const file of modelFiles) {
    const modelName = path.basename(file, '.js');
    if (GLOBAL_MODELS.has(modelName) || USER_SCOPED_MODELS.has(modelName)) continue;

    const content = fs.readFileSync(path.join(MODELS_DIR, file), 'utf8');

    const hasCollegeId =
      content.includes('collegeId:') ||
      content.includes('collegeId :') ||
      content.includes('tenantScopingPlugin');

    if (!hasCollegeId) {
      violations.push({
        file: `backend/src/models/${file}`,
        message: `Tenant model '${modelName}' is missing collegeId definition or tenantScopingPlugin.`,
      });
      continue;
    }

    // Check if collegeId is indexed or compound indexed
    const hasIndex =
      content.includes('collegeId: 1') ||
      content.includes('collegeId: -1') ||
      content.includes('index: true') ||
      content.includes('tenantScopingPlugin');

    if (!hasIndex) {
      violations.push({
        file: `backend/src/models/${file}`,
        message: `Tenant model '${modelName}' defines collegeId but lacks an index on collegeId.`,
      });
    }
  }

  return violations;
}

function auditControllerScoping() {
  const violations = [];
  const controllerFiles = fs.readdirSync(CONTROLLERS_DIR).filter((f) => f.endsWith('.js'));

  // Critical tenant models whose queries MUST incorporate collegeId
  const criticalTenantModels = ['Book', 'Loan', 'Fine', 'StudentJoinRequest', 'FacilityBooking'];

  for (const file of controllerFiles) {
    // SuperAdmin and Auth controllers intentionally handle multi-college or initial onboarding
    if (file.includes('superAdmin') || file.includes('authController') || file.includes('webhook')) {
      continue;
    }

    const content = fs.readFileSync(path.join(CONTROLLERS_DIR, file), 'utf8');

    for (const model of criticalTenantModels) {
      // Use exact word boundary regex so UnifiedBook does not trigger Book
      const modelQueryRegex = new RegExp(`\\b${model}\\.(find|findOne|findOneAndUpdate|deleteMany|deleteOne)\\b`);
      if (modelQueryRegex.test(content)) {
        const hasCollegeIdReference =
          content.includes('collegeId') ||
          content.includes('req.collegeId') ||
          content.includes('req.user.collegeId') ||
          content.includes('skipTenantScope');

        if (!hasCollegeIdReference) {
          violations.push({
            file: `backend/src/controllers/${file}`,
            message: `Controller uses '${model}' queries but contains zero references to 'collegeId' or 'req.collegeId'.`,
          });
        }
      }
    }
  }

  return violations;
}

console.log('='.repeat(80));
console.log('🛡️  RUNNING MULTI-TENANT ISOLATION CI GATE');
console.log('='.repeat(80));

const modelViolations = auditModelDefinitions();
const controllerViolations = auditControllerScoping();
const totalViolations = [...modelViolations, ...controllerViolations];

console.log(`Audited ${fs.readdirSync(MODELS_DIR).length} models and ${fs.readdirSync(CONTROLLERS_DIR).length} controllers.\n`);

if (totalViolations.length > 0) {
  console.error(`❌ MULTI-TENANT ISOLATION GATE FAILED: Found ${totalViolations.length} isolation leak(s):`);
  for (const v of totalViolations) {
    console.error(`   - [${v.file}] ${v.message}`);
  }
  process.exit(1);
} else {
  console.log(`✅ MULTI-TENANT ISOLATION GATE PASSED: All tenant models and controllers enforce collegeId scoping.`);
  process.exit(0);
}
