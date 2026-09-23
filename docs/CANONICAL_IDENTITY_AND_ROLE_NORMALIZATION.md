# Canonical Identity & Role Normalization Architecture

This document specifies the architectural conventions, canonical standards, and implementation invariants for **identity** (`email`, `studentId`) and **role** representation across the BookBuddy platform.

---

## 1. Executive Summary & Problem Context

Prior to this architecture, identity and role values suffered from **field drift**, **un-normalized casing**, and **dual-acceptance workarounds**:
1. **Identity Casing & Trimming Drift**: `email` and `studentId` were intermittently lowercased or trimmed in some controllers (`rosterUploadController`, `authController`) while bypassed in others. A student who registered as `Alex.Smith@Stanford.EDU` or had `STU-999` in a CSV roster upload could fail login or join-request auto-matching when providing `alex.smith@stanford.edu` or `stu-999`.
2. **Role Drift (`student` vs `college-student`)**: Institutional students were assigned `college-student` in some registration paths, but `student` in the campus roster upload and schema defaults. This caused route guards (`App.jsx`, `DashboardLayout.jsx`, `ProtectedRoute.jsx`) to maintain fragile dual-acceptance arrays like `["student", "college-student"]`, creating security risks and subtle permission disparities.
3. **Redundant Dual-Fact Representations**: Models like `College.js` tracked both `status` (`'active' | 'suspended' | 'archived'`) and `isActive` (`boolean`), with drift risk when updates modified one field without synchronizing the other.

---

## 2. Canonical Representations

The platform establishes the following **single canonical representations**:

| Field | Canonical Value | Invariants | Prohibited Drift |
| :--- | :--- | :--- | :--- |
| **`studentId`** | Lowercase, trimmed string | Normalized **at write time** (on registration, bulk CSV ingestion, manual creation) | Storing uppercase, whitespace-padded IDs; ad hoc inline `.toLowerCase()` |
| **`email`** | Lowercase, trimmed string | Normalized **at write time** (on registration, login lookup, OTP generation) | Storing mixed-case emails; inline `.toLowerCase()` calls outside the shared utility |
| **`role`** | Unified canonical enum | `student`, `college-admin`, `super-admin`, `general` | `college-student`, `college_admin`, `super_admin` |

### The Role Normalization Decision: Collapsing `college-student` to `student`
- **Definitive Decision**: `college-student` is completely collapsed to `student` (`ROLES.STUDENT = 'student'`) platform-wide.
- **Rationale**: Institutional tenancy and student privileges are already strictly scoped by `user.collegeId`. Having both `role: 'college-student'` and `role: 'student'` represents the same underlying actor twice, leading to divergent authorization checks.
- **Tenant Scoping Invariant**: A user with `role: 'student'` and a non-null `collegeId` is an institutional student belonging to that institution. A user with `role: 'student'` and null `collegeId` is prohibited by multi-tenant schema constraints.
- **Backwards Compatibility**: In-flight sessions or external clients sending `college-student` are immediately mapped to `student` by `normalizeRole()`.

---

## 3. The Shared Normalization Layer (`@bookbuddy/shared`)

All normalization functions reside exclusively in `@bookbuddy/shared`:

### Module Locations
- **Constants**: [`shared/src/constants/roles.js`](file:///shared/src/constants/roles.js)
  - `ROLES`: Object mapping (`STUDENT: 'student'`, `COLLEGE_ADMIN: 'college-admin'`, `SUPER_ADMIN: 'super-admin'`, `GENERAL: 'general'`)
  - `CANONICAL_ROLES`: `['student', 'college-admin', 'super-admin', 'general']`
  - `ROLE_GROUPS`: `STUDENTS`, `ADMINS`, `STAFF`, `ALL`
- **Utilities**: [`shared/src/utils/normalization.js`](file:///shared/src/utils/normalization.js)
  - `normalizeEmail(email)`: Trims and lowercases emails; handles null/undefined safely.
  - `normalizeStudentId(studentId)`: Trims and lowercases student identifiers; returns null/undefined if empty.
  - `normalizeIdentity(identifier)`: Unified identifier normalizer for login/auth lookups.
  - `normalizeRole(role)`: Maps legacy values (`college-student` $\to$ `student`, `college_admin` $\to$ `college-admin`, `super_admin` $\to$ `super-admin`).

---

## 4. Belt-and-Suspenders Schema Enforcement

Even if a future write path bypasses a controller or normalization utility, the **Mongoose schema layer acts as a permanent firewall**:

### `User.js` Normalization Hooks
1. **Schema Setters**:
   ```javascript
   studentId: { type: String, trim: true, lowercase: true, set: normalizeStudentId },
   email: { type: String, trim: true, lowercase: true, set: normalizeEmail },
   role: { type: String, enum: CANONICAL_ROLES, default: ROLES.STUDENT, set: normalizeRole }
   ```
2. **Pre-Save Middleware**: Runs on `.save()` and `create()`.
3. **Pre-Update Middleware**: Runs on `findOneAndUpdate`, `updateOne`, `updateMany`, `findByIdAndUpdate`.
   - Normalizes top-level fields: `update.email`, `update.studentId`, `update.role`.
   - Normalizes MongoDB operator objects: `update.$set`, `update.$setOnInsert`.
4. **Status / Active Synchronization**:
   - Setting `status: 'active'` automatically forces `isActive: true`.
   - Setting `status: 'inactive' | 'suspended' | 'archived'` automatically forces `isActive: false`.

---

## 5. Database Migration Safety Standards

Existing records in production with legacy drifted roles (`college-student`, `college_admin`, `super_admin`) are safely transitioned using the following migration:

**File**: [`database/migrations/20260923000001-normalize-user-roles.js`](file:///database/migrations/20260923000001-normalize-user-roles.js)

### Safety Guarantees
1. **Backup-First**: Creates a timestamped snapshot collection (`users_backup_<timestamp>`) containing all documents before any write.
2. **Atomic In-Place Update**: Uses bulk operations with single roundtrip to MongoDB.
3. **Idempotency**: Running the migration multiple times produces zero unintended side effects.
4. **Full Rollback**: `down(db)` restores from the exact snapshot collection.

---

## 6. Verification & Automated CI Enforcement

Drift prevention is maintained via automated test suites and CI scripts:

### Test Suites
1. **Schema Write Paths**: [`backend/src/tests/normalizationWritePaths.test.js`](file:///backend/src/tests/normalizationWritePaths.test.js)
   - Tests `.save()`, `create()`, `insertMany()`, `findOneAndUpdate()`, `updateOne()`.
2. **Login Casing Invariance**: [`backend/src/tests/identityCasingLogin.test.js`](file:///backend/src/tests/identityCasingLogin.test.js)
   - Verifies mixed-case and whitespace-padded logins match canonical records.
3. **AppSec Permission Parity**: [`backend/src/tests/permissionParity.test.js`](file:///backend/src/tests/permissionParity.test.js)
   - Verifies before/after permission parity across routes, tokens, and access boundaries.

### CI Grep & AST Check
Run in terminal:
```bash
npm run check:normalization
```
- Flags direct `.toLowerCase()` / `.toUpperCase()` on identity fields outside `@bookbuddy/shared`.
- Flags hardcoded role array literals (e.g., `["student", ...]`) that bypass `ROLES`.
- Flags any forbidden `college-student` literals in non-compatibility application code.
