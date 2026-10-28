# ADR 0005: Target Hosting Architecture (Full-GCP Single-Origin vs Hybrid)

- **Status**: Proposed (Needs Owner Decision)
- **Date**: 2026-10-22
- **Deciders**: Platform Owner, @product-manager, @engineering-backend-architect
- **Consulted**: @security-appsec-engineer, @engineering-devops-automator, @testing-performance-benchmarker

---

## Context and Problem Statement

BookBuddy currently runs in a split hybrid topology:
1. **Frontend Single-Page Application (SPA)**: Deployed on Vercel Global Edge (`https://book-buddy-eight-rosy.vercel.app`).
2. **Backend REST API & WebSockets**: Deployed on Render (`https://bookbuddy-kcwl.onrender.com`).
3. **Database**: MongoDB Atlas M0 cluster.

This deployment model faces major architectural friction:
- **Cross-Site Cookie Restrictions**: Because the frontend and backend live on different apex domains (`vercel.app` vs `onrender.com`), authentication cookies (`refreshToken`, `_csrf`) must be configured with `SameSite=None; Secure=true`. Privacy-preserving browsers (Safari ITP, Brave, Firefox, and Chrome third-party cookie restrictions) frequently block or drop these cookies, breaking silent token rotation.
- **CORS Preflight Overhead**: Every authenticated REST API request triggers an `OPTIONS` preflight round-trip, introducing 150–350 ms of additional latency for Indian campus users.
- **Multi-Tenant Subdomain Routing**: Dynamic tenant routing (`<college-slug>.bookbuddy.app`) is hindered by cross-origin DNS and certificate management across two independent hosting platforms.
- **Render Cold Starts**: Render's free tier spins down idle instances, causing 30–60 second cold start delays.

The objective is to establish the hosting topology for BookBuddy on a single Google Cloud Platform (GCP) Compute Engine virtual machine (`e2-micro` / `e2-small` in `asia-south1` Mumbai) fronted by Cloudflare CDN.

---

## Decision Drivers

1. **User Latency in India**: Target `< 200 ms` Time-to-First-Byte (TTFB) and seamless single-screen interaction for Indian university campuses.
2. **Cookie Security & Reliability**: Eliminate third-party cookie blocking and support strict `SameSite=Lax` cookies.
3. **Multi-Tenant Subdomain Isolation**: Native wildcard DNS and TLS support (`*.bookbuddy.app`) with automatic tenant scoping from the HTTP `Host` header.
4. **Operational Simplicity & Rollback**: Single-step atomic deployment and instant rollback without coordinating disparate platform deployments.
5. **Cost**: Keep infrastructure expenditure within the free/low-tier threshold ($0–$10/month).

---

## Considered Options

### Option 1: Full-GCP Single-Origin Deployment (Nginx + Node under PM2 on GCP VM + Cloudflare CDN) [RECOMMENDED]
- Nginx serves the compiled SPA static assets (`dist/`) directly from local disk and proxies API (`/api/v1`) and WebSocket (`/socket.io`) traffic to local Node.js processes managed by PM2 on `127.0.0.1:5000`.
- Cloudflare sits in front of the VM for global SSL termination, edge caching of immutable static assets (`/assets/*.js`, `/assets/*.css`), DDoS protection, and Indian edge nodes (Mumbai, Delhi, Chennai, Bangalore, Kolkata).
- **Pros**:
  - **Single Origin**: All requests are same-origin (`https://bookbuddy.app` and `https://<college>.bookbuddy.app`). Zero CORS preflight `OPTIONS` requests; zero cross-site cookie drops; cookies use `SameSite=Lax`.
  - **Low Latency**: VM stationed in GCP `asia-south1` (Mumbai), offering 15–40 ms RTT to Indian users.
  - **Multi-Tenant**: Nginx easily terminates wildcard hostnames (`*.bookbuddy.app`) and forwards the exact `Host` header directly to Express.
  - **Synchronized Atomic Rollback**: A single symlink switch (`current -> releases/<timestamp>`) atomically reverts both frontend and backend bundles simultaneously.
- **Cons**:
  - Requires maintaining Nginx and PM2 configurations in the repository and deploy scripts.
  - VM bandwidth is capped (free tier egress ~1 GB/month; mitigated by Cloudflare edge caching and direct-to-storage signed URLs).

### Option 2: Hybrid Deployment (Vercel Frontend + GCP VM Backend)
- Frontend remains on Vercel; backend moves from Render to the GCP VM.
- **Pros**:
  - Familiar developer experience for frontend git pushes.
- **Cons**:
  - Persists cross-site cookie requirements (`SameSite=None`), exposing student logins to Safari ITP and browser cookie partition failures.
  - Retains CORS preflight latency on every non-simple API call.
  - Wildcard subdomains on Vercel require Vercel Pro/Enterprise or complex DNS flattening.
  - Deployments and rollbacks remain asynchronous and split across two platforms.

### Option 3: Status Quo (Vercel Frontend + Render Backend)
- **Pros**:
  - Zero migration work.
- **Cons**:
  - Suffers from 30–60s cold starts, cross-site cookie failures, overseas server latency (US/EU regions), and Render free tier resource limits.

---

## Recommendation & Next Steps

We recommend **Option 1 (Full-GCP Single-Origin)**. It permanently resolves cross-site cookie blocking, eliminates CORS preflight latency, supports multi-tenant subdomains natively, and unifies deployment and rollback under PM2 and Nginx.

**Owner Action Required**: Confirm acceptance of Option 1 (Full-GCP Single-Origin) or specify constraints necessitating Option 2.
