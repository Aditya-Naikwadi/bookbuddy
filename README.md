# 📚 BookBuddy

### Enterprise Multi-Tenant Campus Library, Digital E-Resource Hosting, Facility Reservation & Gamified Student Engagement Platform

BookBuddy is a modern, production-grade full-stack platform that transforms traditional college libraries into integrated digital campus hubs. It combines multi-tenant physical inventory circulation, real-time computer lab workstation reservations, in-browser EPUB & PDF e-book reading with live text annotations, automated external catalog aggregation (Open Library & Google Books), digital fine payments via Razorpay, gamified reading streaks, and an automated continuous deployment & verification engine.

---

[![CI Pipeline](https://github.com/Aditya-Naikwadi/BookBuddy/actions/workflows/ci.yml/badge.svg)](https://github.com/Aditya-Naikwadi/BookBuddy/actions/workflows/ci.yml)
[![Multi-Layer Verification](https://github.com/Aditya-Naikwadi/BookBuddy/actions/workflows/multi-layer-verification.yml/badge.svg)](https://github.com/Aditya-Naikwadi/BookBuddy/actions/workflows/multi-layer-verification.yml)
[![Production Heartbeat](https://github.com/Aditya-Naikwadi/BookBuddy/actions/workflows/production-heartbeat.yml/badge.svg)](https://github.com/Aditya-Naikwadi/BookBuddy/actions/workflows/production-heartbeat.yml)
![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB_Driver-6.x-47A248?logo=mongodb&logoColor=white)
![Mongoose](https://img.shields.io/badge/Mongoose-9.x-880000?logo=mongoose&logoColor=white)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?logo=socketdotio&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-5.x-DC382D?logo=redis&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-4.x-3E67B1?logo=zod&logoColor=white)
![Razorpay](https://img.shields.io/badge/Razorpay-2.x-0C2340?logo=razorpay&logoColor=white)

---

## 🚀 Live Deployments & Case Study

- 🌐 **Production Web Application (Vercel):** [https://book-buddy-eight-rosy.vercel.app](https://book-buddy-eight-rosy.vercel.app)
- ⚙️ **Production REST API & Backend (Render):** [https://bookbuddy-kcwl.onrender.com](https://bookbuddy-kcwl.onrender.com)
- 🏥 **Backend Health Check:** [`https://bookbuddy-kcwl.onrender.com/health`](https://bookbuddy-kcwl.onrender.com/health)
- 📌 **Live Version Metadata:** [`https://bookbuddy-kcwl.onrender.com/version`](https://bookbuddy-kcwl.onrender.com/version)
- 📄 **Full Engineering Case Study:** [`docs/CASE_STUDY.md`](docs/CASE_STUDY.md)

---

## 📋 Table of Contents

- [📄 Comprehensive Engineering Case Study](docs/CASE_STUDY.md)
- [📖 Overview \& Key Differentiators](#-overview--key-differentiators)
- [🏛️ System Architecture](#️-system-architecture)
- [🔒 Multi-Tenancy \& Data Isolation](#-multi-tenancy--data-isolation)
- [🛡️ Security Architecture \& Protection Suite](#️-security-architecture--protection-suite)
- [📖 Multi-Format E-Resource Reader \& Annotation Engine](#-multi-format-e-resource-reader--annotation-engine)
- [🖥️ Computer Lab Workstation Reservation Grid](#️-computer-lab-workstation-reservation-grid)
- [🌐 External Book Catalog Aggregation](#-external-book-catalog-aggregation)
- [💳 Online Fine Payments \& Webhook Subsystem](#-online-fine-payments--webhook-subsystem)
- [🎮 Gamification \& Student Engagement Subsystem](#-gamification--student-engagement-subsystem)
- [🤖 Automated Continuous Verification \& Monitoring Pipeline](#-automated-continuous-verification--monitoring-pipeline)
- [✨ Portal Feature Matrix](#-portal-feature-matrix)
- [🔌 Complete API Reference](#-complete-api-reference)
- [⚙️ Environment Configuration Reference](#️-environment-configuration-reference)
- [🚀 Quick Start \& Installation Guide](#-quick-start--installation-guide)
- [📁 Repository Structure](#-repository-structure)
- [📄 License](#-license)

---

## 📖 Overview & Key Differentiators

BookBuddy replaces fragmented library software with a unified multi-tenant platform:

1. **Multi-Tenant Physical Inventory & Holds**: Multi-branch physical catalog tracking, hold reservation queues with auto-promotion upon check-in, and automated overdue fine accumulation.
2. **Computer Lab Seat Grid Reservations**: Visual seat grid layout, real-time availability polling, and atomic reservation concurrency protection.
3. **Digital E-Resource Repository & Reader**: In-browser EPUB & PDF rendering, HTTP range streaming, position CFI/page synchronization, and persistent text highlights & notes.
4. **External Catalog Aggregation**: Automated search fallback and metadata enrichment via Open Library API, Google Books API, and Project Gutenberg.
5. **Digital Fine Payments**: Online payment collection via Razorpay with HMAC-SHA256 signature verification and idempotent webhook processing.
6. **Gamified Student Engagement**: Daily reading check-in streak tracking, streak freeze buffers, and milestone achievement badges.
7. **Real-Time WebSocket Network**: Socket.io real-time event broadcasting for loan updates, seat status changes, and notification center alerts.
8. **Automated Verification & Post-Push Monitoring**: Self-healing post-push verification pipeline (`verify-deployment.js`) and multi-layer operational health probes (`multi-layer-verifier.js`).

---

## 🏛️ System Architecture

BookBuddy adopts a decoupled, event-driven architecture designed for sub-second client state updates, strict tenant boundary enforcement, and transparent cache fallback degradation.

```mermaid
graph TD
    subgraph Client Layer (Vercel)
        SPA["React 19 SPA (Vite 8 + Tailwind v4)"]
        Zustand["Zustand v5 State Store"]
        Query["TanStack React Query v5 Cache"]
        Reader["Epub.js + PDF.js Engine"]
        Worker["Web Worker CSV Parser"]
    end

    subgraph Network & API Gateway
        VercelCDN["Vercel Global Edge CDN"]
        HTTPS["HTTPS REST API"]
        WS["Socket.io WebSockets"]
    end

    subgraph Application Server (Render)
        Express["Express 5 API Server (Node 20)"]
        AuthGate["JWT Auth & HS256 Validation"]
        TenantScope["Multi-Tenant Isolation Scoper"]
        RateLimiter["Progressive Rate Limiter"]
    end

    subgraph Data & Persistence Layer
        MongoDB[(MongoDB Atlas / Cloud)]
        Redis[(Redis Cache / In-Memory Fallback)]
    end

    subgraph External Gateways
        Razorpay["Razorpay Payments"]
        Cloudinary["Cloudinary CDN"]
        OpenLibrary["Open Library API"]
        GoogleBooks["Google Books API"]
    end

    SPA -->|HTTPS / REST| VercelCDN
    VercelCDN -->|API Rewrite / Proxy| HTTPS
    SPA -->|WebSockets| WS
    HTTPS --> Express
    WS --> Express
    Express --> AuthGate
    AuthGate --> TenantScope
    TenantScope --> RateLimiter
    RateLimiter --> MongoDB
    RateLimiter --> Redis
    Express --> External Gateways
```

---

## 🔒 Multi-Tenancy & Data Isolation

BookBuddy implements strict logical multi-tenancy to ensure complete data isolation across multiple college campuses on a single database deployment.

```mermaid
graph LR
    subgraph Incoming Request
        Req[HTTP Request + Bearer Token]
    end

    subgraph Authentication & Scoping Pipeline
        Protect[JWT Verification Middleware]
        Extract[Extract collegeId from JWT Payload]
        Inject[Inject req.tenantFilter = { collegeId }]
    end

    subgraph Mongoose Query Layer
        Query[Model.find / findOne / countDocuments]
        MergeQuery[Query = { ...req.tenantFilter, ...filter }]
    end

    subgraph Multi-Tenant Database
        DB[(MongoDB Collection)]
        CompoundIndex["Compound Index: { collegeId: 1, _id: 1 }"]
    end

    Req --> Protect
    Protect --> Extract
    Extract --> Inject
    Inject --> Query
    Query --> MergeQuery
    MergeQuery --> CompoundIndex
    CompoundIndex --> DB
```

> [!IMPORTANT]
> All database queries in college-scoped controllers automatically merge `req.tenantFilter` into query objects, ensuring one campus can never view or modify another campus's patrons, books, loans, or lab reservations.

---

## 🛡️ Security Architecture & Protection Suite

BookBuddy includes defense-in-depth security mechanisms:

- **JWT HS256 Token Protection:** Access tokens (15-minute expiry) and refresh tokens (7-day expiry) signed with `HS256`. Refresh tokens are stored in `httpOnly`, `SameSite=Strict`, `Secure` cookies and hashed using SHA-256 before database storage.
- **Session Reuse & Theft Detection:** Immediate revocation of all user sessions if a revoked or reused refresh token is presented.
- **NoSQL Injection Defense:** `express-mongo-sanitize` sanitizes user input containing `$` or `.` operators.
- **Security Headers & CSP:** `helmet` enforces `HSTS`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and Content Security Policy (CSP).
- **Progressive Login Rate Limiting:** `rate-limiter-flexible` limits consecutive failed login attempts by IP and email identifier (5 attempts per 15-minute window with `Retry-After` headers).
- **Stored XSS Sanitization:** `DOMPurify` / HTML sanitization on e-resource annotations, digital book descriptions, and patron feedback inputs.

---

## 📖 Multi-Format E-Resource Reader & Annotation Engine

The embedded e-resource reader allows students to read EPUB and PDF books directly inside the browser without downloading files locally.

- **EPUB Engine (`epubjs`):** In-memory book rendering, table-of-contents navigation, custom font size scaling, theme switching (Light / Dark / Sepia), and canonical CFI (Content Fragment Identifier) bookmark tracking.
- **PDF Engine (`pdfjs-dist`):** Page-by-page PDF rendering, zoom controls, thumbnail sidebar, and page navigation.
- **Persistent Text Annotations:** Highlight text passages and save persistent notes linked to specific CFI coordinates or page numbers.
- **HTTP Range Streaming:** E-resource files are streamed with HTTP 206 Partial Content support for fast initial loading.

---

## 🖥️ Computer Lab Workstation Reservation Grid

BookBuddy provides real-time workstation scheduling for campus computer labs:

- **Visual Seat Grid:** Dynamic grid visualization showing seat statuses (Available, Occupied, Reserved, Maintenance).
- **Concurrency Locks:** Prevents double-booking via atomic database transactions (`findOneAndUpdate` with status condition checks).
- **Operating Hours Enforcement:** Bookings are validated against campus lab operating schedules (e.g., 8:00 AM to 8:00 PM).

---

## 🌐 External Book Catalog Aggregation

When a physical book is not found in the local library inventory, BookBuddy automatically queries external public repositories:

- **Open Library API:** Fetches book metadata, cover images, author details, and ISBN mappings.
- **Google Books API:** Fetches supplementary book descriptions, ratings, and preview links.
- **Project Gutenberg:** Aggregates free public-domain e-books for direct reading in the digital library.

---

## 💳 Online Fine Payments & Webhook Subsystem

Patrons can pay library overdue fines directly through the portal:

1. **Order Creation:** Server generates a Razorpay Order ID for unpaid fine balances.
2. **Checkout Integration:** Patron completes payment using Razorpay's checkout modal (UPI, Cards, NetBanking).
3. **HMAC Signature Verification:** Payment response is verified using server-side HMAC-SHA256 signature checking.
4. **Idempotent Webhooks:** Razorpay webhooks (`payment.captured`) update fine statuses to `paid` idempotently, ensuring duplicate webhook events are handled safely.

---

## 🎮 Gamification & Student Engagement Subsystem

BookBuddy encourages daily reading habits through gamified features:

- **Daily Check-In Streaks:** Students log daily reading check-ins to build consecutive reading streaks.
- **Streak Freeze Buffers:** Protects streaks against missed days using earned or assigned streak freeze buffers.
- **Milestone Achievement Badges:** Automatically awards digital badges (e.g., "7-Day Scholar", "Bookworm", "Century Reader") when milestone thresholds are reached.

---

## 🤖 Automated Continuous Verification & Monitoring Pipeline

BookBuddy features an automated post-push verification pipeline that validates live deployments after every git merge:

```mermaid
sequenceDiagram
    autonumber
    participant Dev as Developer / GitHub Push
    participant GHA as GitHub Actions Runner
    participant Verifier as scripts/verify-deployment.js
    participant Backend as Live Render API (/version, /health)
    participant Slack as Slack Alert Webhook

    Dev->>GHA: Push commit to main branch
    GHA->>GHA: Run Linter, Unit Tests & Vite Build
    GHA->>Verifier: Execute Post-Deploy Verification Script
    loop Poll /version endpoint (max 300s)
        Verifier->>Backend: GET /version
        Backend-->>Verifier: Return Live Commit SHA
    end
    Verifier->>Backend: GET /health (Verify API, DB, Cache status)
    Backend-->>Verifier: Return 200 OK Status Payload
    Verifier->>Backend: GET /api/v1/auth/me (Verify Auth 401 Challenge)
    Backend-->>Verifier: Return 401 Unauthorized
    alt Verification Success
        Verifier-->>GHA: Exit Code 0 (Deployment Verified)
    else Verification Failure / Timeout
        Verifier->>Slack: Send Failure Alert Payload
        Verifier-->>GHA: Exit Code 1 (Trigger Rollback Warning)
    end
```

> [!NOTE]
> Detailed audit logs for every deployment verification run are stored persistently in JSONL format at [`logs/deployment-audit.jsonl`](file:///c:/Users/naikw/OneDrive/Desktop/project/BookBuddy/logs/deployment-audit.jsonl).

---

## ✨ Portal Feature Matrix

| Feature                                | Student Portal 🎓 |  College Admin Portal 🏛️  | Super Admin Portal 🌐 |
| :------------------------------------- | :---------------: | :-----------------------: | :-------------------: |
| **Catalog Search & Filtering**         |        ✅         |            ✅             |          ✅           |
| **Physical Book Reservations & Holds** |        ✅         |     ✅ (Manage Holds)     |          ✅           |
| **In-Browser EPUB & PDF Reader**       |        ✅         |            ✅             |          ✅           |
| **Lab Workstation Booking**            |        ✅         |     ✅ (Seat Config)      |          ✅           |
| **Reading Streaks & Badges**           |        ✅         |            ❌             |          ❌           |
| **Online Fine Payments (Razorpay)**    |        ✅         | ✅ (Manual Fine Override) |          ✅           |
| **Roster CSV Bulk Upload (Worker)**    |        ❌         |            ✅             |          ✅           |
| **Multi-Tenant Feature Gate Toggles**  |        ❌         |            ❌             |          ✅           |
| **Campus Suspension & Archival**       |        ❌         |            ❌             |          ✅           |
| **Super-Admin User Impersonation**     |        ❌         |            ❌             |          ✅           |
| **Global Audit Log Inspection**        |        ❌         |     ✅ (Campus Scope)     |   ✅ (Global Scope)   |

---

## 🔌 Complete API Reference

### Core & Health

- `GET /health` — Detailed system health payload (`api`, `database`, `cache`, `externalServices`)
- `GET /version` — Version metadata and active deployment commit SHA

### Authentication & MFA

- `POST /api/v1/auth/register` — Public student/patron registration
- `POST /api/v1/auth/login` — Authenticate credentials (returns access token & sets refresh cookie)
- `POST /api/v1/auth/refresh` — Rotate refresh token & issue new access token
- `POST /api/v1/auth/logout` — Revoke user session & clear cookies
- `POST /api/v1/auth/mfa/setup` — Generate TOTP secret & QR code
- `POST /api/v1/auth/mfa/verify` — Verify TOTP code and enable MFA

### Books & Catalog

- `GET /api/v1/books` — Search physical book catalog with filters & pagination
- `GET /api/v1/books/:id` — Retrieve book details by ID
- `GET /api/v1/books/:id/availability` — Retrieve real-time available copies
- `GET /api/v1/catalog/external-search` — Aggregated search across Open Library & Google Books

### E-Resources & Reader

- `GET /api/v1/eresources` — List digital e-resources (EPUB/PDF)
- `GET /api/v1/eresources/:id/stream` — Stream e-resource file with HTTP 206 Range support
- `POST /api/v1/annotations` — Create text highlight/note annotation
- `GET /api/v1/annotations` — Fetch patron annotations for an e-resource

### Lab Reservations

- `GET /api/v1/lab/seats` — Get computer lab seat grid status
- `POST /api/v1/lab/bookings` — Reserve a workstation seat for a time slot
- `DELETE /api/v1/lab/bookings/:id` — Cancel workstation reservation

### Fines & Payments

- `GET /api/v1/fines` — Get patron outstanding fines
- `POST /api/v1/payments/create-order` — Create Razorpay order ID for fine payment
- `POST /api/v1/payments/verify` — Verify payment HMAC signature and clear fine
- `POST /api/v1/payments/webhook` — Razorpay webhook endpoint (`payment.captured`)

---

## ⚙️ Environment Configuration Reference

Create a `.env` file in `server/` based on the following template:

```env
# Server Configuration
PORT=5000
NODE_ENV=production
CLIENT_ORIGIN=https://book-buddy-eight-rosy.vercel.app

# Database
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/bookbuddy?retryWrites=true&w=majority

# Authentication & JWT Secrets
JWT_SECRET=your_super_secret_jwt_access_key_min_32_chars
JWT_REFRESH_SECRET=your_super_secret_jwt_refresh_key_min_32_chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Cache & Distributed Store (Optional - Fallback to In-Memory)
REDIS_URL=rediss://default:password@redis-instance.render.com:6379

# External APIs
GOOGLE_BOOKS_API_KEY=your_google_books_api_key

# Payment Gateway
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret_key
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# Cloud Storage (Optional for cover uploads)
CLOUDINARY_URL=cloudinary://key:secret@cloud_name
```

---

## 🚀 Quick Start & Installation Guide

### Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **MongoDB**: `v6.0` or cloud instance (Atlas)

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/Aditya-Naikwadi/BookBuddy.git
cd BookBuddy

# Install server dependencies
cd server
npm install --legacy-peer-deps

# Install client dependencies
cd ../client
npm install --legacy-peer-deps
```

### 2. Environment Setup & Database Initialization

```bash
# In server/ directory, set up your .env file
cp .env.example .env

# Seed initial super-admin account & sample college
npm run seed:superadmin

# Apply database index definitions
npm run migrate:db
```

### 3. Run Development Servers

```bash
# Start backend server (Port 5000)
cd server
npm run dev

# In a separate terminal, start frontend dev server (Port 5173)
cd client
npm run dev
```

### 4. Running Tests & Quality Gates

```bash
# Run server Jest test suite
cd server
npm test

# Run client Vitest test suite
cd client
npm test

# Run full project CI check (Linter + Format Check + Tests)
npm run ci:check
```

---

## 📁 Repository Structure

```
BookBuddy/
├── .github/
│   └── workflows/                # GitHub Actions CI/CD & Heartbeat workflows
├── api/                          # Vercel Serverless entry point (api/index.js)
├── client/                       # React 19 Frontend SPA (Vite 8)
│   ├── public/                   # Static assets & version.json
│   ├── src/
│   │   ├── api/                  # Axios HTTP client & CSRF interceptors
│   │   ├── components/           # Reusable UI components & Radix primitives
│   │   ├── hooks/                # Custom React hooks & React Query mutations
│   │   ├── pages/                # Route pages (Student, College Admin, Super Admin)
│   │   ├── services/             # WebSockets (Socket.io) & E-reader services
│   │   ├── store/                # Zustand client state stores
│   │   └── workers/              # Web Worker CSV parsing engine
│   └── vite.config.js            # Vite build configuration
├── docs/                         # Architecture & design documentation
│   └── architecture/             # Detailed backend, frontend & database design docs
├── logs/                         # Persistent JSONL audit & verification logs
├── scripts/                      # Deployment verification & monitoring scripts
├── server/                       # Express 5 Node.js Backend
│   ├── src/
│   │   ├── config/               # Database, Redis, and Environment managers
│   │   ├── controllers/          # API route controllers
│   │   ├── dtos/                 # Data Transfer Objects
│   │   ├── middlewares/          # Security, Auth, CORS, and Tenant scoping
│   │   ├── models/               # Mongoose 9 Data Schemas
│   │   ├── routes/               # Express 5 router definitions
│   │   ├── services/             # Business logic & session management services
│   │   ├── sockets/              # Socket.io event handlers
│   │   ├── tests/                # Jest integration & unit test suites
│   │   └── utils/                # Helper utilities (Redis, Token, Logger)
│   ├── Dockerfile                # Production Docker container manifest
│   └── package.json              # Server dependencies & scripts
├── render.yaml                   # Render PaaS deployment specification
├── vercel.json                   # Vercel SPA routing & rewrite rules
└── README.md                     # Project master documentation
```

---

## 📄 License

This project is licensed under the **ISC License**. Created and maintained by [Aditya Naikwadi](https://github.com/Aditya-Naikwadi).
