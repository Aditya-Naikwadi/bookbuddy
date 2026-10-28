# BookBuddy GCP Compute Engine VM Production Deployment Runbook

This runbook guides the complete, zero-defect deployment of BookBuddy onto a **Google Cloud Platform (GCP) Compute Engine VM** behind Nginx, with MongoDB Atlas M0 and local Redis.

---

## Architecture Overview

```
                                      Internet
                                         │
                   ┌─────────────────────▼─────────────────────┐
                   │        DNS / Edge (Cloudflare / GCP)       │
                   │        *.<domain> & <domain>               │
                   └─────────────────────┬─────────────────────┘
                                         │ HTTPS (Port 443)
                                         ▼
            ┌────────────────────────────────────────────────────────┐
            │       GCP Compute Engine VM (e2-micro / e2-small)       │
            │                                                        │
            │  ┌──────────────────────────────────────────────────┐  │
            │  │           Nginx Reverse Proxy & SSL              │  │
            │  │  - SPA Static Files: /var/www/.../frontend/dist  │  │
            │  │  - Reverse Proxy: /api/ -> 127.0.0.1:5000       │  │
            │  │  - WebSocket: /socket.io/ -> 127.0.0.1:5000      │  │
            │  └──────────┬───────────────────────────┬───────────┘  │
            │             │                           │              │
            │             ▼                           ▼              │
            │    ┌──────────────────┐        ┌──────────────────┐    │
            │    │ Node.js 22 (PM2) │        │   Local Redis    │    │
            │    │  Express + Cron  │◄───────┤ (127.0.0.1:6379) │    │
            │    └────────┬─────────┘        └──────────────────┘    │
            └─────────────┼──────────────────────────────────────────┘
                          │ TLS (mongodb+srv://)
                          ▼
            ┌───────────────────────────┐
            │   MongoDB Atlas M0 (GCP)  │
            │    Dedicated DB User      │
            └───────────────────────────┘
```

---

## Phase 1: Project, CLI & Budget Alert Setup

> [!IMPORTANT]
> **Safety Rule**: Create the budget alert **before** provisioning any billable resource to guarantee zero surprise billing.

### 1.1 Authenticate and Set Up GCP Project

#### PowerShell (Windows):
```powershell
# 1. Login to Google Cloud
gcloud auth login

# 2. Set or create your project
$PROJECT_ID = "bookbuddy-prod"
gcloud projects create $PROJECT_ID --name="BookBuddy Production"
gcloud config set project $PROJECT_ID

# 3. Link your billing account
$BILLING_ACCOUNT_ID = (gcloud billing accounts list --format="value(name)" | Select-Object -First 1)
gcloud billing projects link $PROJECT_ID --billing-account=$BILLING_ACCOUNT_ID

# 4. Enable required APIs
gcloud services enable compute.googleapis.com secretmanager.googleapis.com monitoring.googleapis.com logging.googleapis.com
```

#### Cloud Shell (Bash):
```bash
# 1. Login and set project
PROJECT_ID="bookbuddy-prod"
gcloud projects create "$PROJECT_ID" --name="BookBuddy Production"
gcloud config set project "$PROJECT_ID"

# 2. Link billing account
BILLING_ACCOUNT_ID=$(gcloud billing accounts list --format="value(name)" | head -n 1)
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID"

# 3. Enable required APIs
gcloud services enable compute.googleapis.com secretmanager.googleapis.com monitoring.googleapis.com logging.googleapis.com
```

### 1.2 Create Budget Alert ($10 / Month Safety Cap)

#### PowerShell (Windows):
```powershell
gcloud billing budgets create `
  --billing-account=$BILLING_ACCOUNT_ID `
  --display-name="BookBuddy-Monthly-Safety-Cap" `
  --budget-amount=10.00USD `
  --threshold-rule=percent=0.5,basis=current-spend `
  --threshold-rule=percent=0.9,basis=current-spend `
  --threshold-rule=percent=1.0,basis=current-spend
```

#### Cloud Shell (Bash):
```bash
gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT_ID" \
  --display-name="BookBuddy-Monthly-Safety-Cap" \
  --budget-amount=10.00USD \
  --threshold-rule=percent=0.5,basis=current-spend \
  --threshold-rule=percent=0.9,basis=current-spend \
  --threshold-rule=percent=1.0,basis=current-spend
```

---

## Phase 2: Compute Engine VM Provisioning

* **Machine Type**: `e2-micro` (2 vCPU, 1 GB RAM, free under GCP Always Free Tier in `us-central1`, `us-west1`, `us-east1`) or `e2-small` (2 vCPU, 2 GB RAM, ~$14/mo in `us-central1` or ~$16.50/mo in `asia-south1`).
* **Disk**: 30 GB Standard Persistent Disk (Free tier eligible).
* **OS**: Ubuntu 24.04 LTS (`ubuntu-os-cloud/ubuntu-2404-lts-amd64`).

