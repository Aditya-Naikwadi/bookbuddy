/**
 * Phase 1: Real Browser Route Baseline Audit
 * Navigates to every defined route across all 5 roles:
 * - Visitor
 * - General
 * - Student
 * - College Admin
 * - Super Admin
 *
 * Captures:
 * 1. Page console.error and console.warn
 * 2. Unhandled page errors (pageerror)
 * 3. Failed network requests (status >= 400 or network errors)
 * 4. ErrorBoundary or blank page crashes
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');
require('dotenv').config({ path: path.resolve(__dirname, '../../backend/.env') });

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:5000/api/v1';

const REPORTS_DIR = path.resolve(__dirname, '../../reports');
const SCREENSHOTS_DIR = path.join(REPORTS_DIR, 'screenshots');

if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const ROLE_ROUTES = {
  Visitor: [
    '/',
    '/auth/login',
    '/auth/register',
    '/privacy',
    '/terms',
    '/support',
    '/c/standford',
    '/register/standford',
    '/c/standford/activate',
  ],
  General: [
    '/general-dashboard',
    '/general-dashboard/search',
    '/general-dashboard/e-resources',
    '/general-dashboard/saved',
  ],
  Student: [
    '/student',
    '/student/catalog',
    '/student/loans',
    '/student/fines',
    '/student/card',
    '/student/e-resources',
    '/student/reader/sample-1',
    '/student/reading-lists',
    '/student/shelves',
    '/student/recommendations',
    '/student/saved',
    '/student/facilities',
    '/student/support',
    '/student/engagement',
    '/student/feed',
    '/student/cross-college',
    '/student/downloads',
    '/student/offline-sync',
    '/student/reading-nudges',
    '/student/ask-this-book',
  ],
  'College Admin': [
    '/college-admin',
    '/college-admin/features',
    '/college-admin/bulk-upload',
    '/college-admin/circulation',
    '/college-admin/patrons',
    '/college-admin/cataloging',
    '/college-admin/inventory',
    '/college-admin/finances',
    '/college-admin/facilities',
    '/college-admin/digital-assets',
    '/college-admin/helpdesk',
    '/college-admin/share-requests',
    '/college-admin/analytics',
    '/college-admin/acquisitions',
    '/college-admin/predictive-alerts',
    '/college-admin/analytics-expansion',
    '/college-admin/anomaly-detection',
    '/college-admin/syllabus-scanner',
    '/college-admin/qr-shelf-nav',
  ],
  'Super Admin': [
    '/admin-portal',
    '/admin-portal/overview',
    '/admin-portal/college-admins',
    '/admin-portal/features',
    '/admin-portal/registration-queue',
    '/admin-portal/moderation',
    '/admin-portal/audit-logs',
    '/admin-portal/settings',
    '/admin-portal/users',
    '/admin-portal/data-oversight',
    '/admin-portal/support',
  ],
};

const USERS = {
  Student: { email: 'student@standard.edu', password: 'StudentPass@2026!' },
  'College Admin': { email: 'admin@standard.edu', password: 'AdminPass@2026!' },
  General: { email: 'general@bookbuddy.com', password: 'GeneralPass@2026!' },
  'Super Admin': { email: 'superadmin@bookbuddy.com', password: 'SuperAdminPass@2026!' },
};

async function clearRateLimits() {
  if (process.env.REDIS_URL) {
    try {
      const redis = new Redis(process.env.REDIS_URL, { connectTimeout: 3000, maxRetriesPerRequest: 1 });
      const keys = await redis.keys('rlflx:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      redis.disconnect();
    } catch {
      // Ignore redis clearing errors
    }
  }
}

async function loginViaApiWithRetry(email, password, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.status === 429) {
        console.warn(`[429 Rate Limited] login attempt ${attempt} for ${email}. Clearing limiters and pausing 10s...`);
        await clearRateLimits();
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }
      if (!res.ok || !data.success) {
        throw new Error(`Login failed for ${email}: ${data.message || res.statusText}`);
      }
      return { token: data.token || data.accessToken, user: data.user || data.data };
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function runAudit() {
  console.log('================================================================================');
  console.log('🚀 STARTING PHASE 1 REAL BROWSER ROUTE BASELINE AUDIT');
  console.log(`Base URL: ${BASE_URL} | API URL: ${API_URL}`);
  console.log('================================================================================\n');

  await clearRateLimits();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const auditResults = [];
  const reportPath = path.join(REPORTS_DIR, 'phase1_route_audit_report.json');

  const saveReport = () => {
    fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2), 'utf-8');
  };

  try {
    for (const [role, routes] of Object.entries(ROLE_ROUTES)) {
      console.log(`\n🔍 Auditing Role: [${role}] (${routes.length} routes)`);
      await clearRateLimits();
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      // Set auth tokens for non-visitor roles
      if (role !== 'Visitor') {
        const creds = USERS[role];
        const authData = await loginViaApiWithRetry(creds.email, creds.password);

        // Pre-seed localStorage before visiting pages
        await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' });
        await page.evaluate((auth) => {
          localStorage.setItem('token', auth.token);
          localStorage.setItem('user', JSON.stringify(auth.user));
          sessionStorage.setItem('bookbuddy_splash_shown', 'true');
        }, authData);
      } else {
        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.setItem('bookbuddy_splash_shown', 'true');
        });
      }

      for (const route of routes) {
        const routeUrl = `${BASE_URL}${route}`;
        const consoleErrors = [];
        const consoleWarns = [];
        const pageErrors = [];
        const failedRequests = [];

        const onConsole = (msg) => {
          const text = msg.text();
          const type = msg.type();
          if (type === 'error') consoleErrors.push(text);
          else if (type === 'warn') consoleWarns.push(text);
        };

        const onPageError = (err) => {
          pageErrors.push(err.message || String(err));
        };

        const onResponse = (response) => {
          const status = response.status();
          const url = response.url();
          if (status >= 400 && !url.includes('favicon.ico')) {
            failedRequests.push({ url, status, statusText: response.statusText() });
          }
        };

        const onRequestFailed = (req) => {
          failedRequests.push({
            url: req.url(),
            errorText: req.failure() ? req.failure().errorText : 'Request Failed',
          });
        };

        page.on('console', onConsole);
        page.on('pageerror', onPageError);
        page.on('response', onResponse);
        page.on('requestfailed', onRequestFailed);

        let navigationSuccess = true;
        let navError = null;

        try {
          await page.goto(routeUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        } catch (err) {
          navigationSuccess = false;
          navError = err.message;
        }

        // Small settle pause for dynamic React rendering
        await new Promise((r) => setTimeout(r, 600));

        // Inspect DOM for crash / blank page
        let domStatus = 'OK';
        try {
          domStatus = await page.evaluate(() => {
            const body = document.body;
            if (!body || !body.innerText.trim()) return 'EMPTY_BODY';
            const text = body.innerText;
            if (text.includes('Something went wrong') && text.includes('ErrorBoundary')) {
              return 'ERROR_BOUNDARY_CRASH';
            }
            return 'OK';
          });
        } catch (err) {
          domStatus = `DOM_EVAL_ERROR: ${err.message}`;
        }

        // Cleanup listeners
        page.off('console', onConsole);
        page.off('pageerror', onPageError);
        page.off('response', onResponse);
        page.off('requestfailed', onRequestFailed);

        const statusIcon =
          navigationSuccess &&
          domStatus === 'OK' &&
          pageErrors.length === 0 &&
          consoleErrors.length === 0
            ? '✅'
            : '⚠️';

        console.log(
          `  ${statusIcon} ${route} | Nav: ${navigationSuccess ? 'OK' : 'FAIL'} | DOM: ${domStatus} | JS Errors: ${pageErrors.length} | Console Errors: ${consoleErrors.length} | Warns: ${consoleWarns.length} | Failed Req: ${failedRequests.length}`
        );

        const routeRecord = {
          role,
          route,
          url: routeUrl,
          navigationSuccess,
          navError,
          domStatus,
          pageErrors,
          consoleErrors,
          consoleWarns,
          failedRequests,
        };

        auditResults.push(routeRecord);
        saveReport();

        if (pageErrors.length > 0 || consoleErrors.length > 0 || domStatus !== 'OK') {
          const safeRoute = route.replace(/[^a-zA-Z0-9]/g, '_');
          const screenshotPath = path.join(
            SCREENSHOTS_DIR,
            `error_${role.replace(/\s+/g, '_')}_${safeRoute}.png`
          );
          try {
            await page.screenshot({ path: screenshotPath });
            routeRecord.screenshot = screenshotPath;
          } catch {
            // Ignore screenshot error
          }
        }
      }

      await page.close();
      await context.close();
    }
  } finally {
    await browser.close();
    saveReport();
  }

  console.log('\n================================================================================');
  console.log(`📊 PHASE 1 ROUTE AUDIT COMPLETED: Full report written to ${reportPath}`);
  console.log('================================================================================\n');

  // Print summary by role
  for (const role of Object.keys(ROLE_ROUTES)) {
    const roleRecords = auditResults.filter((r) => r.role === role);
    const total = roleRecords.length;
    const errors = roleRecords.filter(
      (r) =>
        r.pageErrors.length > 0 ||
        r.consoleErrors.length > 0 ||
        r.domStatus !== 'OK' ||
        !r.navigationSuccess
    );
    console.log(
      `Role: ${role.padEnd(15)} | Total Routes: ${total.toString().padStart(2)} | Clean: ${(
        total - errors.length
      )
        .toString()
        .padStart(2)} | Issues: ${errors.length.toString().padStart(2)}`
    );
  }
}

runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
