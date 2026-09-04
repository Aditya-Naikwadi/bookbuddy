import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metric tracking for rate limiter verification
const rateLimitTriggered = new Rate('rate_limit_triggered');

// Safety Gate: Prevent unintended executions against live production targets
const rawBaseUrl = __ENV.BASE_URL || 'http://localhost:5000';
const BASE_URL = rawBaseUrl.replace(/\/$/, '');
const isProduction =
  BASE_URL.includes('onrender.com') ||
  BASE_URL.includes('bookbuddy-kcwl') ||
  __ENV.TARGET_ENV === 'production';

if (isProduction && __ENV.ALLOW_PROD !== 'true') {
  throw new Error(
    `\n🚨 SAFETY SAFETY BLOCK: Target URL '${BASE_URL}' appears to be PRODUCTION!\n` +
      `To execute load tests against production, you MUST explicitly pass '--env ALLOW_PROD=true'.\n` +
      `Aborting load test for safety.\n`
  );
}

// Stage configuration (configurable via environment variables)
const stageConfig = __ENV.STAGES
  ? JSON.parse(__ENV.STAGES)
  : [
      { duration: '30s', target: 100 },  // Light load ramp-up
      { duration: '1m',  target: 500 },  // Moderate load scale
      { duration: '2m',  target: 2000 }, // Stress load peak
      { duration: '30s', target: 0 },    // Graceful ramp-down
    ];

export const options = {
  stages: stageConfig,
  thresholds: {
    // Global SLAs
    http_req_failed: ['rate<0.01'],    // Total HTTP error rate must be < 1%
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1000ms

    // Group-level latency SLAs
    'http_req_duration{group:::1. Public Endpoints}': ['p(95)<300'],
    'http_req_duration{group:::2. Auth Operations}': ['p(95)<500'],
    'http_req_duration{group:::3. Core User Flows}': ['p(95)<500'],
    'http_req_duration{group:::4. Admin Portal}': ['p(95)<600'],
  },
};

/**
 * Setup function: Runs once per test execution to authenticate
 * and retrieve reusable tokens for virtual users.
 */
export function setup() {
  console.log(`🚀 Initializing k6 Load Test against target: ${BASE_URL}`);

  // Test credentials (override via environment variables if needed)
  const userEmail = __ENV.TEST_USER_EMAIL || 'student@bookbuddy.com';
  const userPassword = __ENV.TEST_USER_PASSWORD || 'StudentPass123!';
  const adminEmail = __ENV.TEST_ADMIN_EMAIL || 'superadmin@bookbuddy.com';
  const adminPassword = __ENV.TEST_ADMIN_PASSWORD || 'SuperAdminPass123!';

  const jsonHeaders = { headers: { 'Content-Type': 'application/json' } };

  // 1. Authenticate Standard Student User
  let studentToken = null;
  const studentRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: userEmail, password: userPassword }),
    jsonHeaders
  );

  if (studentRes.status === 200 && studentRes.json('accessToken')) {
    studentToken = studentRes.json('accessToken');
  } else if (studentRes.json('token')) {
    studentToken = studentRes.json('token');
  }

  // 2. Authenticate Super Admin User
  let adminToken = null;
  const adminRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: adminEmail, password: adminPassword }),
    jsonHeaders
  );

  if (adminRes.status === 200 && adminRes.json('accessToken')) {
    adminToken = adminRes.json('accessToken');
  } else if (adminRes.json('token')) {
    adminToken = adminRes.json('token');
  }

  return {
    studentToken: studentToken || 'MOCK_STUDENT_JWT_TOKEN',
    adminToken: adminToken || 'MOCK_ADMIN_JWT_TOKEN',
  };
}

/**
 * Main Virtual User (VU) Execution Script
 */
