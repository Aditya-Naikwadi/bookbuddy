# AGENTS.md — BookBuddy AI Agent Guidelines & Canonical Conventions

This document is the **single source of truth** for all AI coding assistants (Gemini, Claude, Cursor, Windsurf, Copilot, etc.) working on the BookBuddy codebase.

---

## Core Architecture & Stack Guidelines

1. **Monorepo Structure**:
   - `frontend/`: React 19 + Vite + Zustand + TanStack Query UI client.
   - `backend/`: Node.js 24 + Express + MongoDB/Mongoose + Socket.io API server.
   - `database/`: Schema migrations (`database/migrations/`).
   - `api/`: Vercel serverless function entrypoint (`/api/index.js`).
   - `tests/`: Dedicated load tests and integration testing workspace.

2. **Hard Architecture Constraints**:
   - **Multi-Tenant Data Isolation**: Always preserve `collegeId` scoping on database operations and backend query parameters.
   - **Environment Variables**: Always import validated environment variables from `backend/src/config/env.js` (backed by Zod schema validation).
   - **Realtime & Background Tasks**: Do not break Socket.io realtime flows (streaks, notifications) or node-cron scheduled tasks (fines, hold expiration).
   - **Component Refactoring Workflow**: Follow the strict `Audit -> Propose -> Confirm -> Execute` cycle before extracting component logic.

3. **Verification Standards**:
   - Run `npm test` inside `frontend/` (Vitest test suite) and `backend/` (Jest test suite).
   - Run `npm run build` inside `frontend/` to verify production Vite dynamic chunk builds.

---

<!-- graft:start -->
## Graft — Repo Context Graph

This repo is indexed in `.local/graft/` (or `graft/`): small linked markdown nodes that explain each system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives, or scoping a change — get context from the graph before grepping or opening source files. Re-ask freely (it's cheap) and reuse literal identifiers you already have (symbol, error string, file name) as the query.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant code spans inlined.
- `graft skeleton <file>` → definition signature + span (~10x cheaper than reading whole file).
- `graft callers <symbol>` → precomputed exact caller/callee edges.
- After big code changes, refresh the graph with `graft build`.
<!-- graft:end -->
