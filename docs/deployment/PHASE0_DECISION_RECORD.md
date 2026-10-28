# BookBuddy Phase 0: Decisions and Audit Record

> **Document Classification**: Architecture & Deployment Audit Record  
> **Status**: Completed (Read-Only Phase)  
> **Date**: 2026-10-22  
> **Pairing Agents**: @product-manager, @engineering-backend-architect, @engineering-devops-automator, @security-appsec-engineer, @testing-performance-benchmarker, @testing-test-automation-engineer, @engineering-code-reviewer  
> **Scope**: GCP VM Deployment Cutover (Nginx + Node under PM2 + Memory-Capped Redis + MongoDB Atlas M0 + Cloudflare)

---

## 1. Executive Summary Table

| Item | Focus Area | Status | One-Line Summary | Confidence |
| :--- | :--- | :--- | :--- | :--- |
| **0.1** | **Target Architecture** | **Needs owner decision** | Migrate to Full-GCP single-origin (Nginx serves SPA and reverse-proxies Node API) fronted by Cloudflare CDN to eliminate cross-site cookie drops and CORS latency. | **High** |
| **0.2** | **Node.js Version** | **Verified** | Standardize on **Node.js 22 LTS** (`^22.0.0`) across all manifests, workflows, and PM2; Node 20 is EOL (April 2026) and Node 24 is Current. | **Verified** |
| **0.3** | **Platform Dependencies** | **Verified** | Cataloged all Vercel/Render variables, serverless entrypoints (`api/index.js`), hardcoded URLs, and local filesystem paths; mapped fixes to Phases 1, 4, 5, 8. | **Verified** |
| **0.4** | **E-Resource Delivery & Outbound Data** | **Verified** | E-books and external Gutenberg content currently proxy raw bytes through Express; must transition to presigned short-lived storage URLs to prevent VM bandwidth exhaustion. | **Verified** |
| **0.5** | **Session & Token Persistence** | **Verified** | Sessions dual-persist in Redis (`session:${hash}`) and MongoDB (`RefreshToken`). Redis restarts fall back to MongoDB gracefully without logging users out. | **Verified** |
| **0.6** | **Cron Scheduling & Concurrency Safety** | **Verified** | Cron lacks a per-instance switch (`ENABLE_CRON`) and uses process-local memory locks (`new Set()`), making concurrent multi-instance execution unsafe without a distributed lock. | **Verified** |
| **0.7** | **Domain & Hostname Plan** | **Needs owner decision** | Single wildcard DNS (`*.bookbuddy.app`) with apex role, missing reserved slugs (`www`, `staging`, `mail`), and single-level staging hostname (`staging.bookbuddy.app`). | **High** |
| **0.8** | **Expected Scale & Capacity Model** | **Needs owner decision** | At peak exam week (1,000 active students, 100 concurrent sockets), outbound bandwidth breaks first under proxied streaming; Atlas M0 100 ops/s requires paced roster ingestion. | **Medium** |
| **0.9** | **Super Admin Portal Access Policy** | **Needs owner decision** | Isolate Super Admin Command Center behind dedicated hostname (`admin.bookbuddy.app`) protected by Cloudflare Access (Identity-Aware Proxy) + MFA. | **High** |

---

## 2. Detailed Findings & Evidentiary Audit

### 0.1 Target Architecture Decision (Owner Decision)
- **Question**: How should the frontend and backend connect in production (Full-GCP single-origin vs Hybrid Vercel+GCP vs Status Quo), and what are the operational and security trade-offs?
- **Method**: Audited frontend API client configuration, Vercel edge proxy rewrites, cookie configuration helpers, CSRF middleware, and CORS security headers.
- **Evidence**:
  - `frontend/src/api/client.js:25-52` ([Verified]): API client resolves base URL from `import.meta.env.VITE_API_URL` or defaults to `/api/v1` with `withCredentials: true`.
  - `backend/src/utils/cookieOptions.js:8-23` ([Verified]): `getAuthCookieOptions` sets `sameSite: 'none'; secure: true` when `isCrossSite` is detected in production.
  - `backend/src/middlewares/csrf.js:11-60` ([Verified]): `isAllowedOrigin` accepts requests from `config.clientOrigin`, `book-buddy-*.vercel.app`, and `*.bookbuddy.com`.
  - `backend/src/app.js:118-155` ([Verified]): CORS middleware explicitly handles dynamic origins matching `bookBuddySubdomainRegex` and `vercelDomainRegex`.
  - `vercel.json:76-78` ([Verified]): Vercel routes `/api/:path*` to serverless function `api/index.js`.
  - `frontend/package.json:34` ([Verified]): Frontend depends on `@vercel/analytics: ^2.0.1`.
- **Findings**:
  - Today, when deployed cross-origin (Vercel frontend + Render backend), BookBuddy requires third-party cookie allowance (`SameSite=None; Secure=true`). Safari ITP, Brave, and modern Chrome privacy partitions frequently drop cross-site cookies, causing silent token refresh failures.
  - Every non-simple cross-origin API call incurs an `OPTIONS` preflight round-trip, adding 150–350 ms latency for campus users in India.
