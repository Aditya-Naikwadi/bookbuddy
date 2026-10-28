# ADR 0013: Cloudflare Edge Firewall, Zero-Downtime Secret Rotation, and Slowloris Hardening

## Status
Accepted

## Context
Running BookBuddy on a single GCP VM exposed to the public internet requires robust perimeter defense, resilient connection lifecycle management, and secrets operational hygiene:
1. **Edge Firewall & Origin Isolation (Step 37)**:
   - Attackers finding the VM's public IP address could attempt to bypass Cloudflare's WAF, DDoS mitigation, and rate limiting rules by sending direct HTTP requests straight to the origin server.
   - An origin pull validation mechanism is required so that only traffic originating from verified Cloudflare edge nodes (or carrying an authentic origin pull secret) can reach application routes.
2. **Secrets Rotation Readiness (Step 38)**:
   - Security compliance requires periodic rotation of cryptographic keys (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `STORAGE_SIGNING_SECRET`, `OAUTH_STATE_SECRET`).
   - Abrupt secret changes invalidate all in-flight patron JWT access tokens and presigned storage links, causing sudden user logouts and 401/403 errors across campus.
   - A dual-secret verification mechanism is necessary so that during key rollout, existing tokens signed with previous keys remain valid through a grace period while newly issued tokens use the fresh secret.
3. **Request Body Limits & Slowloris Mitigation (Step 39)**:
   - Slowloris attacks exploit HTTP servers by opening connections and slowly trickling headers or data, starving Node's event loop and exhausting socket file descriptors.
   - Reverse proxies like Cloudflare have an idle keep-alive timeout of 60 seconds; if the origin server terminates idle connections prematurely, 502 Bad Gateway errors occur on re-used sockets.
4. **CORS & CSRF Multi-Tenant Hardening (Step 40)**:
   - Patron requests originate across multiple tenant subdomains (`https://*.bookbuddy.app`), local development hosts, and institutional portals.
   - CSRF defenses must strictly enforce origin/referer checks on mutating requests while permitting stateless Bearer token API requests.

## Decisions

### 1. Cloudflare Edge Firewall & Origin Isolation (Step 37)
- **Origin Enforcement Middleware (`cloudflareOriginEnforcer.js`)**:
  - Activated via `CLOUDFLARE_ENFORCE=true` or when `CLOUDFLARE_ORIGIN_SECRET` is configured.
  - Verifies that direct connections come from validated Cloudflare published CIDRs (IPv4 and IPv6) or trusted local reverse proxies (Nginx loopback `127.0.0.1`), and checks `CF-Connecting-IP`.
  - When `CLOUDFLARE_ORIGIN_SECRET` is defined, incoming requests must present an identical `X-Origin-Secret` header, verified in constant time (`crypto.timingSafeEqual`).
  - Unauthorized direct requests are immediately rejected with HTTP 403 (`Direct origin access prohibited`).
  - Internal loopback requests and health monitoring endpoints carrying `x-health-token` are exempted to preserve local process telemetry.

### 2. Zero-Downtime Secret Rotation Architecture (Step 38)
- **Dual-Secret Resolution (`getSecretCandidates`)**:
  - Verification functions for JWT access tokens, refresh tokens, presigned storage URLs, and OAuth state inspect both the primary key and fallback/previous keys (`JWT_SECRET_PREVIOUS`, `STORAGE_SIGNING_SECRET_PREVIOUS`, or comma-separated lists).
  - **Signing Path**: Generates new tokens exclusively using the active primary key.
  - **Verification Path**: Attempts verification with the active key first; on signature mismatch, evaluates candidates against fallback keys.
  - Expired tokens fail immediately without retrying alternate keys, preventing cryptographic timing leakage.

### 3. HTTP Server Socket Timeouts & Slowloris Mitigation (Step 39)
- Configured Node.js HTTP server timeouts in `server.js`:
  - `server.keepAliveTimeout = 65000` (65s): strictly greater than Cloudflare's 60s idle timeout to prevent 502 race conditions on re-used persistent connections.
  - `server.headersTimeout = 66000` (66s): greater than `keepAliveTimeout` per Node.js HTTP specifications.
  - `server.requestTimeout = 30000` (30s): limits request header/body transfer duration to mitigate Slowloris resource exhaustion.
- Enforced route-specific body parser limits:
  - Default JSON & URL-encoded bodies: capped at 1MB.
  - Roster CSV uploads: capped at 20MB.
  - Direct file stream uploads: streamed directly to disk, capped at 50MB.

### 4. CORS & CSRF Hardening (Step 40)
- Enforced `isAllowedOrigin` regex in `csrf.js` covering `bookbuddy.app` and `bookbuddy.com` subdomains alongside localhost.
- Stateless API client exemption: requests with explicit `Authorization: Bearer <token>` and no session cookies are exempted from ambient-credential CSRF checks.

## Consequences
- **Positive**:
  - Prevents origin IP bypass; traffic cannot evade Cloudflare WAF or rate limiting.
  - Cryptographic keys can be rotated without user disruption or sudden session terminations.
  - Resilient socket timeouts mitigate Slowloris Denial-of-Service and prevent 502 Bad Gateway errors behind Cloudflare.
- **Negative / Operational Considerations**:
  - When rotating secrets, ops must deploy the new secret alongside the old secret as `JWT_SECRET_PREVIOUS` for at least 15 minutes before retiring the old secret completely.
