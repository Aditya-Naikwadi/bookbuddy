# BookBuddy Backend Architectural Guide

## Transaction Boundaries & Side-Effect Isolation (`runInTransaction`)

### Background & Problem Statement
In MongoDB multi-document transactions, database mutations are atomic, isolated, and reversible (aborted on errors or retried on transient write conflicts). However, external network requests, email/SMS dispatches, Socket.IO real-time emissions, and Redis cache evictions are non-transactional — they **cannot be rolled back** if the database transaction aborts or encounters a collision.

Prior to the introduction of `runInTransaction(transactionFn, afterCommitFn)`, several critical bugs existed where side effects leaked out of uncommitted transaction scopes:
1. **Loan Checkout (`loanService.checkoutBook`)**: Streak actions, gamification badge checks, and catalog availability socket emissions fired even if concurrent loan checkout aborted due to queue locks or fine limits.
2. **Book Return (`loanService.returnBook`)**: Borrower return confirmation emails and inventory watcher notifications dispatched before the loan return committed to the database.
3. **Lab & Workstation Booking (`labBookingService.createBooking`)**: Qualifying streak actions fired even if booking aborted due to double-booked seat collisions.
4. **Tenant Onboarding (`adminPortalController.approveTenantOnboarding`)**: Tenant welcome and credentials emails dispatched before the atomic creation of the College and Super Admin user finished committing.
5. **Streak System (`streakService.recordQualifyingAction`)**: Daily streak milestone notifications and socket updates broadcast during failed duplicate check-in attempts.
6. **Book Review Creation (`reviewController.createReview`)**: Review submitted gamification badges evaluated even when the database transaction encountered duplicate review constraints or rating aggregate failures.

---

### The Canonical Pattern: `runInTransaction`

All database operations requiring transactions MUST use `runInTransaction(transactionFn, afterCommitFn)` exported from `backend/src/utils/transactionHelper.js`. Direct usage of `mongoose.startSession()` or `session.withTransaction()` is prohibited and caught by CI static analysis.

```javascript
const { runInTransaction } = require('../utils/transactionHelper');

// ✅ ALWAYS DO THIS:
const result = await runInTransaction(
  // 1. transactionFn: Pure database operations inside session
  async (session) => {
    const [loan] = await Loan.create([{ ... }], { session });
    book.copiesAvailable -= 1;
    await book.save({ session });
    return { loan, book };
  },
  // 2. afterCommitFn: Side effects execute strictly after commitTransaction resolves
  async ({ loan, book }) => {
    await mailer.sendMail({ ... });
    io.to(`college:${collegeId}`).emit('book:availability_updated', { ... });
    await streakService.recordQualifyingAction(userId, collegeId, 'checkout');
  }
);
```

```javascript
// ❌ NEVER DO THIS:
await runInTransaction(async (session) => {
  await Loan.create([{ ... }], { session });
  
  // ANTI-PATTERN: Leaks side effect before commit!
  // If transaction aborts or driver retries on write conflict,
  // this email and socket emit executes prematurely or multiple times!
  await mailer.sendMail({ ... });
  io.emit('book:borrowed', { ... });
});
```

---

### Key Guarantees & Runtime Behavior

1. **Strict Post-Commit Execution**:
   `afterCommitFn` is guaranteed to execute ONLY after `commitTransaction()` resolves successfully. If `transactionFn` throws, aborts, or rolls back, `afterCommitFn` is NEVER invoked.
2. **Transient Error & Retry Safety**:
   When MongoDB encounters a transient transaction error (e.g., write conflict during high concurrency), the driver retries `transactionFn` automatically. `afterCommitFn` only runs **once**, on the final successful commit.
3. **Standalone Fallback**:
   In local development or test environments without a replica set, `runInTransaction` gracefully executes `transactionFn(null)` without a session, maintaining identical safety guarantees for `afterCommitFn`.
4. **Side-Effect Failure Containment**:
   If an error occurs inside `afterCommitFn`, it is caught and logged with `[SideEffectFailedAfterCommit]`. Because the database write has already committed, secondary failures (such as email server downtime) will not corrupt database consistency or crash the primary user workflow.
5. **AppSec & Dead-Letter Safety**:
   For business-critical notifications, side-effect operations should be idempotent or backed by durable job queues with retry capability.

---

### CI Enforcement & Static Analysis

A dedicated AST-based static analysis check prevents recurrence across the entire codebase:
```bash
npm run check:transactions
```
This check runs as part of `npm run ci:check` and scans all files under `backend/src/`. It automatically fails CI if:
- `startTransaction()` or `withTransaction()` is invoked outside `transactionHelper.js`.
- Any email, SMS, Socket.IO emit, streak recording, or notification call is placed inside a `transactionFn` callback.

---

## Atomic Conditional Updates & Race-Condition Prevention (`atomicConditionalUpdate`)

### Background & Problem Statement
A classic vulnerability pattern in web applications is the **check-then-act** race condition:
1. Application reads a document or counter from MongoDB into Node.js memory (`const doc = await Model.findById(...)`).
2. Application checks a condition in JavaScript memory (`if (doc.rsvpUsers.length < doc.maxCapacity)` or `if (doc.status === 'unpaid')`).
3. Application mutates the document in memory and saves it back (`await doc.save()`).