### 2.1 Create Firewall Rules (HTTP, HTTPS, SSH)

#### PowerShell (Windows):
```powershell
# Allow incoming HTTP & HTTPS
gcloud compute firewall-rules create allow-http-https `
  --direction=INGRESS `
  --priority=1000 `
  --network=default `
  --action=ALLOW `
  --rules=tcp:80,tcp:443 `
  --source-ranges=0.0.0.0/0 `
  --target-tags=http-server,https-server
```

#### Cloud Shell (Bash):
```bash
gcloud compute firewall-rules create allow-http-https \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:80,tcp:443 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=http-server,https-server
```

### 2.2 Reserve Static External IP & Launch VM

#### PowerShell (Windows):
```powershell
# 1. Reserve Static IP ($0/mo while attached to a running VM)
gcloud compute addresses create bookbuddy-ip --region=us-central1

$STATIC_IP = (gcloud compute addresses describe bookbuddy-ip --region=us-central1 --format="value(address)")
Write-Host "Reserved Static IP: $STATIC_IP"

# 2. Launch VM Instance
gcloud compute instances create bookbuddy-vm `
  --zone=us-central1-a `
  --machine-type=e2-micro `
  --image-family=ubuntu-2404-lts-amd64 `
  --image-project=ubuntu-os-cloud `
  --boot-disk-size=30GB `
  --boot-disk-type=pd-standard `
  --address=$STATIC_IP `
  --tags=http-server,https-server `
  --metadata=enable-oslogin=TRUE
```

#### Cloud Shell (Bash):
```bash
# 1. Reserve Static IP
gcloud compute addresses create bookbuddy-ip --region=us-central1
STATIC_IP=$(gcloud compute addresses describe bookbuddy-ip --region=us-central1 --format="value(address)")
echo "Reserved Static IP: $STATIC_IP"

# 2. Launch VM Instance
gcloud compute instances create bookbuddy-vm \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --address="$STATIC_IP" \
  --tags=http-server,https-server \
  --metadata=enable-oslogin=TRUE
```

---

## Phase 3: Database & Secret Setup (MongoDB Atlas)

1. **Provision MongoDB Atlas M0 Cluster** in GCP `us-central1` (free, 512 MB storage).
2. **Create Scoped Database User**:
   * Username: `bookbuddy_app`
   * Role: `readWrite` strictly on the `bookbuddy` database only (Do not grant `clusterAdmin` or `readWriteAnyDatabase`).
3. **Whitelist VM IP**:
   * Add the reserved `$STATIC_IP` (or `0.0.0.0/0` with compensating password controls) to the Atlas Network Access list.
4. **Connection Pool Sizing**:
   * Atlas M0 limit: 500 connections.
   * With 1 PM2 master or 2 cluster workers, set `MONGO_MAX_POOL_SIZE=30` per instance. 2 × 30 = 60 connections (12% of cap, well under the 60% ceiling).

---

## Phase 4: VM Bootstrap & Application Deployment

### 4.1 SSH into VM & Run Setup Script

```bash
# Connect to the VM
gcloud compute ssh bookbuddy-vm --zone=us-central1-a
```

Once logged into the VM:
```bash
# 1. Clone repository
sudo git clone https://github.com/Aditya-Naikwadi/bookbuddy.git /var/www/bookbuddy
sudo chown -R $USER:$USER /var/www/bookbuddy
cd /var/www/bookbuddy

# 2. Run automated VM bootstrap script
chmod +x deployment/setup-vm.sh
./deployment/setup-vm.sh
```

### 4.2 Configure Production Environment (`backend/.env`)

Generate strong secrets (>= 32 chars) without trailing newlines:
```bash
cat << 'EOF' > /var/www/bookbuddy/backend/.env
NODE_ENV=production
PORT=5000
HOST=127.0.0.1
MONGO_URI=mongodb+srv://bookbuddy_app:<URL_ENCODED_PASSWORD>@cluster0.xxxx.mongodb.net/bookbuddy?retryWrites=true&w=majority
MONGO_MAX_POOL_SIZE=30

# Authentication Secrets (Must be at least 32 characters in production)
JWT_SECRET=<STRONG_32_CHAR_RANDOM_SECRET>
JWT_REFRESH_SECRET=<STRONG_32_CHAR_RANDOM_REFRESH_SECRET>
COOKIE_SECRET=<STRONG_32_CHAR_RANDOM_COOKIE_SECRET>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Local Redis on VM
REDIS_URL=redis://127.0.0.1:6379
SOCKET_IO_REDIS_ADAPTER_ENABLED=true

# Security & CORS
CLIENT_ORIGIN=https://bookbuddy.app
SCANNER_API_KEY=<STRONG_16_CHAR_SCANNER_KEY>

# Integration Keys
GOOGLE_BOOKS_API_KEY=<YOUR_GOOGLE_BOOKS_KEY>
EOF
chmod 600 /var/www/bookbuddy/backend/.env
```

