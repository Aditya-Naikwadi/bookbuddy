const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * ============================================================================
 * BOOKBUDDY TRANSACTION & SIDE-EFFECT ISOLATION HELPER
 * ============================================================================
 *
 * ARCHITECTURAL INVARIANT:
 * Database transactions are strictly for atomic state transitions within MongoDB.
 * External network calls, emails, SMS, Socket.IO emits, and queue promotions are
 * non-transactional and CANNOT be rolled back by MongoDB if the transaction aborts
 * or retries.
 *
 * ❌ NEVER DO THIS:
 * ```javascript
 * await runInTransaction(async (session) => {
 *   await Loan.create([{ ... }], { session });
 *   // BUG: If transaction aborts or retries, this side effect leaks!
 *   await mailer.sendMail({ ... });
 *   io.emit('book:loaned', { ... });
 * });
 * ```
 *
 * ✅ ALWAYS DO THIS:
 * ```javascript
 * await runInTransaction(
 *   async (session) => {
 *     // Pure DB writes inside session
 *     const [loan] = await Loan.create([{ ... }], { session });
 *     return loan;
 *   },
 *   async (loan) => {
 *     // Side effects run ONLY after commitTransaction resolves successfully
 *     await mailer.sendMail({ ... });
 *     io.emit('book:loaned', { ... });
 *   }
 * );
 * ```
 *
 * RETRY-SAFETY & GUARANTEES:
 * 1. If MongoDB encounters a transient transaction error (e.g. write conflict),
 *    the driver retries `transactionFn` internally. `afterCommitFn` is guaranteed
 *    to fire EXACTLY ONCE on the final successful commit.
 * 2. If the transaction aborts, rolls back, or throws, `afterCommitFn` NEVER fires.
 * 3. In standalone mode (e.g. local dev / CI without replica sets), gracefully
 *    executes `transactionFn(null)` and runs `afterCommitFn` only on success.
 * 4. Side-effect failure containment: If `afterCommitFn` encounters an unexpected error,
 *    it is logged via `logger.error` with a structured `[SideEffectFailedAfterCommit]` tag.
 *    Because the database write has already committed, it will not corrupt or roll back
 *    the committed database state.
 */

/**
 * Helper to determine whether the active MongoDB connection is a replica set.
 *
 * @param {mongoose.Connection} conn
 * @returns {boolean}
 */
const checkIsReplicaSet = (conn) => {
  if (process.env.FORCE_STANDALONE_TX === 'true') {
    return false;
  }
  if (process.env.FORCE_REPLICASET_TX === 'true') {
    return true;
  }
  const descriptionType = conn?.client?.topology?.description?.type || '';
  if (descriptionType.toLowerCase().includes('replicaset')) {
    return true;
  }
  if (typeof conn?.client?.topology?.hasReplicaSet === 'function') {
    return Boolean(conn.client.topology.hasReplicaSet());
  }
  return false;
};

/**
 * Executes a transactional database workflow with strictly isolated post-commit side effects.
 *
 * @template T
 * @param {(session: mongoose.ClientSession | null) => Promise<T>} transactionFn
 *   Database operations only. Receives the active ClientSession (or null in standalone mode).
 * @param {(result: T) => Promise<void> | void} [afterCommitFn]
 *   Post-commit side effects. Receives the result of `transactionFn` and executes strictly after commit.
 * @param {Object} [options]
 *   Optional Mongoose/MongoDB transaction options.
 * @param {boolean} [options.rethrowAfterCommitError=false]
 *   Whether to rethrow errors occurring in `afterCommitFn` to caller. Defaults to false.
 * @returns {Promise<T>} Result of `transactionFn`.
 */
const runInTransaction = async (transactionFn, afterCommitFn, options) => {
  if (typeof transactionFn !== 'function') {
    throw new TypeError('runInTransaction requires transactionFn to be a callable function.');
  }

  // Support calling runInTransaction(transactionFn, options) if afterCommitFn is omitted
  let resolvedAfterCommitFn = afterCommitFn;
  let resolvedOptions = options || {};
  if (
    typeof afterCommitFn === 'object' &&
    afterCommitFn !== null &&
    typeof options === 'undefined'
  ) {
    resolvedOptions = afterCommitFn;
    resolvedAfterCommitFn = null;
  }

  const conn = mongoose.connection;
  const isReplicaSet = module.exports.checkIsReplicaSet(conn);

  let txResult;

  if (!isReplicaSet) {
    // Standalone fallback: execute pure DB function without session
    txResult = await transactionFn(null);
  } else {
    // Replica set mode: execute inside session with driver retry handling
    const session = await conn.startSession();
    try {
      await session.withTransaction(async () => {
        txResult = await transactionFn(session);
      }, resolvedOptions);
    } finally {
      await session.endSession();
    }
  }

  // Execute post-commit side effects strictly AFTER successful commit
  if (typeof resolvedAfterCommitFn === 'function') {
    try {
      await resolvedAfterCommitFn(txResult);
    } catch (afterCommitErr) {
      logger.error(
        `[SideEffectFailedAfterCommit] Post-transaction side-effect failed: ${afterCommitErr.message}`,
        {
          error: afterCommitErr.message,
          stack: afterCommitErr.stack,
        }
      );
      if (resolvedOptions.rethrowAfterCommitError) {
        throw afterCommitErr;
      }
    }
  }

  return txResult;
};

module.exports = {
  runInTransaction,
  checkIsReplicaSet,
};
