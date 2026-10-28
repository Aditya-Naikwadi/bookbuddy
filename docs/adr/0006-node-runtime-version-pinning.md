# ADR 0006: Node.js Runtime Version Pinning (Node.js 22 LTS)

- **Status**: Proposed
- **Date**: 2026-10-22
- **Deciders**: @engineering-devops-automator, @engineering-backend-architect
- **Consulted**: @security-appsec-engineer, @testing-test-automation-engineer

---

## Context and Problem Statement

The repository currently exhibits widespread Node.js version divergence across manifests, documentation, and continuous integration workflows:
1. `README.md` badge declares `Node.js 24.x`.
2. `AGENTS.md` states `Node.js 24`.
3. Root `package.json`, `backend/package.json`, and `frontend/package.json` engines declare `">=22.0.0"`.
4. All GitHub Actions workflows (`ci.yml`, `auto-remediation.yml`, `multi-layer-verification.yml`, `nightly-analysis.yml`, `production-heartbeat.yml`, `render-heartbeat.yml`) pin `node-version: 20`.
5. `.nvmrc` and `.node-version` are missing from the project root.
6. The backend server does not perform a boot-time check on `process.versions.node`, permitting execution under unverified Node runtimes.

Node.js 20 (Iron) entered End-of-Life (EOL) in April 2026 and no longer receives upstream security patches or vulnerability remediations. Node.js 22 (Jod) is the Active Maintenance LTS release (supported through April 30, 2027), while Node.js 24 is Current.

---

## Decision Drivers

1. **Active Long-Term Support (LTS)**: Production deployments must run on an actively maintained LTS release.
2. **Native Module Compatibility**: Native cryptographic dependencies (`argon2`, `bcrypt`) must compile and run deterministically on Linux x86_64 Debian/Ubuntu (GCP VM Compute Engine) and local developer machines without native toolchain regressions.
3. **Consistency Across Pipeline**: Monorepo engines, `.nvmrc`, local runtime, CI quality gates, and PM2 on the VM must match the exact same major version.
4. **Boot-Time Guardrail**: Server process must fail fast with a descriptive error if booted on a mismatched Node.js major version.

---

## Considered Options

### Option 1: Pin Node.js 22 LTS (`22.x`) Everywhere [RECOMMENDED]
- Pin `engines: { "node": "^22.0.0" }` in all `package.json` files.
- Create `.nvmrc` and `.node-version` containing `22`.
- Update all 8 GitHub Actions workflow definitions to `node-version: 22`.
- Update `README.md` and `AGENTS.md` to reference `Node.js 22 LTS`.
- Add a strict fail-fast validation check at the top of `backend/src/server.js`:
  ```javascript
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major !== 22) {
    console.error(`Fatal: Node.js 22 LTS required. Current runtime: ${process.version}`);
    process.exit(1);
  }
  ```
- **Pros**:
  - Node 22 is active LTS through April 2027.
  - Verified: Frontend Vite build and backend AST/linting suites build cleanly on `v22.17.1`.
  - Native binary prebuilds for `argon2` and `bcrypt` are readily available for Linux x86_64, eliminating compiler toolchain overhead on small VMs.
- **Cons**:
  - Requires updating all 8 CI workflow YAML files and 3 `package.json` files in Phase 1.

### Option 2: Pin Node.js 24 (`24.x`)
- Match the README badge and AGENTS.md text.
- **Pros**:
  - Matches current documentation headers.
- **Cons**:
  - Node 24 is newer; some deployment environments and transitive CLI tooling still lack universal prebuilt wheels for ARM/x86 native modules. CI runners and container base images may have longer bootstrap times.

### Option 3: Retain Node.js 20
- **Cons**:
  - Node 20 is EOL (April 2026). Shipping an EOL runtime to production fails standard enterprise security and compliance audits.

---

## Decision Outcome

**Adopt Option 1 (Node.js 22 LTS)**:
- Target major version: `22` (Active LTS).
- Pin in: `.nvmrc`, `.node-version`, root/backend/frontend `package.json` engines, all CI workflows, `README.md`, `AGENTS.md`, and deploy scripts.
- Enforce via boot-time fail-fast in `backend/src/server.js`.
