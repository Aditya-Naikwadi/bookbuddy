/**
 * @testing-test-automation-engineer Test Suite:
 * Shared Transaction & Side-Effect Isolation Helper Unit Tests
 */

process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const { runInTransaction } = require('../utils/transactionHelper');
const logger = require('../utils/logger');

describe('transactionHelper.runInTransaction Unit Tests', () => {
  let loggerErrorSpy;

  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Standalone / Direct Mode (Fallback)', () => {
    beforeEach(() => {
      process.env.FORCE_STANDALONE_TX = 'true';
      delete process.env.FORCE_REPLICASET_TX;
    });

    afterEach(() => {
      delete process.env.FORCE_STANDALONE_TX;
    });

    it('1. executes transactionFn and passes result to afterCommitFn on success', async () => {
      const transactionFn = jest.fn().mockResolvedValue({ id: 'loan_123', status: 'active' });
      const afterCommitFn = jest.fn().mockResolvedValue(undefined);

      const result = await runInTransaction(transactionFn, afterCommitFn);

      expect(transactionFn).toHaveBeenCalledWith(null);
      expect(afterCommitFn).toHaveBeenCalledTimes(1);
      expect(afterCommitFn).toHaveBeenCalledWith({ id: 'loan_123', status: 'active' });
      expect(result).toEqual({ id: 'loan_123', status: 'active' });
    });

    it('2. does NOT execute afterCommitFn if transactionFn throws', async () => {
      const transactionFn = jest.fn().mockRejectedValue(new Error('DB Constraint Violation'));
      const afterCommitFn = jest.fn();

      await expect(runInTransaction(transactionFn, afterCommitFn)).rejects.toThrow(
        'DB Constraint Violation'
      );

      expect(transactionFn).toHaveBeenCalledTimes(1);
      expect(afterCommitFn).not.toHaveBeenCalled();
    });

    it('3. catches and logs errors in afterCommitFn without failing the transaction response by default', async () => {
      const transactionFn = jest.fn().mockResolvedValue({ id: 'booking_456' });
      const afterCommitFn = jest.fn().mockRejectedValue(new Error('Socket Gateway Down'));

      const result = await runInTransaction(transactionFn, afterCommitFn);

      expect(result).toEqual({ id: 'booking_456' });
      expect(afterCommitFn).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[SideEffectFailedAfterCommit] Post-transaction side-effect failed: Socket Gateway Down'
        ),
        expect.any(Object)
      );
    });

    it('4. rethrows afterCommitFn error if options.rethrowAfterCommitError is true', async () => {
      const transactionFn = jest.fn().mockResolvedValue({ id: 'user_789' });
      const afterCommitFn = jest.fn().mockRejectedValue(new Error('Mandatory Webhook Failed'));

      await expect(
        runInTransaction(transactionFn, afterCommitFn, { rethrowAfterCommitError: true })
      ).rejects.toThrow('Mandatory Webhook Failed');

      expect(transactionFn).toHaveBeenCalledTimes(1);
      expect(afterCommitFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session / ReplicaSet Mode (withTransaction & Retries)', () => {
    let mockSession;
    let startSessionSpy;

    beforeEach(() => {
      delete process.env.FORCE_STANDALONE_TX;
      process.env.FORCE_REPLICASET_TX = 'true';

      mockSession = {
        withTransaction: jest.fn(async (cb) => {
          return await cb();
        }),
        endSession: jest.fn().mockResolvedValue(undefined),
      };

      startSessionSpy = jest
        .spyOn(mongoose.connection, 'startSession')
        .mockResolvedValue(mockSession);
    });

    afterEach(() => {
      delete process.env.FORCE_REPLICASET_TX;
      jest.restoreAllMocks();
    });

    it('5. starts session, runs withTransaction, and calls afterCommitFn after commit completes', async () => {
      const transactionFn = jest.fn().mockResolvedValue({ success: true, count: 5 });
      const afterCommitFn = jest.fn().mockResolvedValue(undefined);

      const result = await runInTransaction(transactionFn, afterCommitFn);

      expect(startSessionSpy).toHaveBeenCalledTimes(1);
      expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
      expect(transactionFn).toHaveBeenCalledWith(mockSession);
      expect(afterCommitFn).toHaveBeenCalledWith({ success: true, count: 5 });
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true, count: 5 });
    });

    it('6. does NOT fire afterCommitFn if withTransaction aborts or throws', async () => {
      mockSession.withTransaction.mockRejectedValueOnce(new Error('Transaction Aborted'));

      const transactionFn = jest.fn();
      const afterCommitFn = jest.fn();

      await expect(runInTransaction(transactionFn, afterCommitFn)).rejects.toThrow(
        'Transaction Aborted'
      );

      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
      expect(afterCommitFn).not.toHaveBeenCalled();
    });

    it('7. fires afterCommitFn EXACTLY ONCE even under transient error retries', async () => {
      let attempts = 0;
      // Simulate MongoDB driver retry loop: withTransaction retries callback on TransientTransactionError
      mockSession.withTransaction.mockImplementationOnce(async (cb) => {
        // Attempt 1: TransientTransactionError simulates write conflict
        attempts++;
        try {
          await cb();
        } catch {
          // driver catches transient error and retries
        }

        // Attempt 2: Success
        attempts++;
        return await cb();
      });

      let fnExecutions = 0;
      const transactionFn = jest.fn(async (_session) => {
        fnExecutions++;
        if (fnExecutions === 1) {
          const err = new Error('WriteConflict');
          err.errorLabels = ['TransientTransactionError'];
          throw err;
        }
        return { finalAttempt: true, executionCount: fnExecutions };
      });

      const afterCommitFn = jest.fn().mockResolvedValue(undefined);

      const result = await runInTransaction(transactionFn, afterCommitFn);

      // transactionFn executed twice due to internal retry
      expect(transactionFn).toHaveBeenCalledTimes(2);
      expect(attempts).toBe(2);

      // afterCommitFn must execute EXACTLY ONCE on the final committed result
      expect(afterCommitFn).toHaveBeenCalledTimes(1);
      expect(afterCommitFn).toHaveBeenCalledWith({ finalAttempt: true, executionCount: 2 });
      expect(result).toEqual({ finalAttempt: true, executionCount: 2 });
    });
  });
});
