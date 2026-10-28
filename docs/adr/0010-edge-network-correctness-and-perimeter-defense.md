# ADR 0010: Edge and Network Correctness & Perimeter Defense

- **Status**: Accepted
- **Date**: 2026-10-22
- **Deciders**: @engineering-backend-architect, @security-appsec-engineer
- **Consulted**: @engineering-devops-automator, @testing-test-automation-engineer

---

## Context and Problem Statement

When BookBuddy operates behind Cloudflare and an Nginx reverse proxy on a single GCP VM:
1. **Client IP Spoofing**: Attackers directly connecting to the VM can send forged `CF-Connecting-IP` or `X-Forwarded-For` headers to manipulate rate limits, bypass IP-based account lockout, or evade audit logging.
2. **Tenant Header Spoofing**: If the application trusts incoming `X-Tenant-Subdomain` or `X-College-Slug` headers from arbitrary external callers, an attacker could spoof institution context on the apex domain or cross-tenant boundaries.
3. **Tenant Information Leakage**: Rejection of invalid, suspended, or inactive institution slugs previously returned verbose messages (e.g. leaking the real name of suspended colleges) and disparate HTTP status codes.
4. **Health Probe Exposure**: Full system health (`/health`) and version metadata (`/version`) expose sensitive internal state (database status, Redis latency, commit SHAs, process uptime) to unauthenticated public callers.

---

## Decision Drivers

1. **Spoof-Proof Client IP Derivation**: Only honor `CF-Connecting-IP` when the direct socket peer is a verified Cloudflare edge IP or trusted local reverse proxy (Nginx).
2. **Tenant Header Perimeter**: Tenant headers must only be accepted from trusted local proxies; external clients must derive tenant identity solely from the `Host` header.
3. **Uniform Error Surface**: Return a clean, uniform 404 response for unknown or suspended slugs with zero tenant data and zero stack traces.
4. **Minimal Public Surface**: Provide a minimal public `/ping` endpoint (`status: ok`) while guarding `/health` and `/version` behind token authentication and local proxy allowlists.

---

## Decision Outcome

1. **Dedicated Client IP Helper (`clientIpHelper.js`)**:
   - Compares direct peer IP against Cloudflare's 15 published IPv4 CIDRs and 7 IPv6 CIDRs.
   - Rejects forged `CF-Connecting-IP` from direct untrusted callers.
   - Integrated into `rateLimiters.js`, `auditLog.js`, and `adminPortalController.js`.
2. **Tenant Header Guard in `subdomainTenantResolver.js`**:
   - `extractSubdomain(req)` accepts `X-Tenant-Subdomain` / `X-College-Slug` only when `req.socket.remoteAddress` is a trusted local proxy (`127.0.0.1` / `::1`).
   - Conflicting Host vs. Header requests are flagged as spoofing and blocked with HTTP 403.
3. **Uniform Unknown College Response**:
   - Unrecognized, suspended, or inactive slugs return `HTTP 404` with `{ success: false, message: 'Unknown college or institution', code: 'UNKNOWN_COLLEGE' }`.
   - Zero college names, IDs, or stack traces are emitted.
4. **App-Level Admin Portal Subdomain Block**:
   - Requests to `/api/v1/dashboards/admin-portal/*` arriving on tenant host subdomains are blocked with `HTTP 403`.
5. **Health Endpoint Hardening**:
   - Public minimal `/ping`, `/api/ping`, `/api/v1/ping` endpoints return `{ status: 'ok', timestamp: ... }`.
   - `/health` and `/version` endpoints require a matching `X-Health-Token` header, Authorization bearer token, or local proxy allowlist (`127.0.0.1`, `::1`).
   - Updated `scripts/deployment/verify-deployment.js` to support `--url`, pass `X-Health-Token`, and verify `/ping`.

---

## Verification

- Automated test suite `backend/src/tests/deploymentPhase4.test.js` passes with 18/18 tests.
- All architectural CI checks (`check:transactions`, `check:races`, `check:contracts`, `check:normalization`) remain green.