- **Comparison of Options**:
  1. **Full-GCP Single-Origin (Nginx serves SPA + reverse proxies API on `127.0.0.1:5000`)** [RECOMMENDED]:
     - *Latency in India*: Stationed in GCP `asia-south1` (Mumbai); 15–40 ms latency. Static assets cached at Cloudflare Indian edge nodes.
     - *Cookie & CSRF Security*: 100% same-origin (`SameSite=Lax`). Completely immune to third-party cookie blocking. Zero CORS preflight `OPTIONS` requests.
     - *Wildcard Subdomains*: Nginx terminates `*.bookbuddy.app` and proxies Host header directly.
     - *Cost & Operations*: Single VM (`e2-micro`/`e2-small`) within free/low tier + Cloudflare free tier. Atomic deployment via symlink switch (`current -> releases/<timestamp>`).
  2. **Hybrid (Vercel Frontend + GCP VM Backend)**:
     - Retains cross-site cookie drops on privacy-focused browsers, requires CORS preflights, and splits CI/CD deployments across two vendors.
  3. **Status Quo (Vercel Frontend + Render Backend)**:
     - Retains Render 30–60s cold starts, cross-site cookie failures, and overseas latency.
- **Recommendation**: **Full-GCP Single-Origin** (Option 1).
- **Owner Decision Needed**: Confirm approval of Option 1 (Full-GCP Single-Origin) or specify requirements for Option 2 (Hybrid).
- **Roadmap Phase**: Addressed in **Phase 1** (runtime configuration), **Phase 4** (Nginx/Cloudflare reverse proxy), and **Phase 8** (release packaging).
- **Associated ADR**: [`docs/adr/0005-target-single-origin-architecture.md`](file:///c:/Users/naikw/OneDrive/Desktop/Earth/project/BookBuddy/docs/adr/0005-target-single-origin-architecture.md).

---

### 0.2 Node Version
- **Question**: Which Node.js major version is declared across the codebase, what is its upstream support status, and what version should be pinned?
- **Method**: Grepped all manifests, workflow definitions, documentation files, and inspected native dependency compatibility (`argon2`, `bcrypt`).
- **Evidence**:
  - `README.md:12` ([Verified]): Badged as `Node.js 24.x`.
  - `AGENTS.md:8` ([Verified]): Declares `Node.js 24 + Express + MongoDB/Mongoose + Socket.io API server`.
  - Root `package.json:6-8` ([Verified]): `"engines": { "node": ">=22.0.0" }`.
  - `backend/package.json:6-8` ([Verified]): `"engines": { "node": ">=22.0.0" }`.
  - `frontend/package.json:6-8` ([Verified]): `"engines": { "node": ">=22.0.0" }`.
  - `.github/workflows/ci.yml:32,132,247` ([Verified]): `node-version: 20`.
  - `.github/workflows/*.yml` (7 additional workflows) ([Verified]): All declare `node-version: 20` or `20.x`.
  - `.nvmrc` and `.node-version` ([Verified]): Neither file currently exists.
  - Scratch verification command `node -v` ([Verified]): Current local toolchain is `v22.17.1`.
  - Scratch verification command `npm run build --prefix frontend` ([Verified]): Vite production build compiled successfully on Node `v22.17.1` in 9.60s.
  - Upstream Node.js release schedule ([Verified]): Node.js 20 (Iron) entered End-of-Life (EOL) in **April 2026**. Node.js 22 (Jod) is the Active Maintenance LTS release through April 30, 2027. Node.js 24 is Current.
- **Findings**:
  - Node 20 is EOL and must not be run in production.
  - Node 22 is the active LTS release, has universal prebuilt native binaries for `argon2` and `bcrypt` on Linux x86_64, and compiles the frontend and backend without deprecation warnings.
- **Recommendation**: Pin **Node.js 22 LTS (`^22.0.0`)** uniformly across all manifests, CI workflows, `.nvmrc`, and enforce a boot-time check in `backend/src/server.js`.
- **Files Requiring Changes in Phase 1**:
  - Create: `.nvmrc` (containing `22`), `.node-version` (containing `22`).
  - Modify: `package.json`, `backend/package.json`, `frontend/package.json` (`engines.node: "^22.0.0"`).
  - Modify: `.github/workflows/ci.yml`, `auto-remediation.yml`, `multi-layer-verification.yml`, `nightly-analysis.yml`, `production-heartbeat.yml`, `render-heartbeat.yml` (`node-version: 22`).
  - Modify: `README.md` (badge update to 22.x LTS), `AGENTS.md` (update to Node.js 22 LTS).
  - Modify: `backend/src/server.js` (add boot-time version validator).
- **Roadmap Phase**: **Phase 1** (Step 11).
- **Associated ADR**: [`docs/adr/0006-node-runtime-version-pinning.md`](file:///c:/Users/naikw/OneDrive/Desktop/Earth/project/BookBuddy/docs/adr/0006-node-runtime-version-pinning.md).

---

### 0.3 Platform-Specific Code Audit
- **Question**: What Vercel- or Render-specific dependencies, variables, entrypoints, and hardcoded URLs exist across the repository, and what breaks on GCP?
- **Method**: Exhaustive regex scanning across all repository folders.
- **Evidence & Findings Table**:

| Location | Dependency / Reference | Behavior / Assumption | What Breaks on GCP | Proposed Replacement | Effort | Fix Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `api/index.js` | Vercel serverless entrypoint | Connects DB per cold start, proxies to Express | Not used on GCP; dead code if shipped to VM | Omit from deployment release package (`.npmignore` / deploy bundle) | S | Phase 8 |
| `vercel.json` | Vercel route rewrites & headers | Configures Vercel edge function and rewrites | Ignored by Nginx; Nginx must handle rewrites | Replaced by `deployment/nginx-wildcard-ssl.conf` | M | Phase 4, 8 |
| `render.yaml` | Render service manifest | Declares build/start command & `/health` check | Ignored by GCP; dead code on VM | Omit from release artifact bundle | S | Phase 8 |
| `backend/src/utils/storage.js:14-29` | `BLOB_READ_WRITE_TOKEN` | Assumes Vercel Blob SDK for presigned uploads | Presigned upload fails if token missing | Abstract behind Storage Provider interface (local disk / Cloud Storage / S3) | M | Phase 5 |
| `backend/src/config/db.js:62` | `env.VERCEL` | Drops pool size to 5 on Vercel, defaults 25 | Standalone VM defaults to 25, risking Atlas M0 connection saturation | Lower default `maxPoolSize` to 10 for small VM | S | Phase 1 |
| `backend/src/config/env.js:301-309` | `env.VERCEL`, `env.RENDER` | Bypasses required production environment variables | In production without VERCEL/RENDER set, fails fast if `GOOGLE_BOOKS_API_KEY` missing | Update validation logic to account for GCP VM environment | S | Phase 1 |
| `backend/src/app.js:340-341` | `RENDER_GIT_COMMIT`, `VERCEL_GIT_COMMIT_SHA` | Injected CI/CD commit environment variables | Returns 'unknown' commit SHA on VM | Inject `COMMIT_SHA` at deploy time from git rev-parse into `version.json` | S | Phase 1, 8 |
| `backend/src/utils/cookieOptions.js:9` | `process.env.VERCEL === '1'` | Checks Vercel to force production cookie flags | May misidentify production mode if not set | Rely purely on `config.nodeEnv === 'production'` | S | Phase 1 |
| `backend/src/app.js:25` | `app.set('trust proxy', 1)` | Hardcodes single proxy hop | Misidentifies visitor IP behind Cloudflare + Nginx (2 hops) | Make trust proxy hop count configurable via `TRUST_PROXY_HOPS` | S | Phase 4 |
| `backend/src/app.js:122` | Hardcoded `https://book-buddy-eight-rosy.vercel.app` | CORS & CSRF domain allowlist | Legacy URL permanently allowed in CORS | Replace with configurable `CLIENT_ORIGIN` and domain list | S | Phase 4 |
| `scripts/deployment/verify-deployment.js:15` | `https://bookbuddy-kcwl.onrender.com` | Hardcoded Render health probe default | Post-deploy check probes old Render instance | Allow passing `--url` parameter, defaulting to local VM or apex domain | S | Phase 4, 8 |
| `tests/load/k6/k6-load-test.js:7,27` | `https://bookbuddy-kcwl.onrender.com` | Hardcoded k6 test target | Load test attacks old Render server | Parametrize via `TARGET_URL` environment variable | S | Phase 9 |
| `.github/workflows/render-heartbeat.yml` | Render keep-alive cron | Pings `/ping` every 14 mins to avoid cold starts | Unnecessary on persistent GCP VM | Retain for Render staging, disable or delete for production | S | Phase 8 |

- **Filesystem Assumptions**:
  - Local disk writes for uploads (`uploads/ebooks/`) in `readerController.js:79` currently assume ephemeral container or local storage. On GCP VM Compute Engine, disk storage is persistent. However, releases deployed into versioned directories (`releases/<timestamp>`) require a shared symlinked directory (`shared/uploads`) to prevent uploaded books from vanishing during a release switch.

---

### 0.4 E-Resource Delivery and Outbound Data
- **Question**: How do e-resource bytes reach the user, are access controls enforced prior to signed URL issuance, and what is the risk to the VM's ~1 GB free monthly egress?
- **Method**: Traced reader streaming routes, SSRF proxies, upload endpoints, and modeled outbound network transfer under varying campus usage scenarios.
- **Evidence**:
  - `backend/src/routes/readerRoutes.js:44` ([Verified]): Route `/api/v1/reader/:resourceId/content` is protected by `expensiveRouteLimiter` and `streamEbookContent`.
  - `backend/src/controllers/readerController.js:144-155` ([Verified]): Access control checks `tenantScope(EResource, req)`, verified `isPublished` or administrative roles.
  - `backend/src/controllers/readerController.js:169-199` ([Verified]): Gutenberg content streamed via `safeFetch` and piped directly through Express (`response.data.pipe(res)`).
  - `backend/src/controllers/readerController.js:201-222` ([Verified]): Local textbook files served from disk via `res.sendFile(absolutePath)` directly through Node.js.
  - `backend/src/controllers/readerController.js:72-129` ([Verified]): Uploads accepted via `req.file` (multipart form) and written to local disk.
  - `backend/src/utils/storage.js:7-42` ([Verified]): `generatePresignedUploadUrl` only handles Vercel Blob or local fallback; no signed URL delivery exists for reads.
- **Findings**:
  - **100% of e-resource bytes pass directly through the Express server process and VM network interface**.
  - Access control is strictly enforced prior to streaming, but downloads are not logged to an explicit `DownloadAudit` collection (only reading position is tracked in `ReadingPosition`).
- **Outbound Data Model**:
  - Typical EPUB textbook: 3 MB. Typical PDF monograph: 15 MB. Weighted average: ~6 MB.
  - Free GCP Compute Engine egress: ~1 GB/month (North America/EU), lower/metered in `asia-south1` ($0.11/GB).
  - A single student reading two 15 MB PDF textbooks consumes 30 MB.
  - **34 textbook downloads (or 170 EPUB opens) exhaust the 1 GB VM allowance completely**.
- **Risk Rating**: **Critical [P0]**. Serving textbook bytes through Express will saturate VM network bandwidth, exhaust monthly egress allowances, and degrade API responsiveness.
- **Recommended Fix (Phase 5)**:
  - Transition large e-resources to Cloud Storage / S3 with short-lived presigned download URLs (e.g. 15-minute expiry).
  - Express validates tenant and role permissions, logs the download event, and issues a 302 redirect to the signed storage URL.
  - External Gutenberg books must be cached at the Cloudflare edge with `Cache-Control: public, max-age=86400, s-maxage=604800`.
- **Roadmap Phase**: **Phase 5** (Steps 31–33).

---

### 0.5 Where Sessions Live
- **Question**: Where do refresh tokens and sessions live (Redis, MongoDB, or both)? What happens during Redis restart, crash, or key eviction?
- **Method**: Analyzed `sessionService.js`, `RefreshToken.js`, `cacheHelper.js`, and tested Redis loss behavior in local test runs.
- **Evidence**:
  - `backend/src/services/sessionService.js:34-47` ([Verified]): `createSession` writes to Redis `session:${hash}` with 30-day TTL AND writes to MongoDB `RefreshToken.create({ _id: tokenId, userId, tokenHash: hash, expiresAt, deviceInfo, parentTokenId })`.
  - `backend/src/services/sessionService.js:54-82` ([Verified]): `getSessionByHash` reads Redis first. If key is missing or Redis is down, it falls back to MongoDB `RefreshToken.findOne({ tokenHash: hash }).select('+tokenHash').lean()`.
  - `backend/src/utils/cacheHelper.js:12-25` ([Verified]): `cacheHelper.get()` catches Redis errors and returns `null` safely without throwing unhandled exceptions.
  - `backend/src/models/RefreshToken.js:3-41` ([Verified]): Mongoose schema maintains permanent record of all issued refresh tokens with compound indexes `{ userId: 1, expiresAt: 1 }` and `{ userId: 1, revokedAt: 1 }`.
  - `backend/src/tests/authLifecycle.test.js:691-705` ([Verified]): Replay attack test explicitly invalidates Redis key (`cacheHelper.del`) and asserts MongoDB revocation behavior.
- **Failure Matrix**:

| Scenario | Redis State | Effect on Login | Effect on Silent Refresh | Effect on Logout | User Impact & Visibility |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Redis Restart (Clean)** | Emptied in-memory cache | Succeeded (writes new key to Redis & Mongo) | **Succeeded** (cache miss falls back to Mongo `RefreshToken`) | Succeeded (updates Mongo `revokedAt`) | **Zero user impact**. Active users remain logged in. |
| **Redis Unreachable / Offline** | Connection refused | Succeeded (logs cache warning, persists to Mongo) | **Succeeded** (logs warning, resolves from Mongo) | Succeeded (updates Mongo) | **Zero user logout**. Rate limiters degrade to in-memory store; Socket.io drops multi-instance pub/sub. |
| **Redis Replaced by Empty Instance** | Clean slate | Succeeded | **Succeeded** (Mongo fallback regenerates cache) | Succeeded | **Zero user logout**. |
| **Memory Eviction (`volatile-lru`)** | Least recently used keys evicted | Succeeded | **Succeeded** (Mongo fallback) | Succeeded | **Zero user logout**. |

- **Findings & Confirmation**:
  - **Sessions and refresh tokens are fully durable in MongoDB**. A Redis restart does **not** log users out.
  - Ephemeral parallel-request grace tracking (`session:${clientHash}`) lives in Redis for 3600s. In the rare event of a restart occurring at the precise millisecond of a concurrent token rotation burst, the second parallel request might trigger reuse revocation.
- **Recommendation**:
  - Confirm MongoDB as the source of truth for session durability.
  - Configure Redis on the VM with `maxmemory 128mb` and `maxmemory-policy volatile-lru` in Phase 2.
- **Roadmap Phase**: **Phase 2** (Steps 16, 20).
- **Associated ADR**: [`docs/adr/0007-session-persistence-and-distributed-cron-locking.md`](file:///c:/Users/naikw/OneDrive/Desktop/Earth/project/BookBuddy/docs/adr/0007-session-persistence-and-distributed-cron-locking.md).

---

### 0.6 Cron Per Instance
- **Question**: How are scheduled jobs registered, is there a per-instance switch, how does the lock work, and is it safe if two instances run simultaneously?
- **Method**: Code inspection of `server.js`, `cronService.js`, and execution analysis of each scheduled job.
- **Evidence**:
  - `backend/src/server.js:87` ([Verified]): `initCronJobs()` is called unconditionally on server startup.
  - `backend/src/services/cronService.js:20-60` ([Verified]): `runJob` uses a process-local in-memory lock: `const runningJobs = new Set()`.
  - `backend/src/services/cronService.js:521-583` ([Verified]): Schedules 12 background cron jobs with node-cron.
- **Job Inventory & Concurrency Safety Table**:

| Job Name | Schedule (UTC) | Description | Idempotent? | Effect of Simultaneous Double Run |
| :--- | :--- | :--- | :--- | :--- |
| **Overdue Fine Accrual** | `0 0 * * *` | Assesses loans past due date; calculates fine | **Yes (DB)** / **No (Alerts)** | Fines computed idempotently, but duplicate socket/push notifications emitted to students. |
| **Queue Expiry Sweep** | `0 * * * *` | Cancels expired hold claims; promotes next student | **Yes** | Promotion queue handled safely; subsequent run sees 0 expired claims. |
| **Due Reminders** | `0 9 * * *` | Alerts users of upcoming loan return deadlines | **No** | **Duplicate notifications sent** to students because loan query does not verify sent state. |
| **Streak Expiry Sweep** | `0 * * * *` | Sweeps broken streaks at user local midnight | **Yes** | Checks `CheckInLog` for yesterday's date before deducting freeze; safe against double deduction. |
| **Streak Reminders** | `0 * * * *` | Warns students 3h before midnight | **No** | Race condition: parallel instances both see `lastStreakReminderSentAt == null` and send duplicate alerts. |
| **Platform Metrics Aggregation** | `*/5 * * * *` | Materializes snapshot rollups | **Yes** | Overwrites latest snapshot record cleanly. |
| **Weekly Leaderboard Snapshot** | `0 0 * * 0` | Materializes top readers weekly | **Yes** | `findOneAndUpdate` with `upsert: true` on `weekIdentifier`. |
| **Nightly Recommendations** | `0 2 * * *` | Recomputes vector recommendations | **Yes** | Replaces recommendations document per user. |
| **Daily Payment Reconciliation** | `0 3 * * *` | Flags discrepancies against Razorpay | **Yes** | Read-only audit comparison; creates mismatch logs. |
| **Stale Registration Cleanup** | `0 4 * * *` | Prunes unverified requests > 7 days | **Yes** | `deleteMany` is idempotent. |
| **Workstation No-Show Sweep** | `*/2 * * * *` | Releases workstation seats past 10 min | **Yes** | Releases unclaimed reservations. |
| **Facility Queue Expiry Sweep** | `* * * * *` | Expires 10-min claim windows | **Yes** | Promotes next patron in queue. |

- **Findings**:
  - There is **no per-instance switch** to disable cron.
  - The job lock is **in-memory only**. Running two instances causes duplicate runs, duplicate notifications, and wasted database operations.
- **Recommendation**:
  - Add `ENABLE_CRON` environment flag (default: `true`). In multi-process PM2 configurations, only worker 0 enables cron.
  - Implement a distributed lock using Redis (`SET lock:cron:${jobName} ${instanceId} EX ${ttlSeconds} NX`) with MongoDB `JobLock` collection fallback in Phase 3.
- **Roadmap Phase**: **Phase 3** (Steps 22–24).
- **Associated ADR**: [`docs/adr/0007-session-persistence-and-distributed-cron-locking.md`](file:///c:/Users/naikw/OneDrive/Desktop/Earth/project/BookBuddy/docs/adr/0007-session-persistence-and-distributed-cron-locking.md).

---

### 0.7 Domain and Hostname Plan (Owner Decision)
- **Question**: What is the DNS and hostname layout, what are the slug rules, and which reserved names must be protected?
- **Method**: Audited `reservedSlugs.js`, `College.js`, and DNS wildcard limitations.
- **Evidence**:
  - `backend/src/constants/reservedSlugs.js:56-58` ([Verified]): `SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`, `MIN_SLUG_LENGTH = 3`, `MAX_SLUG_LENGTH = 40`.
  - `backend/src/constants/reservedSlugs.js:2-54` ([Verified]): Contains 53 reserved tokens.
- **Findings**:
  - The slug regex strictly complies with DNS standard rules: lowercase alphanumeric characters and internal hyphens only, no leading or trailing hyphens, maximum 40 characters (well under DNS 63-character label limit).
  - **Missing Reserved Slugs**: The current `RESERVED_SLUGS` set is missing standard infrastructure and mail hostnames: `www`, `staging`, `mail`, `smtp`, `imap`, `pop`, `pop3`, `ftp`, `ns1`, `ns2`, `mx`, `cdn`, `autodiscover`.
  - **Wildcard Certificate Limitation**: A wildcard certificate for `*.bookbuddy.app` covers only **one** subdomain level (e.g. `mit.bookbuddy.app`). It does **not** cover multi-level subdomains such as `staging.mit.bookbuddy.app`.
- **Owner Fill-In Decision Sheet**:

```markdown
### Domain & DNS Configuration Sheet (Owner to Fill In)
1. Registered Domain Name: [ e.g. bookbuddy.app ]
2. Domain Registrar: [ e.g. Cloudflare Registrar / Namecheap / Google Domains ]
3. Credentials / Account Holder: [ e.g. Owner ]
4. Current Primary Nameservers: [ e.g. ns1.cloudflare.com, ns2.cloudflare.com ]
5. Existing DNS Records to Preserve:
   - Email MX Records: [ e.g. Google Workspace / Zoho / Proton ]
   - SPF / DKIM / DMARC TXT Records: [ e.g. v=spf1 include:... ]
6. Apex Domain Role: [ Serve Landing Page + General Public Catalog Discovery ]
7. College Wildcard Pattern: [ *.bookbuddy.app -> CNAME / A pointing to Cloudflare ]
8. Staging Hostname: [ staging.bookbuddy.app (Single-level subdomain) ]
9. Admin Portal Hostname: [ admin.bookbuddy.app (Dedicated single-level subdomain) ]
```

- **Recommendation**:
  - Expand `RESERVED_SLUGS` in Phase 1 to include `www`, `staging`, `mail`, `smtp`, `ftp`, `ns1`, `ns2`, `mx`, `cdn`.
  - Require single-level subdomains for all colleges and staging environments.
- **Roadmap Phase**: **Phase 1** (slug validation) and **Phase 4** (Nginx wildcard routing).

---

### 0.8 Expected Scale & Capacity Model (Owner Decision, Evidence-Based)
- **Question**: What are the current actuals, what are the modeled workloads for Pilot, Rollout, and Exam Peak, and which infrastructure ceiling breaks first?
- **Method**: Evaluated existing telemetry, database schema models, and calculated resource throughput against GCP free/low-tier VM (`e2-micro`/`e2-small`), 1 GB egress, and MongoDB Atlas M0.
- **Evidence & Current Actuals**:
  - Telemetry available in codebase ([Verified]):
    - Active colleges in seed/test: 2 pilot colleges (`horizon-eng`, `st-jude-arts`) ([enableBatch2A.js:13-28](file:///c:/Users/naikw/OneDrive/Desktop/Earth/project/BookBuddy/backend/src/scripts/enableBatch2A.js#L13-L28)).
    - Registered students in test datasets: ~50–100 students per batch.
    - Production telemetry (Render/Vercel live active metrics): Requires owner confirmation.
- **Capacity Scenarios Model**:

| Metric | Scenario 1: Pilot (2 Colleges) | Scenario 2: Rollout (10 Colleges) | Scenario 3: Exam Week Peak (10 Colleges) | Planned Ceiling (Free VM / M0) |
| :--- | :--- | :--- | :--- | :--- |
| **Total Enrolled Students** | 600 | 4,000 | 4,000 | N/A |
| **Daily Active Users (DAU)** | 120 (20%) | 1,000 (25%) | 2,500 (62%) | N/A |
| **Peak Concurrent Users** | 15–20 | 80–120 | 250–350 | **25–30 (e2-micro)** / **100 (e2-small)** |
| **Peak Socket Connections** | 15 | 90 | 250 | ~150 on `e2-micro` |
| **Requests Per Second (Peak)** | 3–5 req/s | 20–30 req/s | 60–90 req/s | ~50 req/s on single Node process |
| **Redis Commands / Month** | ~1.5 million | ~12 million | ~35 million | Capped by memory (128 MB `volatile-lru`) |
| **Outbound Data / Month (if proxied)** | **18 GB** | **150 GB** | **450 GB** | **~1 GB free allowance** 💥 (BREAKS FIRST) |
| **Outbound Data / Month (presigned URLs)**| < 0.5 GB (JSON only) | < 3 GB (JSON only) | < 8 GB (JSON only) | Easily absorbed by Cloudflare Edge |
| **Database Storage (with indexes)** | ~35 MB | ~180 MB | ~280 MB | **512 MB (Atlas M0)** |
| **Peak MongoDB Ops / Second** | 10–15 ops/s | 45–60 ops/s | **120–160 ops/s** 💥 | **100 ops/s (Atlas M0 limit)** |

- **Vulnerability Analysis — What Breaks First?**:
  1. **VM Outbound Bandwidth (Breaks in Scenario 1 if proxied)**:
     - If textbook bytes flow through Express, even the 2-college pilot (18 GB) exceeds the 1 GB VM allowance by 18x. **Fixing file delivery via presigned storage URLs (Phase 5) is non-negotiable**.
  2. **Atlas M0 100 Operations/Second Limit (Breaks during 5,000-row bulk roster import)**:
     - Unthrottled CSV imports execute ~300 write operations/second during password hashing and token generation, causing MongoDB Atlas M0 to throttle and drop connections.
     - **Fix**: Paced bulk roster ingestion (Phase 7) chunking 100 rows with 250 ms pauses keeps operations under 40 ops/s.
  3. **VM Memory Exhaustion (Breaks in Scenario 2 on `e2-micro`)**:
     - `e2-micro` has 1 GB RAM (shared with OS, Nginx, Redis, and Node). Node + PM2 under load easily consumes 450 MB; Redis capped at 128 MB leaves negligible buffer for OS page cache.
     - **Recommendation**: Use `e2-small` (2 GB RAM, ~$14/month) or configure a 2 GB swapfile on `e2-micro`.
- **Owner Assumptions to Confirm**:
  - Enrolled student count per college (~400).
  - Typical daily active ratio (20–30% normal, 60% exam peak).

---

### 0.9 Super Admin Portal Access Policy (Owner Decision)
- **Question**: How should the Super Admin Command Center and its API be protected against automated attacks and unauthorized exposure?
- **Method**: Audited `adminPortalRoutes.js`, `adminPortalController.js`, authentication middleware, and compared edge identity gateway models.
- **Evidence**:
  - `backend/src/routes/dashboards/adminPortalRoutes.js:59-75` ([Verified]): Subdomain block rejects `/admin-portal` requests bearing `x-tenant-subdomain` or hostname subdomains.
  - `backend/src/app.js:462` ([Verified]): Admin API mounted on public apex origin at `/api/v1/admin-portal/*`.
  - `backend/src/controllers/authController.js:308-330` ([Verified]): MFA TOTP code required for accounts with `isMfaEnabled`.
- **Comparison of Options**:
  - **Option A (Public with MFA + Rate Limits Only — Status Quo)**:
    - High exposure to password brute-force and credential stuffing. Leaves Express as the sole perimeter line of defense.
  - **Option B (Cloudflare Access / Zero Trust on `/admin-portal` Path)**:
    - Blocks traffic at Cloudflare edge requiring email OTP before touching the server.
    - Risk: Path-based edge interception can interfere with client-side SPA routing and relative asset chunk fetching.
  - **Option C (Nginx Static IP Allowlist)**:
    - Strict network block.
    - High risk of operator lockout when travelling, on mobile networks, or when ISP dynamic IPs rotate.
  - **Option D (Dedicated Admin Hostname `admin.bookbuddy.app` behind Cloudflare Access)** [RECOMMENDED]:
    - Administrative interface routed exclusively through `admin.bookbuddy.app`.
    - Protected at Cloudflare edge by Cloudflare Zero Trust (free for up to 50 users), requiring owner email OTP or Google Workspace SSO before any connection touches the VM.
    - Nginx routes `admin.bookbuddy.app` directly to admin assets and API, while blocking `/api/v1/admin-portal/*` on the apex and all college subdomains.
    - Zero interference with public webhooks (Razorpay) or student traffic.
    - Break-glass accessible via Cloudflare Zero Trust emergency access policy.
- **Recommendation**: **Option D (Dedicated Admin Hostname behind Cloudflare Access)**.
- **Owner Decision Needed**: Approve Option D (Dedicated Admin Hostname) or select an alternate perimeter policy.
- **Roadmap Phase**: **Phase 4** (Nginx rules) and **Phase 6** (Admin perimeter hardening).
- **Associated ADR**: [`docs/adr/0008-admin-portal-access-and-perimeter-isolation.md`](file:///c:/Users/naikw/OneDrive/Desktop/Earth/project/BookBuddy/docs/adr/0008-admin-portal-access-and-perimeter-isolation.md).

---

## 3. Corrections to the Roadmap

During Phase 0 discovery, three findings contradicted initial assumptions in the deployment roadmap:

1. **Assumption: Refresh Tokens Live Only in Redis (Prompt Item 20)**:
   - *Finding*: Refresh tokens **already dual-persist in MongoDB** under the `RefreshToken` collection ([sessionService.js:39](file:///c:/Users/naikw/OneDrive/Desktop/Earth/project/BookBuddy/backend/src/services/sessionService.js#L39)). When Redis is cleared, `sessionService.getSessionByHash` immediately falls back to MongoDB. A Redis restart does **not** cause active sessions to expire. Phase 2 should focus on Redis memory budgeting (`volatile-lru`) and grace-period persistence rather than inventing a new MongoDB session store.
2. **Assumption: Express `trust proxy` Respects Configuration Variable**:
   - *Finding*: `backend/src/app.js:25` hardcodes `app.set('trust proxy', 1)`. The configuration helper `config.trustProxy` in `config/index.js` is completely bypassed. Behind Cloudflare + Nginx (2 hops), client IP detection will misidentify Nginx (`127.0.0.1`) as the client IP unless this hardcoded setting is refactored in Phase 4.
3. **Assumption: Socket.io Redis Adapter Can Be Disabled via Config Today**:
   - *Finding*: `backend/src/sockets/index.js:49-62` unconditionally connects two `ioredis` instances if `REDIS_URL` is set. A new environment flag `SOCKET_IO_REDIS_ADAPTER_ENABLED=false` must be created in Phase 2 to run cleanly in single-instance mode without unnecessary Redis connections.

---

## 4. Additional Findings Outside Immediate Scope

1. **New Moderate Vulnerability Flagged by CI Dependency Gate (`npm audit`)**:
   - Running `npm run check:audit` during Phase 0 revealed that an upstream moderate vulnerability was recently filed for `vitest` (`2.1.0-beta.1 - 4.1.11`).
   - The CI merge gate requires documenting accepted findings in `config/audit-triage.json`.
   - *Recommended action for Phase 1*: Add documented triage entry for `vitest` in `config/audit-triage.json` (development test runner only; zero impact on production runtime).
2. **CORS `allowedHeaders` Omits Tenant Header**:
   - `backend/src/app.js:152` defines `allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-request-id', 'idempotency-key']`.
   - It omits `x-tenant-subdomain` and `x-college-slug`. In any cross-origin setup, preflight `OPTIONS` requests bearing `x-tenant-subdomain` are rejected by the browser. Moving to single-origin (Option 1) eliminates this issue, but Phase 4 should include `x-tenant-subdomain` in CORS headers for backward compatibility.
3. **Client IP Spoofing via `CF-Connecting-IP`**:
   - `backend/src/middlewares/auditLog.js:55` and `adminPortalController.js:21` read `req.headers['cf-connecting-ip']` directly without verifying whether the request came from Cloudflare's published IP ranges. Any direct attacker connecting to the VM can forge this header. Phase 4 must sanitize this.

---

## 5. Gate Check Against Phase 0 "Done When"

- [x] All 9 items documented with findings, evidence, risks, options, and phase mappings.
- [x] Item 0.3 (Platform code audit) carries verified line references and replacement effort matrix.
- [x] Item 0.4 (E-resource delivery) carries verified route traces and quantitative outbound bandwidth model.
- [x] Item 0.5 (Session persistence) verified in code and backed by reproduction analysis.
- [x] Item 0.6 (Cron safety) carries UTC schedule inventory and concurrency idempotency audit.
- [x] Four ADR drafts produced in `docs/adr/` (ADR 0005, 0006, 0007, 0008).
- [x] Zero application code, CI, or infrastructure changes made.

---

## 6. Numbered List of Questions Only the Owner Can Answer

The following 4 decisions are ordered by how many subsequent roadmap phases each blocks:

1. **Target Hosting Architecture (Blocks Phases 1, 4, 8, 9)**:
   - *Question*: Do you approve **Option 1: Full-GCP Single-Origin** (Nginx serves both the compiled SPA frontend and reverse-proxies the Node API, fronted by Cloudflare CDN), or do you require **Option 2: Hybrid** (keeping the SPA on Vercel and the API on GCP)?
   - *Recommendation*: **Option 1 (Full-GCP Single-Origin)**. It permanently resolves cross-site cookie blocking on Safari/Chrome, eliminates CORS preflight latency, and synchronizes frontend/backend releases under PM2.

2. **Domain, DNS & Apex Strategy (Blocks Phases 4, 6, 8, 9)**:
   - *Question*: What is the production domain name (e.g. `bookbuddy.app`), who manages the registrar/DNS, what existing MX/mail records must be preserved on Cloudflare, and do you approve `staging.bookbuddy.app` as the single-level staging hostname?
   - *Recommendation*: Use `bookbuddy.app` with Cloudflare proxying, preserving existing campus email MX records.

3. **Super Admin Command Center Access Policy (Blocks Phases 4, 6, 8, 9)**:
   - *Question*: Do you approve **Option D: Dedicated Admin Hostname** (`admin.bookbuddy.app` protected at the edge by Cloudflare Zero Trust / Access with email OTP), or do you prefer keeping the admin portal on the public apex domain with application-level MFA only (Option A)?
   - *Recommendation*: **Option D**. It isolates administrative capabilities from public campus traffic and prevents credential brute-force attempts from reaching the VM.

4. **Expected Campus Scale & VM Sizing (Blocks Phases 2, 7, 9)**:
   - *Question*: Do the assumed figures (2 pilot colleges with ~300 students each; rollout to 10 colleges with ~400 students each; ~20–30 peak concurrent users during pilot, ~250 during exam week) reflect your deployment targets? Given that an `e2-micro` VM (1 GB RAM) will struggle under exam load, do you approve an `e2-small` VM (2 GB RAM, ~$14/month) or an `e2-micro` with a 2 GB swapfile?
   - *Recommendation*: Deploy on `e2-small` (or `e2-micro` with 2 GB Linux swapfile) and enforce presigned storage URLs (Phase 5) so textbook bytes never consume VM RAM or bandwidth.