export default function (data) {
  const studentAuth = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.studentToken}`,
    },
  };

  const adminAuth = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.adminToken}`,
    },
  };

  // --- Scenario 1: Public Endpoints ---
  group('1. Public Endpoints', function () {
    const health = http.get(`${BASE_URL}/health`, { tags: { name: 'HealthCheck' } });
    check(health, { 'health status is 200': (r) => r.status === 200 });

    const version = http.get(`${BASE_URL}/version`, { tags: { name: 'VersionCheck' } });
    check(version, { 'version status is 200': (r) => r.status === 200 });

    const slugCheck = http.get(`${BASE_URL}/api/v1/colleges/slug-check?slug=test`, {
      tags: { name: 'SlugCheck' },
    });
    check(slugCheck, { 'slug-check status is 200': (r) => r.status === 200 });
  });

  sleep(0.5);

  // --- Scenario 2: Auth Operations ---
  group('2. Auth Operations', function () {
    const profile = http.get(`${BASE_URL}/api/v1/auth/profile`, {
      ...studentAuth,
      tags: { name: 'UserProfile' },
    });
    check(profile, { 'profile status is 200 or 401': (r) => [200, 401].includes(r.status) });
  });

  sleep(0.5);

  // --- Scenario 3: Core User Flows (Search, Catalog, Loans, Fines) ---
  group('3. Core User Flows', function () {
    const catalog = http.get(`${BASE_URL}/api/v1/catalog?page=1&limit=10`, {
      ...studentAuth,
      tags: { name: 'CatalogBrowse' },
    });
    check(catalog, { 'catalog status is 200': (r) => r.status === 200 });

    const loans = http.get(`${BASE_URL}/api/v1/dashboards/student/loans`, {
      ...studentAuth,
      tags: { name: 'StudentLoans' },
    });
    check(loans, { 'loans status is 200 or 401': (r) => [200, 401].includes(r.status) });

    const fines = http.get(`${BASE_URL}/api/v1/dashboards/student/fines`, {
      ...studentAuth,
      tags: { name: 'StudentFines' },
    });
    check(fines, { 'fines status is 200 or 401': (r) => [200, 401].includes(r.status) });
  });

  sleep(0.5);

  // --- Scenario 4: Admin Portal (Super Admin) ---
  group('4. Admin Portal', function () {
    const overview = http.get(`${BASE_URL}/api/v1/dashboards/admin-portal/overview`, {
      ...adminAuth,
      tags: { name: 'AdminOverview' },
    });
    check(overview, { 'overview status is 200 or 401': (r) => [200, 401].includes(r.status) });

    const users = http.get(`${BASE_URL}/api/v1/dashboards/admin-portal/users?page=1&limit=10`, {
      ...adminAuth,
      tags: { name: 'AdminUsersList' },
    });
    check(users, { 'users status is 200 or 401': (r) => [200, 401].includes(r.status) });
  });

  sleep(0.5);

  // --- Scenario 5: Payment Order Creation (Sandbox) ---
  group('5. Payment Flows', function () {
    const orderPayload = JSON.stringify({ amount: 100, currency: 'INR', fineId: '60d0fe4f5311236168a109ca' });
    const paymentRes = http.post(`${BASE_URL}/api/v1/payments/create-order`, orderPayload, {
      ...studentAuth,
      tags: { name: 'CreatePaymentOrder' },
    });

    check(paymentRes, {
      'payment response code expected (200/400/401/404)': (r) =>
        [200, 400, 401, 404].includes(r.status),
    });
  });

  sleep(0.5);

  // --- Scenario 6: Rate Limit Validation (Intentional Burst Check) ---
  if (__VU % 10 === 0) { // Execute rate limit burst test on subset of VUs
    group('6. Rate Limiter Validation', function () {
      const burstRes = http.post(
        `${BASE_URL}/api/_debug/test-limiter`,
        JSON.stringify({ test: true }),
        { headers: { 'Content-Type': 'application/json' }, tags: { name: 'RateLimitTest' } }
      );

      const isRateLimited = burstRes.status === 429;
      rateLimitTriggered.add(isRateLimited);

      if (isRateLimited) {
        check(burstRes, {
          'rate limit status is 429': (r) => r.status === 429,
          'has Retry-After header': (r) => r.headers['Retry-After'] !== undefined,
        });
      }
    });
  }
}

/**
 * Handle Summary: Output formatting & JSON result export for CI/CD archiving
 */
export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'logs/load-test-results.json': JSON.stringify(data, null, 2),
  };
}

// Fallback helper for text formatting if k6 module is imported standalone
function textSummary(data) {
  const p95 = data.metrics.http_req_duration
    ? data.metrics.http_req_duration.values['p(95)'].toFixed(2)
    : 'N/A';
  const p99 = data.metrics.http_req_duration
    ? data.metrics.http_req_duration.values['p(99)'].toFixed(2)
    : 'N/A';
  const failRate = data.metrics.http_req_failed
    ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2)
    : '0';

  return `
=====================================================
📊 BOOKBUDDY K6 LOAD TEST SUMMARY REPORT
=====================================================
Target URL:           ${BASE_URL}
Total Requests:       ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 'N/A'}
Request Rate (RPS):   ${data.metrics.http_reqs ? data.metrics.http_reqs.values.rate.toFixed(2) : 'N/A'} req/s
Failed Requests Rate: ${failRate}%

Latency Metrics:
  p(50) (Median):     ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(50)'].toFixed(2) : 'N/A'} ms
  p(95):              ${p95} ms
  p(99):              ${p99} ms

Threshold Evaluation:
  Global Error Rate < 1%: ${failRate < 1 ? 'PASSED ✅' : 'FAILED ❌'}
  p(95) < 500ms:          ${p95 < 500 ? 'PASSED ✅' : 'FAILED ❌'}
=====================================================
`;
}
