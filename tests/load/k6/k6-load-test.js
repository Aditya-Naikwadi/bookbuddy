import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Production-Grade Grafana k6 Load & Stress Test for BookBuddy
 *
 * Target: Render Backend API (https://bookbuddy-kcwl.onrender.com)
 * Execution: k6 run scripts/k6-load-test.js
 */

export const options = {
  // Production Load Stages (Ramp-up -> Peak Stress -> Ramp-down)
  stages: [
    { duration: "20s", target: 20 }, // Ramp-up to 20 Virtual Users (VUs)
    { duration: "40s", target: 100 }, // Ramp-up to 100 VUs (Peak Campus Traffic)
    { duration: "30s", target: 200 }, // Stress test at 200 VUs (Spike Load)
    { duration: "20s", target: 0 }, // Graceful Ramp-down to 0 VUs
  ],

  // Service Level Objectives (SLOs) - Fails test if threshold violated
  thresholds: {
    http_req_duration: ["p(95)<300"], // 95% of requests must complete under 300ms
    http_req_failed: ["rate<0.02"], // Error rate must be under 2%
  },
};

const BASE_URL = __ENV.TARGET_URL || "https://bookbuddy-kcwl.onrender.com";

export default function () {
  const headers = {
    "User-Agent": "BookBuddy-k6-LoadTest/1.0",
    "Content-Type": "application/json",
  };

  // 1. Health Probe
  const healthRes = http.get(`${BASE_URL}/health`, { headers });
  check(healthRes, {
    "health status is 200": (r) => r.status === 200,
    "health db is connected": (r) => {
      try {
        const json = r.json();
        return json.dbState === "connected" || json.status === "ok";
      } catch {
        return false;
      }
    },
  });

  // 2. Version Check
  const versionRes = http.get(`${BASE_URL}/version`, { headers });
  check(versionRes, {
    "version status is 200": (r) => r.status === 200,
  });

  // 3. Physical Catalog Search
  const catalogRes = http.get(`${BASE_URL}/api/v1/books?page=1&pageSize=10`, {
    headers,
  });
  check(catalogRes, {
    "catalog status is 200 or 429": (r) => r.status === 200 || r.status === 429,
  });

  // Small delay simulating real human reading interval (1-2 seconds)
  sleep(Math.random() * 1 + 1);
}
