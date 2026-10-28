# ADR 0008: Super Admin Portal Access & Perimeter Isolation

- **Status**: Proposed (Needs Owner Decision)
- **Date**: 2026-10-22
- **Deciders**: Platform Owner, @security-appsec-engineer
- **Consulted**: @product-manager, @engineering-backend-architect, @engineering-devops-automator

---

## Context and Problem Statement

The BookBuddy Super Admin Command Center governs sensitive multi-tenant operations:
- Global college provisioning, suspension, and domain approval.
- Global student and staff account deactivation and role modification.
- Global content moderation and e-resource publishing.
- Financial audit logs and Razorpay fee reconciliation.
- System maintenance mode toggle and global telemetry.

Current protections in the application:
1. **Subdomain Block**: [`adminPortalRoutes.js:59-75`](file:///c:/Users/naikw/OneDrive/Desktop/Earth/project/BookBuddy/backend/src/routes/dashboards/adminPortalRoutes.js#L59-L75) blocks requests bearing tenant subdomain headers or hostname subdomains.
2. **Role & Permission Check**: Requires JWT Bearer token with `role === 'super-admin'`.
3. **MFA**: Enforces TOTP MFA for super-admins with `isMfaEnabled`.
4. **Current Route Exposure**: The admin portal API is mounted directly at `/api/v1/admin-portal/*` on the apex application origin.

Because the admin API shares the apex public origin, it is exposed to automated credential stuffing, vulnerability scanning, and DDoS attacks targeting platform administrators.

---

## Decision Drivers

1. **Perimeter Defense**: Block untrusted internet traffic from reaching administrative endpoints before requests reach the Node.js application server.
2. **Break-Glass Accessibility**: Prevent administrator lockout during network shifts, travel, or external provider outages.
3. **Tenant & Webhook Safety**: Public webhooks (e.g. Razorpay `/api/v1/payments/razorpay-webhook`) and student discovery traffic must never be intercepted or disrupted by administrative access gates.
4. **Impersonation Support**: Super-admin impersonation flows (generating temporary tokens to inspect student/librarian desks) must remain functional without broken session cookies.
5. **Operational Burden & Cost**: Minimize friction and utilize free/low-cost enterprise-grade edge tools.

---

## Considered Options

### Option A: Public Origin with MFA & Rate Limiting Only (Status Quo)
- Admin portal accessible at `https://bookbuddy.app/admin` with API at `https://bookbuddy.app/api/v1/admin-portal/*`.
- **Pros**: Zero infrastructure configuration.
- **Cons**: High exposure to credential stuffing and brute-force scans; leaves the application layer as the sole perimeter.

### Option B: Cloudflare Access / Zero Trust on `/admin-portal` Path
- Protect the administrative route prefix via Cloudflare Access (Identity-Aware Proxy) requiring one-time pin (OTP) or Google Workspace SSO before passing requests to Nginx.
- Free for up to 50 seats on Cloudflare Zero Trust.
- **Pros**: Prevents unauthenticated traffic from touching Nginx or Node.js.
- **Cons**: Path-based edge rules can be tricky with single-page application client-side routing and relative static asset bundles.

### Option C: Strict IP Allowlist on Nginx
- Restrict `/api/v1/admin-portal/*` in Nginx to designated administrator static IP addresses.
- **Pros**: Complete perimeter block against outside traffic.
- **Cons**: Extremely brittle for administrators on dynamic ISP addresses, campus Wi-Fi, or mobile hotspots; high risk of lockout during urgent incident response.

### Option D: Dedicated Admin Hostname (`admin.bookbuddy.app`) behind Cloudflare Access [RECOMMENDED]
- Route administrative traffic through a distinct subdomain: `https://admin.bookbuddy.app`.
- Apply Cloudflare Access (Zero Trust) to `admin.bookbuddy.app`, requiring email OTP or owner Google account authentication at the Cloudflare edge.
- Nginx on the VM routes `admin.bookbuddy.app` directly to the administrative frontend view and API, while blocking all `/api/v1/admin-portal/*` requests arriving on the main apex domain (`bookbuddy.app`) or college subdomains (`*.bookbuddy.app`).
- **Pros**:
  - **Clean Perimeter Separation**: Public and campus traffic hits `bookbuddy.app`; administrative traffic hits `admin.bookbuddy.app`.
  - **Zero Webhook or Student Interruption**: Public webhooks, API monitors, and campus users never touch Cloudflare Access.
  - **Zero Password Brute Force**: An attacker cannot send password attempts to Node.js without first authenticating through Cloudflare Zero Trust.
  - **Break-Glass Capable**: Cloudflare dashboard allows emergency bypass or temporary IP rules if SSO identity provider fails.
- **Cons**:
  - Requires one additional DNS CNAME record (`admin.bookbuddy.app`) and a Cloudflare Zero Trust application setup (free tier).

---

## Recommendation & Next Steps

We recommend **Option D (Dedicated Admin Hostname behind Cloudflare Access)**:
1. Point `admin.bookbuddy.app` through Cloudflare.
2. Enforce Cloudflare Access with owner email OTP at the edge.
3. Enforce Nginx-level block on `/api/v1/admin-portal` from non-admin hostnames.
4. Keep application-level TOTP MFA and `role === 'super-admin'` checks active as defense-in-depth.

**Owner Action Required**: Confirm preferred option (Option D recommended, or Option A/B).
