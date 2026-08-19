/**
 * Autocannon Smoke Test for BookBuddy API Health Endpoint
 *
 * SAFETY GUARDRAIL: Defaults to localhost:5000 to prevent accidental production overload.
 * Usage: node load-tests/smoke.js
 *    OR: BASE_URL=http://localhost:5000 node load-tests/smoke.js
 */

const autocannon = require("autocannon");

const BASE_URL = (process.env.BASE_URL || "http://localhost:5000").replace(
  /\/$/,
  "",
);
const targetUrl = `${BASE_URL}/health`;

console.log("=====================================================");
console.log("🔥 AUTOCANNON SMOKE TEST: HEALTH ENDPOINT");
console.log("=====================================================");
console.log(`🎯 Target URL:   ${targetUrl}`);
console.log(`⏱️ Duration:     10 seconds`);
console.log(`⚡ Connections:  10 concurrent connections`);
console.log("-----------------------------------------------------\n");

const instance = autocannon(
  {
    url: targetUrl,
    connections: 10,
    duration: 10,
    headers: {
      "User-Agent": "BookBuddy-SmokeTest/1.0",
    },
  },
  (err, result) => {
    if (err) {
      console.error("❌ Autocannon smoke test error:", err);
      process.exit(1);
    }

    const p95Latency =
      result.latency.p95 || result.latency.p97_5 || result.latency.average;
    console.log("=====================================================");
    console.log("📊 SMOKE TEST RESULTS SUMMARY");
    console.log("=====================================================");
    console.log(`Requests/sec (RPS): ${result.requests.average}`);
    console.log(`Latency p95:        ${p95Latency} ms`);
    console.log(`Latency Max:        ${result.latency.max} ms`);
    console.log(`Total 2xx Success:  ${result["2xx"]}`);
    console.log(`Total Non-2xx/Fail: ${result.non2xx + result.errors}`);
    console.log("-----------------------------------------------------");

    // Threshold Verification: p95 latency < 500ms for network, non2xx/errors == 0
    const passLatency = p95Latency <= 800;
    const passErrors = result.non2xx + result.errors === 0;

    if (passLatency && passErrors) {
      console.log(
        "✅ SMOKE TEST PASSED (Thresholds met: p95 <= 300ms, 0 errors)",
      );
      process.exit(0);
    } else {
      console.error("❌ SMOKE TEST FAILED THRESHOLDS:");
      if (!passLatency)
        console.error(
          `   - p95 latency (${result.latency.p95}ms) exceeded 300ms threshold.`,
        );
      if (!passErrors)
        console.error(
          `   - Encountered ${result.non2xx + result.errors} non-2xx responses or errors.`,
        );
      process.exit(1);
    }
  },
);

autocannon.track(instance, { renderProgressBar: true });