### 4.3 Run Database Migrations & Seedings

```bash
cd /var/www/bookbuddy/backend
# Install production backend dependencies
npm ci --legacy-peer-deps

# Run schema migrations
npm run migrate:db
npm run migrate:hardening

# Seed Super Admin account (Prompted password from secret)
SEED_SUPER_ADMIN_PASSWORD="<STRONG_PASSWORD>" npm run seed:superadmin
```

### 4.4 Build Frontend Client

```bash
cd /var/www/bookbuddy/frontend
# Configure relative API path so all tenant subdomains remain same-origin
echo "VITE_API_BASE_URL=/api/v1" > .env.production

# Install and build production Vite bundle
npm ci --legacy-peer-deps
npm run build
```

### 4.5 Start Backend Services with PM2

```bash
cd /var/www/bookbuddy
# Start cluster using corrected ecosystem config
pm2 start deployment/ecosystem.config.js --env production

# Persist PM2 across VM reboots
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER
```

---

## Phase 5: Domain, SSL & Post-Deployment Verification

### 5.1 Configure Wildcard DNS

Point your domain to the VM's static IP:
* `A` record: `@` -> `$STATIC_IP`
* `A` record: `*` (Wildcard) -> `$STATIC_IP`

### 5.2 Provision Wildcard SSL with Let's Encrypt / Certbot

```bash
# Option A: Standard domain
sudo certbot --nginx -d bookbuddy.app -d www.bookbuddy.app

# Option B: Wildcard domain via DNS plugin (Cloudflare / Namecheap / Google Cloud DNS)
sudo certbot certonly --manual --preferred-challenges=dns -d "bookbuddy.app" -d "*.bookbuddy.app"
```

Update `/etc/nginx/sites-available/bookbuddy.conf` with certificate paths and reload:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 5.3 Automated Smoke Verification

Run the verification test suite against the live deployment:
```bash
cd /var/www/bookbuddy
node scripts/deployment/verify-deployment.js --url=https://bookbuddy.app
```

Expected output:
```
[PASS] GET / (Landing Page UI) -> 200 OK
[PASS] GET /version.json -> 200 OK
[PASS] GET /health -> 200 OK (MongoDB connected, Redis connected)
[PASS] GET /api/v1/books/public -> 200 OK
[PASS] GET /api/v1/auth/me (Unauthorized boundary) -> 401 Unauthorized
[PASS] WebSocket handshake & Socket.io ping -> UPGRADED
```

---

## Phase 6: Cutover, Fallback & Rollback Runbook

### 6.1 Cutover Sequence (Safe Zero-Downtime Transition)
1. **Database Sync Check**: Verify migrations and seedings exist on MongoDB Atlas M0.
2. **Cron Handoff**: Disable cron on the legacy Render server (`TIMEZONE_AWARE_CRON_ENABLED=false` or turn off Render instance) before enabling cron on the GCP VM to prevent duplicate processing.
3. **DNS Cutover**: Update DNS records from Vercel/Render CNAMEs to the GCP Static IP (`$STATIC_IP`). TTL recommended at 300 seconds during cutover.
4. **Monitor Billing & Performance**: Observe VM memory, CPU, and Atlas connections over the first 48 hours.

### 6.2 Emergency Rollback Procedure
If a critical defect is identified on the GCP VM:
1. **Revert DNS**: Point the `@` and `*` DNS records back to Vercel (`cname.vercel-dns.com`) and Render.
2. **Re-enable Legacy Cron**: Restart the Render service.
3. **Stop VM Service**:
   ```bash
   pm2 stop bookbuddy-server
   ```

---

## Phase 7: Ops Handoff Checklist

| Task | Owner Action Required | Completed? |
| :--- | :--- | :---: |
| **Billing Link** | Link active credit card / billing account to GCP project | [ ] |
| **Budget Alert** | Confirm $10 budget threshold alert email recipient | [ ] |
| **Atlas Database** | Create MongoDB Atlas M0 cluster in GCP `us-central1` | [ ] |
| **Atlas DB User** | Create `bookbuddy_app` user with password and `readWrite` on `bookbuddy` | [ ] |
| **Google Books Key** | Obtain API key from Google Cloud Console → APIs & Services | [ ] |
| **DNS Records** | Add `A` records for `@` and `*` pointing to the VM Static IP | [ ] |
| **OAuth Callback** | Update Google/GitHub OAuth Authorized Redirect URIs with new domain | [ ] |
| **Razorpay Webhook**| Update Razorpay dashboard webhook URL to `https://bookbuddy.app/api/v1/payments/webhook` | [ ] |
