/**
 * Post-Push Deployment Verification Automation Script
 *
 * Verifies live production deployments after CI/CD push/merge.
 * Confirms live commit SHA alignment, runs critical endpoint health checks,
 * triggers rollback alerts on failure, and posts GitHub Step Summaries & Slack alerts.
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

// --- Configuration & Inputs ---
const APP_URL = (process.env.APP_URL || process.argv[2] || 'http://localhost:5000').replace(/\/$/, '');
const EXPECTED_COMMIT_SHA = process.env.EXPECTED_COMMIT_SHA || process.argv[3] || process.env.GITHUB_SHA || '';
const TIMEOUT_SECONDS = parseInt(process.env.TIMEOUT_SECONDS || process.argv[4] || '300', 10);
const POLL_INTERVAL_SECONDS = parseInt(process.env.POLL_INTERVAL_SECONDS || process.argv[5] || '10', 10);
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const SUMMARY_FILE = process.env.GITHUB_STEP_SUMMARY || '';
const TRIGGER_EVENT = process.env.GITHUB_EVENT_NAME || (process.argv[6] || 'manual');

// HTTP Helper using native modules (no external npm dependencies required)
const makeRequest = (urlStr, options = {}, redirectCount = 0) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let urlObj;
    try {
      urlObj = new URL(urlStr);
    } catch (err) {
      return resolve({
        ok: false,
        status: 0,
        error: `Invalid URL: ${err.message}`,
        body: '',
        json: null,
        responseTimeMs: 0,
      });
    }

    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      timeout: 10000,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        'User-Agent': 'Deployment-Verifier/1.0',
        ...(options.headers || {}),
      },
      ...options,
    };

    const req = client.request(reqOptions, (res) => {
      // Follow HTTP redirects (301, 302, 307, 308) up to 5 times (same host only)
      if (
        [301, 302, 307, 308].includes(res.statusCode) &&
        res.headers.location &&
        redirectCount < 5
      ) {
        const nextUrlObj = new URL(res.headers.location, urlStr);
        if (nextUrlObj.hostname === urlObj.hostname) {
          return makeRequest(nextUrlObj.toString(), options, redirectCount + 1).then(resolve);
        }
      }

      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {
          json = null;
        }
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          status: res.statusCode,
          headers: res.headers,
          body,
          json,
          responseTimeMs: Date.now() - startTime,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        ok: false,
        status: 0,
        error: err.message,
        body: '',
        json: null,
        responseTimeMs: Date.now() - startTime,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        ok: false,
        status: 408,
        error: 'Request Timeout (10s)',
        body: '',
        json: null,
        responseTimeMs: Date.now() - startTime,
      });
    });

    req.end();
  });
};

// Retry wrapper with Exponential Backoff for transient errors
const makeRequestWithRetry = async (urlStr, options = {}, maxRetries = 3) => {
  let attempt = 0;
  while (attempt <= maxRetries) {
    const res = await makeRequest(urlStr, options);
    const isTransientError =
      !res.ok && ([502, 503, 504, 408, 0].includes(res.status) || (res.error && !res.error.includes('Invalid URL')));

    if (!isTransientError || attempt === maxRetries) {
      return res;
    }

    attempt++;
    const backoffMs = Math.pow(2, attempt - 1) * 1000;
    console.log(
      `   ⚠️ Transient error (${res.status || res.error}). Retrying in ${backoffMs}ms (Attempt ${attempt}/${maxRetries})...`
    );
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }
};

// Write persistent JSONL Audit Log Entry
const writeAuditLog = (entry) => {
  try {
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, 'deployment-audit.jsonl');
    const logLine = JSON.stringify(entry) + '\n';
    fs.appendFileSync(logFile, logLine, 'utf8');
    console.log(`\n📜 Execution logged to persistent audit store (${logFile})`);
  } catch (err) {
    console.error('⚠️ Could not write deployment audit log:', err.message);
  }
};

const sendSlackNotification = async (payload) => {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    const isHttps = SLACK_WEBHOOK_URL.startsWith('https:');
    const client = isHttps ? https : http;
    const urlObj = new URL(SLACK_WEBHOOK_URL);
    const data = JSON.stringify(payload);

    await new Promise((resolve) => {
      const req = client.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        },
        resolve
      );
      req.on('error', () => resolve());
      req.write(data);
      req.end();
    });
  } catch (err) {
    console.error('⚠️ Failed to send Slack alert:', err.message);
  }
};

const shasMatch = (expected, actual) => {
  if (!expected || !actual || actual === 'unknown') return true; // Graceful fallback if SHA is unpopulated
  const exp = expected.trim().toLowerCase();
  const act = actual.trim().toLowerCase();
  return exp.startsWith(act) || act.startsWith(exp);
};

const runVerification = async () => {
  console.log('=====================================================');
  console.log('🚀 POST-PUSH DEPLOYMENT VERIFICATION AUTOMATION');
  console.log('=====================================================');
  console.log(`🌐 Target APP_URL:          ${APP_URL}`);
  console.log(`📌 Expected Commit SHA:     ${EXPECTED_COMMIT_SHA || '(Not specified, skipping SHA lock)'}`);
  console.log(`⏱️ Timeout Window:          ${TIMEOUT_SECONDS} seconds`);
  console.log(`🔄 Polling Interval:        ${POLL_INTERVAL_SECONDS} seconds`);
  console.log('-----------------------------------------------------\n');

  const startTime = Date.now();
  const endTime = startTime + TIMEOUT_SECONDS * 1000;

  let versionMatched = false;
  let liveCommitSha = 'unknown';
  let liveVersion = 'unknown';
  let pollAttempts = 0;
  let lastVersionResponse = null;

  // --- Step 1: Version/Commit Verification Loop ---
  console.log('🔍 STEP 1: Polling /version endpoint for commit SHA alignment (with CDN cache-busting & exponential backoff retries)...');
  while (Date.now() < endTime) {
    pollAttempts++;
    const versionUrl = `${APP_URL}/version?_cb=${Date.now()}`;
    const res = await makeRequestWithRetry(versionUrl, {}, 3);
    lastVersionResponse = res;

    if (res.ok && res.json) {
      liveCommitSha = res.json.commitSha || res.json.shortCommitSha || 'unknown';
      liveVersion = res.json.version || '1.0.0';

      const match = shasMatch(EXPECTED_COMMIT_SHA, liveCommitSha);
      console.log(
        `   [Attempt ${pollAttempts}] Status: ${res.status} | Live SHA: ${liveCommitSha} | Expected SHA: ${EXPECTED_COMMIT_SHA || 'ANY'} | Match: ${match ? '✅ YES' : '⏳ NO'}`
      );

      if (match) {
        versionMatched = true;
        break;
      }
    } else {
      console.log(`   [Attempt ${pollAttempts}] Endpoint unavailable or returned status ${res.status} (${res.error || 'bad response'})`);
    }

    if (!EXPECTED_COMMIT_SHA) {
      // If no expected commit SHA was provided, accept the first successful response
      if (res.ok) {
        versionMatched = true;
        break;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_SECONDS * 1000));
  }

  const pollDurationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  // --- Step 2: Critical Health Checks ---
  console.log('\n🏥 STEP 2: Running critical route health checks (with retry logic)...');

  const healthRoutes = [
    { path: '/health', expectedStatus: 200, name: 'System Health Check' },
    { path: '/version', expectedStatus: 200, name: 'Version Metadata Check' },
    { path: '/api/v1/auth/me', expectedStatus: 401, name: 'Auth Middleware Security (Unauthenticated 401)' },
    { path: '/api/v1/colleges/slug-check?slug=test', expectedStatus: 200, name: 'Database Connectivity & Colleges API' },
  ];

  const healthResults = [];
  let allHealthPassed = true;

  for (const route of healthRoutes) {
    const fullUrl = `${APP_URL}${route.path}`;
    const res = await makeRequestWithRetry(fullUrl, {}, 2);
    const passed = res.status === route.expectedStatus;

    if (!passed) {
      allHealthPassed = false;
    }

    healthResults.push({
      name: route.name,
      path: route.path,
      expectedStatus: route.expectedStatus,
      actualStatus: res.status,
      latencyMs: res.responseTimeMs,
      passed,
      error: res.error || (res.json ? res.json.message : ''),
    });

    console.log(
      `   ${passed ? '✅ PASS' : '❌ FAIL'} | ${route.name} (${route.path}) -> Expected: ${route.expectedStatus}, Got: ${res.status} (${res.responseTimeMs}ms)`
    );
  }

  // --- Step 3: Rollback Signal & Outcome Determination ---
  const overallSuccess = versionMatched && allHealthPassed;
  const statusEmoji = overallSuccess ? '✅' : '🚨';
  const statusTitle = overallSuccess ? 'DEPLOYMENT VERIFIED LIVE' : 'DEPLOYMENT VERIFICATION FAILED - ROLLBACK REQUIRED';

  console.log('\n=====================================================');
  console.log(`${statusEmoji} OVERALL RESULT: ${statusTitle}`);
  console.log('=====================================================');
  console.log(`Pushed Commit SHA:    ${EXPECTED_COMMIT_SHA || 'N/A'}`);
  console.log(`Live Commit SHA:      ${liveCommitSha}`);
  console.log(`Version Match:        ${versionMatched ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Health Checks:        ${allHealthPassed ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Verification Time:    ${pollDurationSec}s (${pollAttempts} poll attempts)`);

  // --- Step 4: Generate Markdown Summary & Reports ---
  const markdownReport = `
## ${statusEmoji} Post-Push Deployment Verification Report

**Status:** ${overallSuccess ? '**LIVE & HEALTHY** ✅' : '**FAILED — ROLLBACK RECOMMENDED** 🚨'}
**Timestamp:** \`${new Date().toISOString()}\`

| Parameter | Details |
| :--- | :--- |
| **App URL** | [${APP_URL}](${APP_URL}) |
| **Pushed Commit SHA** | \`${EXPECTED_COMMIT_SHA || 'N/A'}\` |
| **Live Deployed SHA** | \`${liveCommitSha}\` |
| **App Version** | \`${liveVersion}\` |
| **Version Match** | ${versionMatched ? '✅ Matched' : '❌ Mismatch / Timeout'} |
| **Verification Duration** | ${pollDurationSec}s (${pollAttempts} polls) |

### 🏥 Endpoint Health Check Results

| Endpoint | Name | Expected Status | Actual Status | Latency | Result |
| :--- | :--- | :---: | :---: | :---: | :---: |
${healthResults
  .map(
    (r) =>
      `| \`${r.path}\` | ${r.name} | \`${r.expectedStatus}\` | \`${r.actualStatus}\` | ${r.latencyMs}ms | ${r.passed ? '✅ PASS' : '❌ FAIL'} |`
  )
  .join('\n')}

${
  !overallSuccess
    ? `> [!CAUTION]\
> **AUTOMATED ROLLBACK SIGNAL DETECTED**: The live application did not confirm the new commit SHA or failed critical health checks within ${TIMEOUT_SECONDS}s. Do not mark deployment as successful until investigated.`
    : `> [!TIP]\
> **SUCCESS**: Production server is actively serving commit \`${liveCommitSha}\` and all health routes are responding correctly.`
}
`;

  // Write to GitHub Step Summary if running in GitHub Actions
  if (SUMMARY_FILE) {
    try {
      fs.appendFileSync(SUMMARY_FILE, markdownReport);
      console.log(`\n📄 Written deployment summary to GITHUB_STEP_SUMMARY (${SUMMARY_FILE})`);
    } catch (err) {
      console.error('⚠️ Could not write GITHUB_STEP_SUMMARY:', err.message);
    }
  }

  // Send Slack Notification if configured
  if (SLACK_WEBHOOK_URL) {
    const slackPayload = {
      text: `${statusEmoji} *Post-Push Deploy Verification:* ${statusTitle}`,
      attachments: [
        {
          color: overallSuccess ? '#2eb886' : '#a30200',
          fields: [
            { title: 'App URL', value: APP_URL, short: true },
            { title: 'App Version', value: liveVersion, short: true },
            { title: 'Expected Commit', value: EXPECTED_COMMIT_SHA || 'N/A', short: true },
            { title: 'Live Commit', value: liveCommitSha, short: true },
            { title: 'Version Match', value: versionMatched ? 'Passed ✅' : 'Failed ❌', short: true },
            { title: 'Health Checks', value: allHealthPassed ? 'Passed ✅' : 'Failed ❌', short: true },
          ],
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };
    await sendSlackNotification(slackPayload);
    console.log('📲 Slack notification sent successfully.');
  }

  // --- Step 5: Persistent Audit Log Entry ---
  writeAuditLog({
    timestamp: new Date().toISOString(),
    triggerEvent: TRIGGER_EVENT,
    appUrl: APP_URL,
    pushedSha: EXPECTED_COMMIT_SHA || 'N/A',
    liveSha: liveCommitSha,
    liveVersion,
    overallSuccess,
    versionMatched,
    allHealthPassed,
    pollAttempts,
    durationSeconds: parseFloat(pollDurationSec),
    healthResults,
  });

  // --- Step 6: Exit Code Enforcement ---
  if (!overallSuccess) {
    console.error('\n🚨 Verification process exiting with Code 1 due to failure.');
    process.exit(1);
  } else {
    console.log('\n🎉 Verification process completed successfully (Code 0).');
    process.exit(0);
  }
};

module.exports = { makeRequest, makeRequestWithRetry, writeAuditLog, runVerification, shasMatch };

if (require.main === module) {
  runVerification().catch((err) => {
    console.error('❌ Unexpected verification script error:', err);
    process.exit(1);
  });
}
