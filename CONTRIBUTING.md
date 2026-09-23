# Contributing Guidelines & Quality Assurance Policy

Welcome to BookBuddy! To maintain high reliability, multi-tenant isolation, and data consistency across campus digital libraries, all contributors and AI agents must follow this quality assurance policy.

---

## 🔒 The Permanent CI Gate Policy (Audit-to-Gate Law)

> **"Any bug found via manual audit or code review must result in either (a) a permanent automated CI check preventing recurrence, or (b) an explicit, documented reason why automation isn't feasible and a scheduled manual recheck cadence instead."**

One-off manual fixes that quietly stop being verified the moment a review ends are prohibited. Every security, architectural, or concurrency vulnerability discovered must be codified into:
1. A static lint/AST rule in `scripts/testing/` or `scripts/security/`,
2. A unit/contract/concurrency test executed as a blocking CI gate, OR
3. If automation is infeasible (e.g. human auditory screen reader evaluation), an entry in [`docs/SCHEDULED_AUDITS.md`](file:///c:/Users/naikw/OneDrive/Desktop/project/BookBuddy/docs/SCHEDULED_AUDITS.md) with an assigned cadence and checklist.

---

## 🛡️ Pre-Commit & PR Verification Gates

Before submitting a Pull Request, run the local verification suite:

```bash
# 1. Run all static architecture and security gates
npm run ci:gates

# 2. Run database index-usage & COLLSCAN check (requires MongoDB test instance)
npm run check:indexes

# 3. Run concurrency race condition invariants test suite
npm run test:concurrency

# 4. Run test suites across backend and frontend
npm run test:server
npm test --prefix frontend
```

### Automated Merge Gates Enforced in CI:
- **Dependency Scanning**: `npm audit` blocks merge on any High/Critical CVE. Moderate CVEs require active, documented triage in `config/audit-triage.json`.
- **Secret-Leak Scanning**: Pre-commit hook and CI pull request diff scanner flag unmasked credentials, API keys, and connection strings.
- **Tenant Isolation**: Verifies that every query on tenant models (`Book`, `Loan`, `Fine`, etc.) includes `collegeId` scoping.
- **Transaction Boundaries**: Forbids side effects (`sendEmail`, `sendSMS`, `.emit()`) inside `runInTransaction()` blocks.
- **Contract Layer**: Fails CI if frontend forms or backend routes declare inline schemas rather than importing canonical Zod schemas from `@bookbuddy/shared`.
- **Identity & Role Normalization**: Fails CI on ad hoc `.toLowerCase()` derivations, legacy `"college-student"` strings, or hardcoded role arrays.
- **Index-Usage (COLLSCAN Prevention)**: Runs `.explain('executionStats')` against seeded multi-tenant datasets to ensure `IXSCAN` on all critical query paths.
- **Concurrency Invariants**: Stress tests RSVP capacity, fine double-payment, and coupon redemption under parallel requests.

For a comprehensive inventory of all gates, their locations, and historical motivations, see [`docs/CI_GATES.md`](file:///c:/Users/naikw/OneDrive/Desktop/project/BookBuddy/docs/CI_GATES.md).
