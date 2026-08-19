# ⚡ BookBuddy Load & Stress Testing Suite

This directory contains real, production-grade load and stress testing infrastructure for **BookBuddy** using **Autocannon** and **Artillery.io**.

---

## 🛡️ SAFETY GUARDRAIL (READ FIRST)

- **Default Target:** All load tests in this repository default to `http://localhost:5000` (or `process.env.BASE_URL`).
- **Production Guardrail:** **NEVER** run load tests against the live Render production URL without explicit authorization. If testing production, concurrency **MUST be capped at 10 connections max**.
- **No Benchmark Drift in Git:** Test run outputs (RPS, timing numbers) are kept out of source control as they vary by machine hardware, network latency, and time of day.

---

## 📋 Available Load Tests

### 1. Autocannon Health Smoke Test (`load-tests/smoke.js`)

- **Purpose:** High-speed endpoint sanity check on `/health`.
- **Concurrency:** 10 connections over 10 seconds.
- **Pass/Fail Thresholds:**
  - `p95 Latency` <= 300 ms
  - `Non-2xx / Errors` == 0
- **Execution:**
  ```bash
  # Test local backend (Default)
  npm run loadtest:smoke

  # Test custom environment
  BASE_URL=http://localhost:5000 npm run loadtest:smoke
  ```

---

### 2. Artillery Authenticated User Flow (`load-tests/user-flow.yml`)

- **Purpose:** Simulates complete, multi-step patron journeys:
  1. `POST /api/v1/auth/login` (Authenticates patron credentials and captures JWT Bearer token).
  2. `GET /api/v1/books?page=1&pageSize=10` (Searches catalog using Bearer token and captures `bookId`).
  3. `POST /api/v1/reservations` (Places hold on captured `bookId`).
- **Pass/Fail Thresholds:**
  - `p95 Latency` <= 300 ms
  - `Max Error Rate` < 1%
- **Execution:**
  ```bash
  # Run against local backend (Default)
  npm run loadtest:flow

  # Run against staging environment
  BASE_URL=http://localhost:5000 npm run loadtest:flow
  ```

---

## 🎯 Bottleneck Diagnosis Matrix

When analyzing load test readouts, use this guide to separate **Database Bottlenecks**, **Application Code Bottlenecks**, and **Cloud Container Hardware Ceilings**:

```
                       ┌───────────────────────────────┐
                       │    Load Test Execution Run    │
                       └───────────────┬───────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
  High Latency / Timeouts                              HTTP 502 / 503 / Crashes
            │                                                     │
    ┌───────┴────────┐                                    ┌───────┴────────┐
    ▼                ▼                                    ▼                ▼
Mongoose Pool   Event Loop Lag                        Memory OOM     Render CPU
 Bottleneck      (Bcrypt / Sync)                       Exhaustion       Ceiling
(25 Pool Max)                                         (512MB Max)
```

| Failure Pattern / Symptom                    | Primary Root Cause                      | Remediation Action                                                                            |
| :------------------------------------------- | :-------------------------------------- | :-------------------------------------------------------------------------------------------- |
| **High Latency at > 25 VUs, but CPU is low** | **Mongoose DB Connection Pool Ceiling** | Increase `MONGO_MAX_POOL_SIZE=100` in `.env` (default is 25 in `server/src/config/db.js`).    |
| **High Response Time on Login only**         | **CPU-Bound Password Hashing (Bcrypt)** | Working as intended (bcrypt cost factor 10). Offload auth or rate-limit auth routes.          |
| **HTTP 502 / 503 under high VUs on Render**  | **Render Container Memory/CPU Ceiling** | Render free-tier (512MB RAM, shared CPU) reached hardware capacity. Upgrade instance tier.    |
| **High 429 Too Many Requests**               | **Rate Limiter Gate Working Correctly** | `rate-limiter-flexible` correctly protecting endpoints. Adjust limits in `.env` if necessary. |
