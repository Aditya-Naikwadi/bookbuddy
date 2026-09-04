# BookBuddy — Project Repository Structure

This document outlines the organized, production-grade layout of the BookBuddy full-stack monorepo.

## Overview

BookBuddy uses a **Strict Separation of Concerns Architecture** with explicit top-level directories:

```
BookBuddy/
├── .agents/                      # Live AI Customization Root (system rules & 90 role personas)
├── .claude/ .cursor/ .gemini/    # Tool configuration directories (required at root)
├── .windsurf/ .github/ .husky/   # CI/CD workflows and git hooks (required at root)
├── .vscode/ .vercel/             # Workspace editor settings & Vercel metadata
├── .local/                       # Ephemeral working directory (gitignored)
│   ├── graft/                    # Graft codebase context graph index
│   ├── logs/                     # Deployment audit logs
│   └── scratch/                  # Temporary local developer scripts
├── AGENTS.md                     # SINGLE source of truth for AI instructions & guidelines
├── CLAUDE.md                     # Pointer to AGENTS.md
├── GEMINI.md                     # Pointer to AGENTS.md
├── .cursorrules                  # Pointer to AGENTS.md
├── .windsurfrules                # Pointer to AGENTS.md
├── .mcp.json                     # Model Context Protocol server configuration
├── api/                          # Vercel serverless entry point (index.js)
├── deployment/                   # Process & proxy configuration (ecosystem.config.js, nginx.conf)
├── frontend/                     # React 19 + Vite frontend application
│   ├── public/                   # Static assets, PWA manifest, service worker assets
│   ├── scripts/                  # Client build scripts (version generation)
│   └── src/                      # Application Source Code
│       ├── api/                  # Axios HTTP client instances & API wrappers
│       ├── assets/               # App icons, illustrations, and SVG graphics
│       ├── components/           # Reusable UI components (ui/, ops/, dashboard/, student/)
│       ├── config/               # Feature flags & route access rules
│       ├── constants/            # Badge definitions, navigation maps, app constants
│       ├── content/              # Static documentation templates
│       ├── i18n/                 # Internationalization setup & translation files
│       ├── layouts/              # Top-level page wrappers (DashboardLayout, AuthLayout)
│       ├── lib/                  # Browser utilities & helpers (downloadManager, progressCache)
│       ├── pages/                # Page route views (public/, student/, college-admin/, admin-portal/)
│       ├── providers/            # React providers (QueryProvider)
│       ├── sections/             # Landing page section components
│       ├── store/                # Zustand global stores (authStore)
│       ├── tests/                # Vitest test suites (20 test suites, 63 tests)
│       ├── utils/                # Utility helpers (cn, citationFormatter)
│       └── workers/              # Background Web Workers
├── backend/                      # Express.js REST & Socket.io backend server
│   └── src/                      # Backend Express Source Code
│       ├── app.js                # Express app middleware & route wiring
│       ├── server.js             # HTTP server entry point & Socket.io setup
│       ├── config/               # DB connection, Zod boot-time env validation, Passport auth, Redis
│       ├── controllers/          # Route handlers grouped by sub-domain
│       ├── docs/                 # OpenAPI / Swagger specification
│       ├── dtos/                 # Data Transfer Object mappings
│       ├── middlewares/          # Express middlewares (auth, validation, rate limits)
│       ├── models/               # Mongoose MongoDB Data Models
│       ├── plugins/              # Plugin extension modules
│       ├── routes/               # Express endpoint routes
│       ├── services/             # Core business logic services
│       ├── sockets/              # Realtime Socket.io event handlers
│       ├── tests/                # Jest integration test suites (79 suites, 428 tests)
│       ├── utils/                # Backend utility helpers (asyncHandler, token, storage)
│       └── validations/          # Zod validation schemas
├── database/                     # Schema migrations & database assets
│   └── migrations/               # Schema migrations (migrate-mongo)
├── docs/                         # Documentation & reference guides (AI_TOOLING.md, CASE_STUDY.md)
├── tests/                        # Dedicated multi-layer testing workspace
│   └── load/                     # Performance & load testing suite (k6/, artillery/, smoke.js)
├── render.yaml                   # Render Cloud Blueprint specification (required at root)
├── vercel.json                   # Vercel platform deployment manifest (required at root)
├── uploads/                      # Runtime upload directory (gitignored)
├── STRUCTURE.md                  # Workspace folder structure documentation
└── package.json                  # Root monorepo workspace configuration
```

## Key Rules & Conventions

1. **Frontend Isolation (`/frontend`)**: All client UI components, styling, React hooks, and HTTP client wrappers reside strictly inside `/frontend`.
2. **Backend Isolation (`/backend`)**: All Express controllers, services, middlewares, and Socket.io event dispatchers reside inside `/backend`.
3. **Database Domain (`/database`)**: Database schema migrations and seed configurations are contained in `/database`.
4. **Testing Workspace (`/tests`)**: Load tests and cross-cutting test automation scenarios are isolated in `/tests`.
5. **Deployment & Infra (`/deployment`)**: Non-root deployment manifests (`ecosystem.config.js`, `nginx.conf`) live in `/deployment`. `vercel.json` and `render.yaml` remain at root as required by platform conventions.
6. **Ephemeral Files (`/.local`)**: Working directories (`logs/`, `scratch/`, `graft/`) reside inside `.local/` and are fully gitignored.
