/**
 * Render-Native & External Uptime Monitoring Script for BookBuddy
 *
 * Target: https://bookbuddy-kcwl.onrender.com
 * Service ID: srv-d9rltltbedkc73c1khkg
 */

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const { dispatchAlert } = require("./send-alert");

const RENDER_SERVICE_ID =
  process.env.RENDER_SERVICE_ID || "srv-d9rltltbedkc73c1khkg";
const RENDER_APP_URL = (
  process.env.RENDER_APP_URL || "https://bookbuddy-kcwl.onrender.com"
).replace(/\/$/, "");
const RENDER_API_KEY = process.env.RENDER_API_KEY || "";

const COLD_START_TIMEOUT_MS = 60000; // 60s grace period for Render free-tier cold starts
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 5000;
const LOG_FILE = path.join(__dirname, "..", "logs", "render-monitoring.jsonl");

const logResult = (data) => {
  try {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
      LOG_FILE,
      JSON.stringify({ timestamp: new Date().toISOString(), ...data }) + "\n",
      "utf8",
    );
  } catch (err) {
    console.error("⚠️ Could not write Render monitoring log:", err.message);
  }
};

const makeRequest = (urlStr, options = {}) => {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(urlStr);
      const isHttps = urlObj.protocol === "https:";
      const client = isHttps ? https : http;

      const req = client.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: options.method || "GET",
          headers: {
            "User-Agent": "BookBuddy-Render-Monitor/1.0",
            ...(options.headers || {}),
          },
          timeout: options.timeout || COLD_START_TIMEOUT_MS,
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            let json = null;
            try {
              json = JSON.parse(body);
            } catch {}
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body,
              json,
            });
          });
        },
      );

      req.on("timeout", () => {
        req.destroy();
        resolve({
          status: 0,
          error: "Request timed out (cold start window exceeded)",
        });
      });

      req.on("error", (err) => {
        resolve({ status: 0, error: err.message });
      });

      req.end();
    } catch (err) {
      resolve({ status: 0, error: err.message });
    }
  });
};

const checkRenderApi = async () => {
  if (!RENDER_API_KEY) {
    console.log(
      "ℹ️ RENDER_API_KEY not set. Skipping Render REST API deploy status query (using direct HTTP polling).",
    );
    return { available: false };
  }

  console.log(`📡 Querying Render API for Service ID: ${RENDER_SERVICE_ID}...`);
  const headers = { Authorization: `Bearer ${RENDER_API_KEY}` };

  const serviceRes = await makeRequest(
    `https://api.render.com/v1/services/${RENDER_SERVICE_ID}`,
    { headers },
  );
  const deploysRes = await makeRequest(
    `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys?limit=3`,
    {
      headers,
    },
  );

  if (serviceRes.status === 200 && deploysRes.status === 200) {
    const serviceObj = serviceRes.json || {};
    const service = serviceObj.service || serviceObj;
    const deploys = deploysRes.json || [];
    const firstDeploy = deploys[0] || {};
    const latestDeploy = firstDeploy.deploy || firstDeploy;

    const latestDeployStatus = latestDeploy ? latestDeploy.status : null;
    const serviceStatus = service.status || latestDeployStatus || "live";

    console.log(`   Service Name:        ${service.name || "N/A"}`);
    console.log(`   Service Status:      ${serviceStatus}`);
    console.log(
      `   Latest Deploy ID:    ${latestDeploy ? latestDeploy.id : "N/A"}`,
    );
    console.log(`   Latest Deploy State: ${latestDeployStatus || "N/A"}`);

    return {
      available: true,
      serviceName: service.name,
      serviceStatus: serviceStatus,
      latestDeployId: latestDeploy ? latestDeploy.id : null,
      latestDeployStatus: latestDeployStatus,
      latestCommitSha:
        latestDeploy && latestDeploy.commit ? latestDeploy.commit.id : null,
    };
  } else {
    console.warn(
      `⚠️ Render API query returned status: Service=${serviceRes.status}, Deploys=${deploysRes.status}`,
    );
    return {
      available: false,
      error: `Render API query non-200: Service=${serviceRes.status}, Deploys=${deploysRes.status}`,
    };
  }
};

