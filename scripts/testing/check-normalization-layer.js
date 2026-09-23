#!/usr/bin/env node

/**
 * CI Enforcement Script: check-normalization-layer.js
 *
 * Enforces the Canonical Normalization Layer architectural rules:
 * 1. Email and studentId must be normalized exclusively via `@bookbuddy/shared`.
 *    Direct ad hoc `.toLowerCase()` / `.toUpperCase()` calls on identity fields in
 *    controllers and components are strictly prohibited.
 * 2. Role checks and route definitions must reference shared canonical constants
 *    (`ROLES`, `CANONICAL_ROLES`, `ROLE_GROUPS`) rather than hardcoding raw role-array literals.
 * 3. Prohibits the legacy drifted role string 'college-student' from application code
 *    (outside of migration scripts and backwards-compatibility normalization maps).
 * 4. Verifies that User model enforces write-time normalization via schema setters and hooks.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const violations = [];

function getFiles(dir, extensions = ['.js', '.jsx', '.ts', '.tsx']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) continue;
      results = results.concat(getFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

console.log('='.repeat(80));
console.log('🔍 RUNNING ARCHITECTURAL NORMALIZATION LAYER CI ENFORCEMENT CHECK');
console.log('='.repeat(80));

// Rule 1: Identity casing outside shared normalization utility
console.log('\n[Rule 1] Auditing controllers and client code for ad hoc identity casing...');
const controllerFiles = getFiles(path.join(projectRoot, 'backend/src/controllers'));
const frontendFiles = getFiles(path.join(projectRoot, 'frontend/src'));

const adHocCasingRegex = /(?:studentId|email|identifier|username)\s*\.\s*(?:toLowerCase|toUpperCase)\s*\(/i;

for (const file of [...controllerFiles, ...frontendFiles]) {
  // Allow test files and migration files
  if (file.includes('.test.') || file.includes('__tests__') || file.includes('migrations')) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    if (adHocCasingRegex.test(line)) {
      // Check if line is using normalizeIdentity/normalizeEmail
      if (!line.includes('normalizeEmail') && !line.includes('normalizeStudentId') && !line.includes('normalizeIdentity')) {
        violations.push({
          rule: 'Rule 1 (Ad hoc identity casing)',
          file: path.relative(projectRoot, file).replace(/\\/g, '/'),
          line: index + 1,
          snippet: line.trim(),
          remediation: 'Use normalizeEmail(), normalizeStudentId(), or normalizeIdentity() from @bookbuddy/shared instead of direct .toLowerCase()/.toUpperCase().',
        });
      }
    }
  });
}

// Rule 2: Hardcoded role array literals bypassing canonical constants
console.log('[Rule 2] Auditing route configurations and guards for hardcoded role arrays...');
const routeFiles = [
  ...getFiles(path.join(projectRoot, 'backend/src/routes')),
  ...getFiles(path.join(projectRoot, 'frontend/src/routes')),
  ...getFiles(path.join(projectRoot, 'frontend/src/config')),
  path.join(projectRoot, 'frontend/src/App.jsx'),
  path.join(projectRoot, 'frontend/src/layouts/DashboardLayout.jsx'),
].filter(fs.existsSync);

// Regex matching hardcoded array literals containing roles, e.g. ['student', ...] or ["college-admin", ...]
const hardcodedRoleArrayRegex = /\[\s*(?:['"](?:student|college-student|college-admin|super-admin|general)['"]\s*,\s*)+['"](?:student|college-student|college-admin|super-admin|general)['"]\s*\]/;

for (const file of routeFiles) {
  if (file.includes('.test.') || file.includes('__tests__')) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    if (hardcodedRoleArrayRegex.test(line)) {
      // Allow lines that explicitly define the canonical constants in shared
      if (file.includes('shared/src/constants/roles.js')) return;

      violations.push({
        rule: 'Rule 2 (Hardcoded role array literal)',
        file: path.relative(projectRoot, file).replace(/\\/g, '/'),
        line: index + 1,
        snippet: line.trim(),
        remediation: 'Replace hardcoded role array literals with ROLES, CANONICAL_ROLES, or ROLE_GROUPS imported from @bookbuddy/shared.',
      });
    }
  });
}

// Rule 3: Forbidden legacy 'college-student' string in non-migration application source
console.log('[Rule 3] Auditing codebase for legacy drifted "college-student" role string...');
const appSourceFiles = [
  ...controllerFiles,
  ...getFiles(path.join(projectRoot, 'backend/src/routes')),
  ...getFiles(path.join(projectRoot, 'backend/src/middlewares')),
  ...getFiles(path.join(projectRoot, 'frontend/src/components')),
  ...getFiles(path.join(projectRoot, 'frontend/src/pages')),
  ...getFiles(path.join(projectRoot, 'frontend/src/layouts')),
  ...getFiles(path.join(projectRoot, 'frontend/src/store')),
].filter(fs.existsSync);

for (const file of appSourceFiles) {
  if (file.includes('.test.') || file.includes('__tests__')) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Flag occurrences of "college-student" role literals
    if (line.includes('"college-student"') || line.includes("'college-student'")) {
      // Check if it is a backwards-compatibility comment or test
      if (line.includes('// Backwards compatibility') || line.includes('/* Backwards compatibility */')) return;

      violations.push({
        rule: 'Rule 3 (Legacy drifted role literal)',
        file: path.relative(projectRoot, file).replace(/\\/g, '/'),
        line: index + 1,
        snippet: line.trim(),
        remediation: 'The platform role "college-student" is deprecated and collapsed to "student" (ROLES.STUDENT). Use ROLES.STUDENT or normalizeRole().',
      });
    }
  });
}

