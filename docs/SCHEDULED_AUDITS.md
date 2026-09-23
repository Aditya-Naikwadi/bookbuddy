# Scheduled Recurring Audits & Non-Automatable Review Cadence

> **Status**: Standing Engineering Policy  
> **Authority**: [AGENTS.md](file:///c:/Users/naikw/OneDrive/Desktop/project/BookBuddy/AGENTS.md), [CONTRIBUTING.md](file:///c:/Users/naikw/OneDrive/Desktop/project/BookBuddy/CONTRIBUTING.md)  
> **Principle**: Any finding or risk that cannot be 100% deterministically verified by an automated CI gate must be documented here with an explicit, tracked cadence and checklist.

---

## Cadence Matrix

| Audit Area | Cadence | Responsible Role / Agent | Verification Method | Deliverable |
| :--- | :--- | :--- | :--- | :--- |
| **WCAG 2.1 AA Accessibility** | Quarterly | Frontend Lead / A11y Auditor | Screen readers (NVDA/VoiceOver), keyboard-only flows, colour contrast in dynamic themes | `docs/a11y-audit.md` update |
| **RBAC & Privilege Escalation** | Bi-Monthly | Security Architect / AppSec | Inspect SuperAdmin controller mutations, role inheritance, and college scope bypass flags | Signed security review note |
| **Dependency Lifecycle & Deprecations** | Quarterly | DevOps Automator | Audit packages with deprecation warnings, check abandoned upstream maintenance (>18mo) | Dependency lifecycle issue |
| **Disaster Recovery & Backup Restores** | Semi-Annual | Infrastructure Lead | Spin up staging cluster, restore cold MongoDB dump, verify integrity with `check:indexes` | DR drill execution log |
| **Slow Query Review & Index Health** | Monthly | Performance Benchmarker | Inspect production MongoDB Atlas slow query logs (queries >100ms) | Atlas performance advisory report |

---

## Detailed Checklists

### 1. WCAG 2.1 AA Accessibility & Assistive Navigation (Quarterly)
*Reason Automation Is Insufficient*: Static linters (like `eslint-plugin-jsx-a11y`) can check for `alt` tags and `aria-` attributes, but cannot verify cognitive flow, logical tab order across dynamic modals/portals, screen reader announcement timing on live WebSocket events, or whether descriptions are genuinely informative.

- [ ] **Keyboard Navigation**: Verify complete library catalog browsing, cart operations, reservation modals, and patron registration using solely Tab, Shift+Tab, Enter, Space, and Esc. Zero focus traps.
- [ ] **Screen Reader Verification**: Test with NVDA (Windows) and VoiceOver (macOS). Verify live region announcements for checkout toast notifications and real-time fine updates.
- [ ] **Contrast Verification**: Test dark mode, light mode, and high-contrast college theme presets with Chrome DevTools or Lighthouse to ensure 4.5:1 text contrast and 3:1 graphical object contrast.

### 2. RBAC & Privilege Escalation Review (Bi-Monthly)
*Reason Automation Is Insufficient*: Architectural checks ensure `collegeId` is queried, but business logic permissions (e.g. whether a `department_librarian` can waive fines above $50 without approval) require context-dependent authorization review.

- [ ] Verify `backend/src/middlewares/auth.js` role validation hierarchy.
- [ ] Review any new usages of `skipTenantScope: true` to confirm they are strictly restricted to SuperAdmin platform analytics and inter-college ILL requests.
- [ ] Verify that no API endpoint allows self-assignment of the `superadmin` role or subRoles.

### 3. Dependency Lifecycle & Upstream Health (Quarterly)
*Reason Automation Is Insufficient*: `npm audit` checks known CVEs, but cannot detect unmaintained packages, stealth license shifts, or packages that should be phased out due to architectural obsolescence.

- [ ] Review all overrides in root and workspace `package.json` files.
- [ ] Inspect npm packages that have received no updates in 18+ months.
- [ ] Assess modern Node.js built-ins to replace third-party dependencies (e.g., native fetch, native crypto).

### 4. Disaster Recovery & Snapshot Restoration (Semi-Annual)
*Reason Automation Is Insufficient*: Database backups without verified restores provide false security.

- [ ] Trigger an automated backup snapshot in MongoDB Atlas or staging.
- [ ] Restore the snapshot into an isolated sandbox environment.
- [ ] Run `npm run check:indexes` and `npm run test:server` against the restored sandbox to confirm zero data corruption.