const runRenderMonitoring = async () => {
  console.log("=====================================================");
  console.log("🌐 RENDER-NATIVE & EXTERNAL UPTIME MONITORING");
  console.log("=====================================================");
  console.log(`🎯 Service ID:     ${RENDER_SERVICE_ID}`);
  console.log(`🔗 Target URL:     ${RENDER_APP_URL}`);
  console.log(`⏱️ Cold-Start Grace: ${COLD_START_TIMEOUT_MS / 1000}s`);
  console.log(
    `🔄 Retries:         ${MAX_ATTEMPTS} attempts (${BACKOFF_MS / 1000}s backoff)`,
  );
  console.log("-----------------------------------------------------\n");

  // Step 1: Render API Check
  const renderApiData = await checkRenderApi();

  // Step 2: Direct /health Endpoint Ping with Retries
  let isHealthy = false;
  let healthPayload = null;
  let healthRes = null;
  let durationMs = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(
      `\n🏥 Pinging backend health endpoint (${RENDER_APP_URL}/health) [Attempt ${attempt}/${MAX_ATTEMPTS}]...`,
    );
    const startTime = Date.now();
    healthRes = await makeRequest(`${RENDER_APP_URL}/health`, {
      timeout: COLD_START_TIMEOUT_MS,
    });
    durationMs = Date.now() - startTime;

    if (
      healthRes.status === 200 &&
      healthRes.json &&
      (healthRes.json.status === "ok" || healthRes.json.success === true)
    ) {
      isHealthy = true;
      healthPayload = healthRes.json;
      console.log(`✅ HEALTH CHECK PASSED (${durationMs}ms)`);
      console.log(`   Status:          ${healthPayload.status || "ok"}`);
      console.log(
        `   Database State:  ${healthPayload.dbState || healthPayload.dbConnection || "connected"}`,
      );
      console.log(
        `   Environment:     ${healthPayload.environment || "production"}`,
      );
      console.log(`   Uptime:          ${healthPayload.uptime || "N/A"}`);
      break;
    } else {
      console.error(
        `⚠️ Attempt ${attempt}/${MAX_ATTEMPTS} Failed! HTTP Status: ${healthRes.status}, Response: ${
          healthRes.body || healthRes.error || "Invalid JSON payload"
        }`,
      );
      if (attempt < MAX_ATTEMPTS) {
        console.log(
          `⏱️ Waiting ${BACKOFF_MS / 1000}s for Render container warm-up...`,
        );
        await new Promise((r) => setTimeout(r, BACKOFF_MS));
      }
    }
  }

  // Step 3: Determine Overall Status & Alerting
  const validRenderDeployStates = [
    "live",
    "build_in_progress",
    "update_in_progress",
    "created",
    "pre_deploy_in_progress",
  ];
  const isRenderStatusValid =
    !renderApiData.available ||
    validRenderDeployStates.includes(renderApiData.serviceStatus) ||
    validRenderDeployStates.includes(renderApiData.latestDeployStatus);

  const overallSuccess = isHealthy && isRenderStatusValid;

  logResult({
    serviceId: RENDER_SERVICE_ID,
    url: RENDER_APP_URL,
    isHealthy,
    durationMs,
    renderApiData,
    healthPayload,
    overallSuccess,
  });

  if (!overallSuccess) {
    console.error("\n🚨 RENDER MONITORING FAILED! Dispatching alert...");
    await dispatchAlert("HEALTH_FAILURE", {
      serviceId: RENDER_SERVICE_ID,
      url: RENDER_APP_URL,
      httpStatus: healthRes ? healthRes.status : 0,
      durationMs: `${durationMs}ms`,
      renderStatus:
        renderApiData.serviceStatus ||
        renderApiData.latestDeployStatus ||
        "unknown",
      error:
        (healthRes ? healthRes.error || healthRes.body : null) ||
        "Health check returned non-200 or invalid payload",
    });
    process.exit(1);
  } else {
    console.log("\n=====================================================");
    console.log("🎉 RENDER SERVICE OPERATING NORMALLY & LIVE");
    console.log("=====================================================");
    process.exit(0);
  }
};

module.exports = { runRenderMonitoring, checkRenderApi };

if (require.main === module) {
  runRenderMonitoring().catch((err) => {
    console.error("❌ Unexpected Render monitoring error:", err);
    process.exit(1);
  });
}
