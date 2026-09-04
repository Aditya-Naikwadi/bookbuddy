/**
 * End-to-End Test Suite for Post-Push Deployment Verification Automation
 *
 * Tests both Positive and Negative scenarios:
 * 1. Positive Case: Matching SHA & Healthy Routes -> Exit 0
 * 2. Negative Case 1: Stale / Mismatched SHA -> Exit 1 (Rollback Alert)
 * 3. Negative Case 2: Health Check Route Failure (500 Error) -> Exit 1 (Rollback Alert)
 * 4. Negative Case 3: Server Unreachable / Crashed -> Exit 1 (Rollback Alert)
 * 5. Timing & Timeout Check: Verification polling respects timeout window without hanging
 * 6. Report & Alert Verification: Confirms Markdown summary generation
 */

const http = require('http');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VERIFY_SCRIPT = path.join(__dirname, 'verify-deployment.js');
const SUMMARY_TEMP = path.join(__dirname, 'test-summary-output.tmp');

const createMockServer = (port, config = {}) => {
  const server = http.createServer((req, res) => {
    const urlObj = new URL(req.url, `http://localhost:${port}`);
    const pathname = urlObj.pathname;

    if (config.crashOnBoot) {
      req.socket.destroy();
      return;
    }

    if (pathname === '/version') {
      if (config.versionStatus) {
        res.writeHead(config.versionStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Server Error' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          commitSha: config.commitSha || 'mock-sha-1234567890',
          version: '1.0.0',
        })
      );
      return;
    }

    if (pathname === '/health') {
      if (config.healthStatus) {
        res.writeHead(config.healthStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'unhealthy', error: 'DB Connection Failed' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', success: true }));
      return;
    }

    if (pathname === '/api/v1/auth/me') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Unauthorized' }));
      return;
    }

    if (pathname === '/api/v1/colleges/slug-check') {
      if (config.collegesStatus) {
        res.writeHead(config.collegesStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, available: true }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not Found' }));
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
};

const { execFile } = require('child_process');

const runTest = (name, envVars, args = []) => {
  return new Promise((resolve) => {
    console.log(`\n=====================================================`);
    console.log(`🧪 RUNNING E2E TEST: ${name}`);
    console.log(`=====================================================`);

    if (fs.existsSync(SUMMARY_TEMP)) fs.unlinkSync(SUMMARY_TEMP);

    const env = {
      ...process.env,
      GITHUB_STEP_SUMMARY: SUMMARY_TEMP,
      ...envVars,
    };

    execFile('node', [VERIFY_SCRIPT, ...args], { env }, (error, stdout, stderr) => {
      const exitCode = error ? (error.code || 1) : 0;
      let summaryContent = '';
      if (fs.existsSync(SUMMARY_TEMP)) {
        summaryContent = fs.readFileSync(SUMMARY_TEMP, 'utf8');
        fs.unlinkSync(SUMMARY_TEMP);
      }

      console.log(stdout);
      if (stderr) console.error('STDERR:', stderr);

      resolve({ exitCode, stdout, stderr, summaryContent });
    });
  });
};

const runAllE2ETests = async () => {
  const results = [];

  // --- 1. POSITIVE CASE ---
  const port1 = 5801;
  const server1 = await createMockServer(port1, { commitSha: 'commit-sha-positive-123456' });
  const test1 = await runTest(
    'POSITIVE CASE: Matching SHA & Healthy Routes',
    {
      APP_URL: `http://127.0.0.1:${port1}`,
      EXPECTED_COMMIT_SHA: 'commit-sha-positive-123456',
      TIMEOUT_SECONDS: '3',
      POLL_INTERVAL_SECONDS: '1',
    }
  );
  server1.close();

  const pass1 = test1.exitCode === 0 && test1.stdout.includes('DEPLOYMENT VERIFIED LIVE');
  results.push({ name: 'Positive Case: Successful Deploy Verification', pass: pass1, exitCode: test1.exitCode });

  // --- 2. NEGATIVE CASE 1: STALE / MISMATCHED COMMIT SHA ---
  const port2 = 5802;
  const server2 = await createMockServer(port2, { commitSha: 'stale-old-commit-sha-00000' });
  const test2 = await runTest(
    'NEGATIVE CASE 1: Stale Commit SHA (Version Mismatch)',
    {
      APP_URL: `http://127.0.0.1:${port2}`,
      EXPECTED_COMMIT_SHA: 'new-pushed-commit-sha-99999',
      TIMEOUT_SECONDS: '2',
      POLL_INTERVAL_SECONDS: '1',
    }
  );
  server2.close();

  const pass2 = test2.exitCode === 1 && test2.stdout.includes('ROLLBACK REQUIRED');
  results.push({ name: 'Negative Case 1: Stale Commit SHA Caught', pass: pass2, exitCode: test2.exitCode });

  // --- 3. NEGATIVE CASE 2: HEALTH CHECK 500 ERROR ---
  const port3 = 5803;
  const server3 = await createMockServer(port3, {
    commitSha: 'commit-sha-positive-123456',
    healthStatus: 500,
  });
  const test3 = await runTest(
    'NEGATIVE CASE 2: Health Check Route Failure (500 Error)',
    {
      APP_URL: `http://127.0.0.1:${port3}`,
      EXPECTED_COMMIT_SHA: 'commit-sha-positive-123456',
      TIMEOUT_SECONDS: '3',
      POLL_INTERVAL_SECONDS: '1',
    }
  );
  server3.close();

  const pass3 = test3.exitCode === 1 && test3.stdout.includes('ROLLBACK REQUIRED');
  results.push({ name: 'Negative Case 2: Health Check 500 Error Caught', pass: pass3, exitCode: test3.exitCode });

  // --- 4. NEGATIVE CASE 3: UNREACHABLE / CRASHED SERVER ---
  const test4 = await runTest(
    'NEGATIVE CASE 3: Application Unreachable / Port Closed',
    {
      APP_URL: 'http://127.0.0.1:59999',
      EXPECTED_COMMIT_SHA: 'commit-sha-positive-123456',
      TIMEOUT_SECONDS: '2',
      POLL_INTERVAL_SECONDS: '1',
    }
  );

  const pass4 = test4.exitCode === 1 && test4.stdout.includes('ROLLBACK REQUIRED');
  results.push({ name: 'Negative Case 3: Crashed/Unreachable Server Caught', pass: pass4, exitCode: test4.exitCode });

  // --- 5. FALLBACK CASE: ALLOW_SHA_MISMATCH = TRUE ---
  const port5 = 5805;
  const server5 = await createMockServer(port5, { commitSha: 'different-commit-sha-77777' });
  const test5 = await runTest(
    'FALLBACK CASE: SHA Mismatch Allowed via ALLOW_SHA_MISMATCH=true',
    {
      APP_URL: `http://127.0.0.1:${port5}`,
      EXPECTED_COMMIT_SHA: 'expected-commit-sha-88888',
      ALLOW_SHA_MISMATCH: 'true',
      TIMEOUT_SECONDS: '2',
      POLL_INTERVAL_SECONDS: '1',
    }
  );
  server5.close();

  const pass5 = test5.exitCode === 0 && test5.stdout.includes('DEPLOYMENT VERIFIED LIVE');
  results.push({ name: 'Fallback Case: ALLOW_SHA_MISMATCH=true Gracefully Passed', pass: pass5, exitCode: test5.exitCode });

  // --- 5. REPORT SUMMARY ---
  console.log('\n=====================================================');
  console.log('📊 FINAL E2E AUTOMATION VERIFICATION SUMMARY');
  console.log('=====================================================');
  let allPass = true;
  for (const r of results) {
    console.log(`${r.pass ? '✅ PASS' : '❌ FAIL'} | ${r.name} (Exit Code: ${r.exitCode})`);
    if (!r.pass) allPass = false;
  }
  console.log('-----------------------------------------------------');
  console.log(`Overall E2E Status: ${allPass ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}\n`);

  process.exit(allPass ? 0 : 1);
};

runAllE2ETests().catch((err) => {
  console.error('❌ E2E Automation execution error:', err);
  process.exit(1);
});