// Rule 4: Verify User model schema normalization hooks
console.log('[Rule 4] Verifying schema-level normalization hooks in User.js...');
const userModelFile = path.join(projectRoot, 'backend/src/models/User.js');
if (fs.existsSync(userModelFile)) {
  const userModelContent = fs.readFileSync(userModelFile, 'utf8');
  if (!userModelContent.includes('set: normalizeStudentId')) {
    violations.push({
      rule: 'Rule 4 (Missing schema setter)',
      file: 'backend/src/models/User.js',
      line: 1,
      snippet: 'User.studentId definition',
      remediation: 'Ensure studentId field has "set: normalizeStudentId" configured.',
    });
  }
  if (!userModelContent.includes('set: normalizeEmail')) {
    violations.push({
      rule: 'Rule 4 (Missing schema setter)',
      file: 'backend/src/models/User.js',
      line: 1,
      snippet: 'User.email definition',
      remediation: 'Ensure email field has "set: normalizeEmail" configured.',
    });
  }
  if (!userModelContent.includes('set: normalizeRole')) {
    violations.push({
      rule: 'Rule 4 (Missing schema setter)',
      file: 'backend/src/models/User.js',
      line: 1,
      snippet: 'User.role definition',
      remediation: 'Ensure role field has "set: normalizeRole" configured.',
    });
  }
}

// Output report
console.log('\n' + '='.repeat(80));
console.log('📊 NORMALIZATION CI AUDIT REPORT:');
console.log('='.repeat(80));

if (violations.length === 0) {
  console.log('✅ ALL CHECKS PASSED: Zero identity/role normalization violations detected.');
  console.log('   - 0 ad hoc casing derivations');
  console.log('   - 0 hardcoded role array literals bypassing canonical constants');
  console.log('   - 0 un-sanctioned legacy "college-student" references');
  console.log('   - Schema-level Mongoose write-path hooks verified\n');
  process.exit(0);
} else {
  console.error(`❌ VIOLATIONS FOUND: ${violations.length} normalization rule violation(s) detected:\n`);
  violations.forEach((v, i) => {
    console.error(`  ${i + 1}. [${v.rule}] ${v.file}:${v.line}`);
    console.error(`     Snippet: ${v.snippet}`);
    console.error(`     Fix:     ${v.remediation}\n`);
  });
  console.error('Please resolve the above violations to maintain the canonical normalization layer.\n');
  process.exit(1);
}
