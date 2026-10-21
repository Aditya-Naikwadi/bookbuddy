# Production Deployment & Rollback Runbook (GCP + Cloudflare)

This document outlines the standard production release gates, post-deploy verification steps, and automated + manual emergency rollback procedures for the BookBuddy application suite.

---

## 1. Release Architecture & Invariants

| Layer | Production Platform | Failover / Redundancy | Configuration Target |
| :--- | :--- | :--- | :--- |
| **Edge / CDN** | Cloudflare | Full (Strict) SSL, WAF, Edge Caching | Hashed assets: `1 year immutable`<br>`index.html` / `version.json`: `no-store` |
| **Frontend SPA** | GCP VM / Nginx (`dist/`) & Vercel fallback | Multi-origin redundancy | SPA fallback: `try_files $uri $uri/ /index.html;` |
| **Backend API** | GCP Compute Engine / Render (`srv-d9rltltbedkc73c1khkg`) | PM2 cluster / Docker container | Node.js 24 + Express + Redis |
| **Database** | MongoDB Atlas Dedicated Cluster | Replica Set (Primary + 2 Secondaries) | Point-in-time recovery (PITR) enabled |

---

## 2. Automated Post-Deploy Smoke Verification

Every push or merge to `main` triggers `.github/workflows/ci.yml` which deploys and immediately invokes `scripts/deployment/verify-deployment.js`.

The automated smoke suite checks:
1. **Live Landing Page UI**: `GET /` returns `200 OK`.
2. **Client Version Manifest**: `GET /version.json` returns `200 OK` and confirms live Git Commit SHA.
3. **System Health Check**: `GET /health` returns `200 OK` (verifies MongoDB replica set and Redis connections).
4. **Public Books Carousel**: `GET /api/v1/books/public` returns `200 OK` with non-empty, approved catalog items.
5. **Public E-Resources Carousel**: `GET /api/v1/eresources/public` returns `200 OK` with approved digital resources.
6. **Active Colleges Directory**: `GET /api/v1/registration/colleges` returns `200 OK` with active institutions only.
7. **Auth Boundary Security**: `GET /api/v1/auth/me` returns `401 Unauthorized` for unauthenticated requests.

If any endpoint fails or the live commit SHA does not match within 300s, an automated rollback alert is broadcast to Slack and logged to `logs/deployment-audit.jsonl`.

---

## 3. Emergency Rollback Procedures

### Scenario A: Frontend Client Failure / Stale Bundle Lock

If a breaking frontend bundle or stale Service Worker lock is detected in production:

1. **Vercel Instant Rollback**:
   ```bash
   # List recent production deployments
   npx vercel rollback --token=$VERCEL_TOKEN
   ```
   Or visit the Vercel Dashboard → Project Deployments → Select the previous green deployment → Click **"Instant Rollback"**.

2. **GCP VM / Nginx Rollback**:
   ```bash
   ssh deploy@bookbuddy-vm.internal
   cd /var/www/bookbuddy/frontend
   # Symlink to previous release
   ln -sfn /var/www/bookbuddy/releases/previous/dist /var/www/bookbuddy/frontend/dist
   sudo systemctl reload nginx
   ```

3. **Purge Cloudflare Cache (Hard Invalidation)**:
   ```bash
   curl -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
     -H "Authorization: Bearer ${CLOUDFLARE_API_KEY}" \
     -H "Content-Type: application/json" \
     --data '{"files":["https://bookbuddy.com/","https://bookbuddy.com/index.html","https://bookbuddy.com/version.json","https://bookbuddy.com/sw.js"]}'
   ```

---

### Scenario B: Backend API Regression / Container Failure

1. **Render One-Click Rollback**:
   - Access Render Dashboard (`srv-d9rltltbedkc73c1khkg`) → **Events / Deploys**.
   - Locate the previous successful deploy and click **"Rollback to this deploy"**.
   - Alternatively via CLI:
     ```bash
     curl -X POST "https://api.render.com/v1/services/srv-d9rltltbedkc73c1khkg/rollback" \
       -H "Authorization: Bearer $RENDER_API_KEY" \
       -H "Content-Type: application/json" \
       --data "{\"deployId\":\"$PREVIOUS_STABLE_DEPLOY_ID\"}"
     ```

2. **Docker / PM2 Local VM Rollback**:
   ```bash
   ssh deploy@bookbuddy-vm.internal
   # Pull previous stable image
   docker pull ghcr.io/aditya-naikwadi/bookbuddy/bookbuddy-server:stable
   docker-compose -f /opt/bookbuddy/docker-compose.prod.yml up -d --no-deps backend
   ```

---

### Scenario C: Database Migration Rollback

1. Execute the rollback migration script:
   ```bash
   cd backend
   npm run migrate:down
   ```
2. Verify schema integrity and multi-tenant constraints:
   ```bash
   npm run check:tenant-isolation
   npm run check:indexes
   ```

---

## 4. Rollback Verification Checklist

After initiating a rollback, run the manual verification sequence:

- [ ] `curl -I https://bookbuddy.com/version.json` returns previous stable `commitSha`.
- [ ] `curl -I https://bookbuddy.com/health` returns `200 OK` with `"status": "ok"`.
- [ ] `curl -I https://bookbuddy.com/api/v1/books/public` returns `200 OK`.
- [ ] Hard-refresh-free test on mobile/desktop: Open Incognito window, verify landing page renders without JavaScript console errors.
- [ ] Verify Sentry error stream: No new unhandled exceptions registered in last 10 minutes.
