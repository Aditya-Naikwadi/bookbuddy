# ADR 0007: Session Persistence and Distributed Cron Locking

- **Status**: Accepted
- **Date**: 2026-10-22
- **Deciders**: @engineering-backend-architect, @security-appsec-engineer
- **Consulted**: @testing-test-automation-engineer, @engineering-devops-automator

---

## Context and Problem Statement

### 1. Session Persistence & Redis Loss Behavior
BookBuddy stores active user refresh sessions in two tiers:
- **Fast Tier (Redis)**: `session:${hash}` with a 30-day TTL (`2,592,000` s) for fast O(1) in-memory resolution.
- **Durable Tier (MongoDB)**: `RefreshToken` collection containing `userId`, `tokenHash`, `expiresAt`, `deviceInfo`, and `parentTokenId`.

When Redis restarts or evicts keys under memory constraints, `sessionService.getSessionByHash` falls back to MongoDB `RefreshToken.findOne({ tokenHash: hash })`. However:
- The rotated token replacement pointer (`session:${clientHash}`) with 3,600s TTL for parallel request race tolerance is stored only in Redis.
- If Redis restarts during a token rotation burst, parallel requests could theoretically trigger session reuse revocation if not recorded in MongoDB.
- Redis on the VM will be memory-capped (e.g. 128 MB maxmemory with `volatile-lru`).

### 2. Multi-Instance Cron Execution & Distributed Locking
In `cronService.js:20-60`, `runJob` uses a process-local in-memory set:
```javascript
const runningJobs = new Set();
```
`server.js:87` starts `initCronJobs()` unconditionally on boot. There is no environment switch (`ENABLE_CRON`) to disable background jobs on secondary instances or CLI tasks.
If two instances (e.g. during a blue-green deploy, a multi-core PM2 cluster, or a staging and production VM sharing a database) run concurrently:
- Both instances trigger every cron job at the same schedule.
- Overdue loans receive duplicate notification alerts.
- Due reminders send duplicate emails and push notices.
- Streak checks race to evaluate freeze consumption and check-in logs.

---

## Decision Drivers

1. **Zero User Logouts on Redis Restart**: A local Redis restart or flush must never force active users to log in again.
2. **Distributed Job Execution Safety**: Exactly one instance must execute each scheduled background job, even if multiple processes are alive.
3. **Graceful Single-Instance & Multi-Instance Support**: Must work seamlessly on a single VM today while being distributed-ready for multi-instance clusters.
4. **Resilience & Fallback**: If Redis is offline, the distributed lock must fall back to MongoDB atomic leases.

---

## Considered Options

### Distributed Locking Strategy
#### Option A: Distributed Lease with Redis `SET NX EX` and MongoDB Collection Fallback [RECOMMENDED]
- Job runner acquires an atomic lock prior to executing any scheduled job:
  - **Primary**: `SET lock:cron:${jobName} ${instanceId} EX ${ttlSeconds} NX` on Redis.
  - **Secondary (if Redis unavailable)**: `JobLock.findOneAndUpdate({ _id: jobName, lockedUntil: { $lt: new Date() } }, { $set: { lockedUntil: new Date(Date.now() + ttlMs), lockedBy: instanceId } }, { upsert: true, returnDocument: 'after' })`.
- Introduce an explicit environment variable: `ENABLE_CRON=true|false` (default: `true`). In multi-worker PM2 setups or secondary instances, set `ENABLE_CRON=false` on all but the designated primary worker.
- Keep the existing `CronRunLog` audit trail in MongoDB for centralized execution history.

#### Option B: Standalone External Worker Process
- Separate cron into an entirely distinct Node.js process (`worker.js`).
- **Cons**: Adds operational complexity and increases memory consumption on an `e2-micro` / `e2-small` VM.

### Session Persistence Strategy
#### Option 1: Dual-Write with MongoDB as Ground Truth & Redis as Read Cache [RECOMMENDED]
- Reaffirm MongoDB `RefreshToken` as the permanent source of truth and Redis as an ephemeral read cache.
- Ensure all session revocations and replacements (`replacedBy`, `revokedAt`) are persistently mirrored in `RefreshToken` (already supported in `RefreshToken.updateOne`).
- Configure Redis maxmemory eviction to `volatile-lru` so Redis only evicts keys with an explicit TTL, protecting perpetual keys and evicting expired cache entries first.

---

## Decision Outcome

1. **Add `ENABLE_CRON` Environment Flag**: Default `true`. If set to `false`, `initCronJobs()` does not register node-cron schedules.
2. **Implement Dual-Tier Distributed Job Lock**: Redis `SET key val EX ttl NX` with MongoDB `JobLock` conditional atomic upsert fallback.
3. **Retain Dual-Tier Session Persistence**: Redis for fast O(1) read cache, MongoDB `RefreshToken` as immutable durability layer. Configure Redis `maxmemory-policy volatile-lru`.

---

## Implementation Details (Phase 3)

- Implemented `backend/src/models/CronJobLock.js` with TTL expiration index.
- Implemented `backend/src/utils/distributedLock.js` with `acquireLock` and `releaseLock` supporting Redis lease (`SET EX NX`) and atomic MongoDB fallback (`findOneAndUpdate` with `returnDocument: 'after'`).
- Integrated distributed lock acquisition into `cronService.js:runJob(jobName, jobFn, customTtlSeconds)`.
- Enforced daily job idempotency:
  - `runOverdueFineAccrual` tracks `fine.lastNotifiedAt` to prevent duplicate daily notifications.
  - `runDueReminders` tracks `loan.lastReminderSentAt` to prevent duplicate reminders within the same calendar day.
  - `runRegistrationCleanup` utilizes idempotent `deleteMany` older than 7 days.
- Added `stopCronJobs` for graceful shutdown and test isolation.
- Verified with 9/9 passing tests in `backend/src/tests/deploymentPhase3.test.js`.