Between Step 1 and Step 3, concurrent requests can execute identical reads, see the exact same condition as true, and commit simultaneous writes. This results in:
- **RSVP Capacity Overshoots**: 10 users RSVP simultaneously for 3 seats, and all 10 succeed, exceeding `maxCapacity`.
- **Fine Double-Payments & Financial Inconsistencies**: Concurrent payment requests mark the same fine paid twice or spend a student's single waiver coupon multiple times.
- **Inventory & Copy Count Drift**: Concurrent book returns increment `copiesAvailable` beyond `copiesTotal`.
- **Renewal Limit Bypasses**: Concurrent renewal requests increment `renewalCount` beyond `maxRenewals`.

---

### The Canonical Pattern: `atomicConditionalUpdate`

All capacity-constrained, stock-limited, or state-transition updates MUST use `atomicConditionalUpdate(Model, matchQuery, conditionExpr, updateOp, options)` exported from `backend/src/utils/atomicUpdateHelper.js`.

The precondition check and database write are combined into a single, indivisible database-tier operation:

```javascript
const { atomicConditionalUpdate } = require('../utils/atomicUpdateHelper');

// ✅ ALWAYS DO THIS:
const result = await atomicConditionalUpdate(
  Announcement,
  { _id: announcementId, collegeId },
  {
    // $expr evaluated atomically inside MongoDB engine:
    $or: [
      { $eq: ['$maxCapacity', null] },
      { $lte: ['$maxCapacity', 0] },
      { $lt: [{ $size: '$rsvpUsers' }, '$maxCapacity'] },
    ],
  },
  {
    $addToSet: {
      rsvpUsers: { userId, rsvpAt: new Date() },
    },
  },
  { new: true, checkExistenceOnFailure: true }
);

if (!result.matched) {
  if (result.reason === 'NOT_FOUND') {
    throw new AppError('Announcement not found.', 404);
  }
  // Exactly captured: someone else filled the last seat!
  throw new AppError('This event has reached maximum capacity.', 400);
}
```

```javascript
// ❌ NEVER DO THIS:
const announcement = await Announcement.findById(id);

// ANTI-PATTERN: In-memory race window!
// 10 concurrent requests see rsvpUsers.length === 2 and all pass!
if (announcement.rsvpUsers.length >= announcement.maxCapacity) {
  throw new AppError('Event is full', 400);
}

announcement.rsvpUsers.push({ userId, rsvpAt: new Date() });
await announcement.save(); // OVER-CAPACITY CORRUPTION!
```

---

### Comparison of Retrofitted Patterns

| Contended Resource | Unsafe (Check-Then-Act) Pattern | Safe Indivisible Pattern (`atomicConditionalUpdate`) |
| :--- | :--- | :--- |
| **Event RSVPs** (`announcementController.js`) | `if (rsvpUsers.length < maxCapacity)` then `.save()` | Match query with `$expr: { $lt: [{ $size: '$rsvpUsers' }, '$maxCapacity'] }` and `$addToSet` |
| **Fine Payments** (`fineService.js`) | `if (fine.status === 'unpaid')` then `fine.status = 'paid'` | Match query `{ _id, status: 'unpaid' }` with `$set: { status: 'paid', paidAt }` |
| **Waiver Coupons** (`fineService.js`) | `if (user.fineWaiverCoupons > 0)` then `user.fineWaiverCoupons--` | Match query `{ _id: userId, fineWaiverCoupons: { $gt: 0 } }` with `$inc: { fineWaiverCoupons: -1 }` |
| **Book Return Inventory** (`loanService.js`) | Read `book.copiesAvailable`, branch, save | Match query with `$expr: { $lt: ['$copiesAvailable', '$copiesTotal'] }` with `$inc: { copiesAvailable: 1 }` |
| **Loan Renewals** (`loanService.js`) | `if (loan.renewalCount < maxRenewals)` then save | Match query with `$expr: { $lt: ['$renewalCount', '$maxRenewals'] }` with `$inc: { renewalCount: 1 }` |
| **Streak Repair Freezes** (`streakService.js`) | `if (user.freezesAvailable > 0)` then save | Match query `{ _id: userId, freezesAvailable: { $gt: 0 } }` with `$inc: { freezesAvailable: -1 }` |
| **Lab/Facility Booking Availability** | Query free slots in DB, branch, insert | Compound partial unique index (`{ resourceId, date, slotStart, status: 'confirmed' }`) + `runInTransaction` |

---

### CI Enforcement & Concurrency Test Suite

1. **Static Analysis Heuristic Scanner**:
   ```bash
   npm run check:races
   ```
   Scans all backend services and controllers for candidate check-then-act sequences (reading models and modifying status/counters via `.save()`).
2. **Dedicated Concurrency Invariant Suite**:
   ```bash
   npm run test:concurrency
   ```
   Fires simultaneous requests across 10 concurrent workers against single constrained resources to prove invariants hold under real thread contention:
   - RSVP capacity ceiling strictly enforced (zero overshoots).
   - Fine double-payments cleanly rejected (exactly 1 payment succeeds).
   - Coupon waiver over-redemption prevented (exactly 1 coupon spent).
   - Inventory copies never exceed total count.
   - Streak freeze balances never drop below zero.
