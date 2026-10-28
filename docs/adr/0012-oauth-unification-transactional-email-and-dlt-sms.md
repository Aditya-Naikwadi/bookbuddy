# ADR 0012: OAuth Callback Unification, Transactional Email Delivery, and Indian DLT SMS Compliance

## Status
Accepted

## Context
As BookBuddy transitions from individual cloud PaaS instances (Render/Vercel) to a unified GCP VM topology fronted by Cloudflare while remaining multi-tenant:
1. **OAuth Callbacks (Step 34)**:
   - Previously, Google and GitHub OAuth callbacks were configured to point to ad-hoc endpoints or localhost, with no multi-tenant institutional context preserved during the round-trip.
   - Attackers could potentially exploit the post-auth redirection as an open redirect if target URLs were not strictly bound to verified institutional domains or relative routes.
   - Cross-tenant user hijacking could occur if state parameters did not carry tamper-proof tenant context.
2. **Email Delivery (Step 35)**:
   - Outbound campus communications (overdue fines, hold notices, password resets) previously risked executing synchronously or without connection timeouts, or relying on unauthenticated default ports.
   - Direct port 25 is blocked by major cloud providers (GCP, AWS) and is insecure.
   - Transient network issues or SMTP rate limits could stall HTTP request cycles or lose critical patron notifications.
3. **SMS Regulatory Compliance (Step 36)**:
   - In India, SMS delivery to mobile subscribers is strictly regulated by TRAI (Telecom Regulatory Authority of India) under Distributed Ledger Technology (DLT) regulations.
   - Any transactional SMS sent to Indian numbers must carry registered Principal Entity ID (PEID), Sender Header (6-alpha Sender ID), and registered Content Template ID matching pre-approved telemarketer templates. Unregistered or mismatched SMS are dropped by telecom operators.
   - Detailed per-row audit logging of SMS delivery status and masked recipient identities is required for institutional compliance.

## Decisions

### 1. OAuth Callback Unification and Cryptographic State (Step 34)
- **Apex/Canonical Domain Callback**: Google and GitHub OAuth callbacks terminate on unified canonical endpoints (`/api/v1/auth/google/callback` and `/api/v1/auth/github/callback`).
- **HMAC-Signed State Serialization**:
  - The `state` parameter packs `{ collegeId, collegeSlug, returnUrl, provider, nonce, timestamp }`.
  - Serialized as base64url JSON and signed using HMAC-SHA256 (`payload.signature`).
  - Strict 10-minute TTL with in-memory single-use nonce tracking prevents replay attacks and CSRF.
  - Constant-time verification (`crypto.timingSafeEqual`) ensures integrity before any session token is issued.
- **Open Redirect Protection**:
  - Post-auth `returnUrl` is validated by `isSafeReturnUrl()`.
  - Only safe relative paths starting with a single `/` (and no `:` or `//`) or absolute URLs belonging to verified institutional domains (e.g. `localhost`, `*.bookbuddy.app`, or configured `CLIENT_ORIGIN`) are permitted.
  - Foreign domains or protocol-relative redirects (`//evil.com`) are rejected and safely fall back to the institutional dashboard or default client origin.
- **Tenant Context Preservation**:
  - When the user lands back on BookBuddy, `resolveCollegeFromState(req)` extracts verified `collegeId` / `collegeSlug` from the state payload, binding new OAuth accounts directly to their proper tenant.

### 2. Transactional Email Delivery with Exponential Backoff (Step 35)
- **Port 587/465 Enforced**: Port 25 is explicitly prohibited and rejected at transporter initialization. Modern authenticated SMTP ports (587 STARTTLS, 465 TLS) are enforced.
- **Timeout Hardening**: Transporters are configured with 10s connection timeout, 10s greeting timeout, and 15s socket timeout (`SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_GREETING_TIMEOUT_MS`, `SMTP_SOCKET_TIMEOUT_MS`).
- **Asynchronous Queue & Retries**:
  - Outbound email dispatch is decoupled from HTTP handlers via `queueEmail()` and executes in `setImmediate()`.
  - Database transactional writes trigger emails strictly inside `afterCommitFn` via `runInTransaction(transactionFn, afterCommitFn)` so aborted transactions never send emails.
  - Transient SMTP/network errors (codes 421, 450, 451, 452, `ETIMEDOUT`, `ECONNRESET`) trigger exponential backoff retry with jitter across up to 3 attempts (1s, 2s, 4s). Permanent errors (5xx) fail fast and log structured telemetry without throwing unhandled exceptions.

### 3. Indian DLT SMS Compliance and Per-Row Audit (Step 36)
- **DLT Registry & Parameter Passing**:
  - Implemented `DLT_TEMPLATES` registry mapping message types to regulatory template IDs (`CREDENTIALS_ONBOARDING`, `OVERDUE_ALERT`, `RESERVATION_READY`, `OTP_VERIFICATION`).
  - Standard DLT entity ID (`DLT_ENTITY_ID` / PEID) and sender header (`DLT_DEFAULT_SENDER_HEADER`) are attached to outbound dispatches.
- **Pluggable SMS Provider**:
  - Defaults to Twilio (`SMS_PROVIDER=twilio`) for backward compatibility, with extensible support for Indian SMS gateways (`msg91`, `gupshup`, `mock`).
- **Per-Row Delivery Logging (`SMSDeliveryLog`)**:
  - Every SMS attempt records a persistent document with `collegeId`, `recipientPhoneMasked` (`+91******1234` or `+15***4567`), `templateId`, `entityId`, `header`, `provider`, `providerMessageId`, `status` (`sent` | `failed`), and `dispatchedAt`.
  - Student and patron phone numbers are strictly masked before persisting to database or writing to stdout/logger.

## Consequences
- **Positive**:
  - Multi-tenant OAuth flows are tamper-proof and preserve institutional college scoping across Google and GitHub logins.
  - Open redirect vulnerabilities via OAuth callback are eliminated.
  - Email deliverability is resilient to transient mail relay blips and does not block database transactions or HTTP responses.
  - SMS delivery complies fully with Indian telecom regulations (TRAI DLT) and maintains verifiable per-row delivery audit trails.
- **Negative / Operational Considerations**:
  - Production deployments sending SMS in India must maintain active DLT registration on telecom portals (Jio, Airtel, or Vodafone Idea) and keep `DLT_ENTITY_ID` and template IDs synchronized.
  - In-memory OAuth nonce tracking operates per-instance; on multi-process PM2 clusters, short TTL (10m) ensures replay protection without cross-process locking overhead.
