const fs = require('fs');
const path = require('path');

const reportPath = path.resolve(__dirname, '../../reports/phase1_route_audit_report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const failedReqs = new Map();
const consoleErrs = new Map();
const consoleWarns = new Map();
const pageErrs = [];

report.forEach((entry) => {
  if (entry.pageErrors.length > 0) {
    pageErrs.push({ role: entry.role, route: entry.route, errors: entry.pageErrors });
  }

  entry.failedRequests.forEach((req) => {
    const cleanUrl = (req.url || '').split('?')[0];
    const key = req.status ? `${req.status} ${cleanUrl}` : `${req.errorText || 'FAIL'} ${cleanUrl}`;
    if (!failedReqs.has(key)) {
      failedReqs.set(key, { count: 0, roles: new Set(), sampleRoutes: [] });
    }
    const item = failedReqs.get(key);
    item.count++;
    item.roles.add(entry.role);
    if (item.sampleRoutes.length < 3) item.sampleRoutes.push(entry.route);
  });

  entry.consoleErrors.forEach((err) => {
    const cleanErr = err.replace(/http:\/\/localhost:\d+[^\s]*/g, '[URL]');
    consoleErrs.set(cleanErr, (consoleErrs.get(cleanErr) || 0) + 1);
  });

  entry.consoleWarns.forEach((warn) => {
    const cleanWarn = warn.replace(/http:\/\/localhost:\d+[^\s]*/g, '[URL]');
    consoleWarns.set(cleanWarn, (consoleWarns.get(cleanWarn) || 0) + 1);
  });
});

console.log('================================================================================');
console.log('📊 PHASE 1 ROUTE AUDIT: ROOT CAUSE ANALYSIS');
console.log('================================================================================\n');

console.log('--- 1. UNCAUGHT PAGE/JS ERRORS ---');
if (pageErrs.length === 0) {
  console.log('✅ ZERO uncaught JavaScript / ErrorBoundary exceptions across all 63 routes!\n');
} else {
  console.log(`❌ Found ${pageErrs.length} page exceptions:`, pageErrs, '\n');
}

console.log('--- 2. FAILED NETWORK REQUESTS BREAKDOWN ---');
for (const [k, v] of failedReqs.entries()) {
  console.log(`[${String(v.count).padStart(2)}x] ${k}`);
  console.log(`     Roles: ${Array.from(v.roles).join(', ')} | Routes: ${v.sampleRoutes.join(', ')}`);
}

console.log('\n--- 3. CONSOLE ERRORS BREAKDOWN ---');
for (const [k, v] of consoleErrs.entries()) {
  console.log(`[${String(v).padStart(2)}x] ${k}`);
}

console.log('\n--- 4. CONSOLE WARNINGS BREAKDOWN ---');
for (const [k, v] of consoleWarns.entries()) {
  console.log(`[${String(v).padStart(2)}x] ${k}`);
}

