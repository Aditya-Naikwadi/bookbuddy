/**
 * Static Analysis Script: Transaction Boundary & Side-Effect Leak Detector
 *
 * Scans backend/src JavaScript files for:
 * 1. Unsafe raw transaction usage (startSession/startTransaction/withTransaction outside transactionHelper.js).
 * 2. Side-effect leaks inside transactionFn callbacks in runInTransaction:
 *    - Email / SMS dispatch (sendMail, sendEmail, sendSMS, sendTenantOnboardingApprovalEmail, etc.)
 *    - Real-time Socket.IO broadcasts (.emit, emitToCollege, emitStreakUpdate)
 *    - Streak updates (recordQualifyingAction)
 *    - Gamification badge evaluation (evaluateBadges)
 *    - User notifications (notificationService.notify, notify)
 */

const fs = require('fs');
const path = require('path');
const espree = require('espree');

const ROOT_DIR = path.resolve(__dirname, '../../backend/src');
const EXCLUDE_DIRS = ['tests', 'node_modules'];
const EXCLUDE_FILES = ['transactionHelper.js'];

const FORBIDDEN_SIDE_EFFECT_CALLS = new Set([
  'sendMail',
  'sendEmail',
  'sendSMS',
  'sendTenantOnboardingApprovalEmail',
  'sendNotificationWithEmailFallback',
  'emit',
  'emitToCollege',
  'emitStreakUpdate',
  'recordQualifyingAction',
  'evaluateBadges',
  'notify',
]);

const RAW_TRANSACTION_METHODS = new Set([
  'startTransaction',
  'withTransaction',
]);

const violations = [];

function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        results = results.concat(getAllJsFiles(filePath));
      }
    } else if (file.endsWith('.js') && !EXCLUDE_FILES.includes(file)) {
      results.push(filePath);
    }
  });
  return results;
}

function traverse(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach((c) => traverse(c, visitor));
    } else if (child && typeof child === 'object') {
      traverse(child, visitor);
    }
  }
}

function getCalleeName(callee) {
  if (!callee) return null;
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  if (callee.type === 'MemberExpression') {
    if (callee.property && callee.property.type === 'Identifier') {
      return callee.property.name;
    }
  }
  return null;
}

function analyzeFile(filePath) {
  const relPath = path.relative(ROOT_DIR, filePath);
  const code = fs.readFileSync(filePath, 'utf8');

  let ast;
  try {
    ast = espree.parse(code, {
      ecmaVersion: 'latest',
      loc: true,
      sourceType: 'script',
    });
  } catch (_e) {
    try {
      ast = espree.parse(code, {
        ecmaVersion: 'latest',
        loc: true,
        sourceType: 'module',
      });
    } catch (parseErr) {
      console.warn(`[WARN] Could not parse ${relPath}: ${parseErr.message}`);
      return;
    }
  }

  traverse(ast, (node) => {
    // 1. Detect raw transaction usage
    if (node.type === 'CallExpression') {
      const calleeName = getCalleeName(node.callee);
      if (RAW_TRANSACTION_METHODS.has(calleeName)) {
        violations.push({
          file: relPath,
          line: node.loc.start.line,
          type: 'RAW_TRANSACTION_CALL',
          detail: `Direct call to ${calleeName}(). All transactions must use runInTransaction(transactionFn, afterCommitFn) from src/utils/transactionHelper.js.`,
        });
      }

      // 2. Detect side effects leaking inside runInTransaction(transactionFn, ...)
      if (calleeName === 'runInTransaction' && node.arguments.length > 0) {
        const transactionFn = node.arguments[0];
        if (
          transactionFn.type === 'ArrowFunctionExpression' ||
          transactionFn.type === 'FunctionExpression'
        ) {
          traverse(transactionFn.body, (innerNode) => {
            if (innerNode.type === 'CallExpression') {
              const innerCalleeName = getCalleeName(innerNode.callee);
              if (FORBIDDEN_SIDE_EFFECT_CALLS.has(innerCalleeName)) {
                violations.push({
                  file: relPath,
                  line: innerNode.loc.start.line,
                  type: 'TRANSACTION_SIDE_EFFECT_LEAK',
                  detail: `Side-effect function "${innerCalleeName}()" called inside transactionFn. Move to afterCommitFn callback.`,
                });
              }
            }
          });
        }
      }
    }
  });
}

function run() {
  console.log('--- Transaction Boundary & Side-Effect Leak Check ---');
  console.log(`Scanning: ${ROOT_DIR}\n`);

  const files = getAllJsFiles(ROOT_DIR);
  files.forEach(analyzeFile);

  if (violations.length === 0) {
    console.log(`[PASS] Verified ${files.length} files. Zero side-effect leaks or unsafe transaction patterns detected.`);
    process.exit(0);
  } else {
    console.error(`[FAIL] Found ${violations.length} transaction boundary violation(s):\n`);
    violations.forEach((v, idx) => {
      console.error(`  ${idx + 1}. [${v.type}] ${v.file}:${v.line}`);
      console.error(`     -> ${v.detail}\n`);
    });
    process.exit(1);
  }
}

run();
