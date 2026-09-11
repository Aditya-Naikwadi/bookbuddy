# Subdomain Wildcard DNS & SSL Certificate Setup Guide

This document outlines the complete operational specification and deployment runbook for BookBuddy's multi-tenant wildcard subdomain routing (`<slug>.bookbuddy.com`) and automated SSL certificate management.

---

## 1. Architecture Overview

Every onboarded institution receives a dedicated slug (e.g., `mit-tech`, `stanford-univ`) providing a pre-scoped tenant portal:

```text
       *.bookbuddy.com / bookbuddy.com
                      │
            [ DNS Provider: Cloudflare / Route53 ]
            *.bookbuddy.com CNAME -> bookbuddy.com
            bookbuddy.com   A     -> <Load Balancer IP>
                      │
                      ▼
          [ Edge Nginx Reverse Proxy (Port 443 SSL) ]
          - Wildcard TLS cert: *.bookbuddy.com & bookbuddy.com
          - Captures (?<subdomain>[a-z0-9-]+) from Host header
          - Sets X-Tenant-Subdomain header
                      │
                      ▼
          [ Backend Express Application (Port 5000) ]
          - subdomainTenantResolver middleware
          - Scopes DB operations & prevents cross-tenant leaks
```

---

## 2. DNS Configuration

Add the following DNS records in your domain registrar / DNS provider (e.g. Cloudflare, AWS Route 53, Namecheap, Google Domains):

| Type | Name | Content / Target | TTL | Proxy Status |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `@` (or `bookbuddy.com`) | `203.0.113.10` (Load Balancer / Server IP) | 300 / Auto | DNS Only / Proxied |
| **CNAME** | `*` (or `*.bookbuddy.com`) | `bookbuddy.com` | 300 / Auto | DNS Only / Proxied |
| **CNAME** | `www` | `bookbuddy.com` | 300 / Auto | DNS Only / Proxied |

> [!IMPORTANT]
> If using Cloudflare proxy (orange cloud), ensure Cloudflare SSL/TLS mode is set to **Full (strict)**. If using origin SSL termination on your own Nginx server, Cloudflare requires an Enterprise plan for sub-subdomains, but a standard Pro/Free plan supports first-level wildcards (`*.bookbuddy.com`).

---

## 3. Automated Let's Encrypt Wildcard SSL Setup (Certbot)

Let's Encrypt requires the **DNS-01 ACME challenge** to issue wildcard certificates (`*.bookbuddy.com`). HTTP-01 challenges are rejected for wildcards.

### Option A: Cloudflare DNS-01 Plugin (Recommended)

1. **Install Certbot & Plugin**:
   ```bash
   sudo apt-get update
   sudo apt-get install -y certbot python3-certbot-dns-cloudflare
   ```

2. **Configure Cloudflare API Token**:
   Create a restricted API token in Cloudflare Dashboard with `Zone:DNS:Edit` permissions for `bookbuddy.com`.
   Save it to `/etc/letsencrypt/cloudflare.ini`:
   ```ini
   # /etc/letsencrypt/cloudflare.ini
   dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN_HERE
   ```
   Secure file permissions:
   ```bash
   sudo chmod 600 /etc/letsencrypt/cloudflare.ini
   ```

3. **Issue Certificate**:
   ```bash
   sudo certbot certonly \
     --dns-cloudflare \
     --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
     --dns-cloudflare-propagation-seconds 30 \
     -d bookbuddy.com \
     -d "*.bookbuddy.com" \
     --agree-tos \
     --no-eff-email \
     -m security@bookbuddy.com
   ```

4. **Verify Certificate Paths**:
   - Certificate: `/etc/letsencrypt/live/bookbuddy.com/fullchain.pem`
   - Private Key: `/etc/letsencrypt/live/bookbuddy.com/privkey.pem`
   - Intermediate: `/etc/letsencrypt/live/bookbuddy.com/chain.pem`

5. **Automate Zero-Downtime Renewal**:
   Add a post-renewal reload hook in `/etc/letsencrypt/renewal-hooks/post/reload-nginx.sh`:
   ```bash
   #!/usr/bin/env bash
   systemctl reload nginx
   ```
   Make executable:
   ```bash
   sudo chmod +x /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh
   ```
   Certbot's default systemd timer (`certbot.timer`) will automatically renew the certificate 30 days before expiration. Test renewal dry-run:
   ```bash
   sudo certbot renew --dry-run
   ```

---

## 4. Deploying Nginx Configuration

1. Copy the wildcard configuration:
   ```bash
   sudo cp deployment/nginx-wildcard-ssl.conf /etc/nginx/sites-available/bookbuddy.conf
   sudo ln -s /etc/nginx/sites-available/bookbuddy.conf /etc/nginx/sites-enabled/
   ```

2. Test Nginx configuration syntax:
   ```bash
   sudo nginx -t
   ```

3. Reload Nginx without dropping active client connections:
   ```bash
   sudo systemctl reload nginx
   ```

---

## 5. Alternative: Vercel / Cloudflare Edge Deployment

If deploying the frontend on Vercel and backend on Render/AWS:

1. **Vercel Wildcard Domain**:
   - In Vercel Project Settings → **Domains**:
   - Add `bookbuddy.com`
   - Add `*.bookbuddy.com`
   - Vercel automatically creates and manages wildcard SSL certificates through Let's Encrypt / DigiCert.

2. **API Proxy Route (`vercel.json`)**:
   Ensure `vercel.json` rewrites `/api/:path*` to the backend cluster while forwarding the original `Host` and `x-tenant-subdomain` headers.

---

## 6. Local & Staging Simulation

For local testing on development workstations:

1. **Local `/etc/hosts` or `C:\Windows\System32\drivers\etc\hosts`**:
   ```text
   127.0.0.1   localhost
   127.0.0.1   mit-tech.localhost
   127.0.0.1   stanford-univ.localhost
   127.0.0.1   oxford-lib.localhost
   ```

2. **Native Localhost Wildcard**:
   Modern Chromium browsers (Chrome, Edge, Brave) and Node.js v18+ automatically resolve any `*.localhost` domain to `127.0.0.1` without modifying the hosts file.

3. **Backend Middleware Validation**:
   The backend middleware `subdomainTenantResolver.js` automatically recognizes `*.localhost` requests (e.g. `mit-tech.localhost:5000`) and extracts the slug `mit-tech`.

---

## 7. Security Hardening Checklist

- [x] **Strict Transport Security (HSTS)**: Enabled with `max-age=63072000; includeSubDomains; preload`.
- [x] **Rate Limiting**: Configured for `/api/v1/auth/login` (5 req/sec burst 10) and bulk upload (2 req/sec burst 5).
- [x] **Payload Limit**: `client_max_body_size 25M` to comfortably support up to 25,000-row student rosters.
- [x] **Zero Cross-Tenant Leakage**: Subdomain slug strictly validated against `College.slug` and matched with session tokens.
