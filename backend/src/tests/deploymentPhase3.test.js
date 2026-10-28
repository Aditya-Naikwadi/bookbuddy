/**
 * Test Suite: Deployment Phase 3 Verification (Background Jobs)
 *
 * Verifies:
 * - Step 22: Cron worker separation (ENABLE_CRON toggle & initCronJobs gating)
 * - Step 22: Distributed lease locking (acquireLock, releaseLock, and mutual exclusion)
 * - Step 22: Concurrency protection (simulated multi-instance runJob race)
 * - Step 23: Job idempotency (runOverdueFineAccrual, runDueReminders, runRegistrationCleanup)
 * - Step 24: Timezone-aware cron configuration
 */

const mongoose = require('mongoose');
const config = require('../config');
const CronJobLock = require('../models/CronJobLock');
const CronRunLog = require('../models/CronRunLog');
const College = require('../models/College');
const User = require('../models/User');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Fine = require('../models/Fine');
const Notification = require('../models/Notification');
const RegistrationRequest = require('../models/RegistrationRequest');
const { acquireLock, releaseLock } = require('../utils/distributedLock');
const {
  initCronJobs,
  stopCronJobs,
  runJob,
  runOverdueFineAccrual,
  runDueReminders,
  runRegistrationCleanup,
} = require('../services/cronService');

describe('Deployment Phase 3: Background Jobs', () => {
  let collegeA;
  let studentA;
  let bookA;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterEach(() => {
    stopCronJobs();
  });

  beforeEach(async () => {
    stopCronJobs();
    await College.deleteMany({});
    await User.deleteMany({});
    await Book.deleteMany({});
    await Loan.deleteMany({});
    await Fine.deleteMany({});
    await Notification.deleteMany({});
    await CronJobLock.deleteMany({});
    await CronRunLog.deleteMany({});
    await RegistrationRequest.deleteMany({});

    collegeA = await College.create({ name: 'Phase3 College', code: 'P3C' });
    studentA = await User.create({
      studentId: 'STU_P3_01',
      name: 'Phase 3 Student',
      email: 'student.p3@test.com',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeA._id,
    });
    bookA = await Book.create({
      collegeId: collegeA._id,
      isbn: '978-0000000088',
      title: 'Distributed Systems in Practice',
      author: 'Author P3',
      category: 'Computer Science',
      copiesTotal: 5,
      copiesAvailable: 5,
    });
  });

  afterAll(async () => {
    stopCronJobs();
    await CronJobLock.deleteMany({});
    await CronRunLog.deleteMany({});
  });

  describe('Step 22: ENABLE_CRON Toggle & Initialization', () => {
    it('should disable cron job registration when config.enableCron is false unless forced', () => {
      const originalEnableCron = config.enableCron;
      try {
        config.enableCron = false;
        // Without force flag
        const resultDisabled = initCronJobs(false);
        expect(resultDisabled).toBe(false);

        // With force flag
        const resultForced = initCronJobs(true);
        expect(resultForced).toBe(true);
      } finally {
        config.enableCron = originalEnableCron;
      }
    });

    it('should initialize cron jobs normally when config.enableCron is true', () => {
      const originalEnableCron = config.enableCron;
      try {
        config.enableCron = true;
        const result = initCronJobs();
        expect(result).toBe(true);
      } finally {
        config.enableCron = originalEnableCron;
      }
    });
  });

  describe('Step 22: Distributed Locking (acquireLock & releaseLock)', () => {
    it('should acquire lock when available and reject concurrent acquisition', async () => {
      const resource = 'test_resource_exclusive';
      const lock1 = await acquireLock(resource, 60);
      expect(lock1.acquired).toBe(true);
      expect(lock1.lockToken).toBeDefined();

      // Second worker attempting to acquire the same resource concurrently
      const lock2 = await acquireLock(resource, 60);
      expect(lock2.acquired).toBe(false);
      expect(lock2.lockToken).toBeNull();

      // Release first lock
      await releaseLock(resource, lock1.lockToken, lock1.provider, lock1.lockKey);

      // Third worker should now be able to acquire
      const lock3 = await acquireLock(resource, 60);
      expect(lock3.acquired).toBe(true);
      await releaseLock(resource, lock3.lockToken, lock3.provider, lock3.lockKey);
    });

    it('should acquire lease if previous lock document has expired', async () => {
      const resource = 'test_expired_lease';
      const pastDate = new Date(Date.now() - 5000);

      // Seed an expired MongoDB lock directly
      await CronJobLock.create({
        jobName: resource,
        lockedBy: 'stale_worker:1234:abcdef',
        lockedAt: new Date(Date.now() - 60000),
        expiresAt: pastDate,
      });

      // New worker tries to acquire
      const newLock = await acquireLock(resource, 60);
      expect(newLock.acquired).toBe(true);
      expect(newLock.lockToken).toBeDefined();

      await releaseLock(resource, newLock.lockToken, newLock.provider, newLock.lockKey);
    });
  });

  describe('Step 22: Simulated Multi-Worker Concurrency on runJob', () => {
    it('should allow only one concurrent worker to execute the job and record one log', async () => {
      let executionCount = 0;
      const jobFn = async () => {
        executionCount += 1;
        // Simulate small asynchronous processing time
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 1;
      };

      // Two workers fire runJob at the exact same millisecond
      await Promise.all([
        runJob('Concurrent Workstation Sweep', jobFn, 30),
        runJob('Concurrent Workstation Sweep', jobFn, 30),
      ]);

      // Exactly one must have executed the job function
      expect(executionCount).toBe(1);

      // Verify that exactly 1 successful CronRunLog was created
      const logs = await CronRunLog.find({ jobName: 'Concurrent Workstation Sweep' });
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('success');
      expect(logs[0].affectedCount).toBe(1);
    });
  });

  describe('Step 23: Idempotency of Daily Jobs', () => {
    it('runOverdueFineAccrual should recalculate fines but NOT send duplicate notifications on the same day', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const loan = await Loan.create({
        collegeId: collegeA._id,
        userId: studentA._id,
        bookId: bookA._id,
        status: 'active',
        issueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        dueDate: twoDaysAgo,
        issuedBy: studentA._id,
        maxRenewals: 2,
      });

      // First run: Creates fine, notifies patron
      const affected1 = await runOverdueFineAccrual();
      expect(affected1).toBe(1);

      const fines1 = await Fine.find({ loanId: loan._id });
      expect(fines1.length).toBe(1);
      expect(fines1[0].lastNotifiedAt).toBeDefined();

      const notifications1 = await Notification.find({ userId: studentA._id });
      expect(notifications1.length).toBe(1);

      // Second run on the same day: recalculates fine, but must NOT send duplicate notification
      const affected2 = await runOverdueFineAccrual();
      expect(affected2).toBe(1);

      const fines2 = await Fine.find({ loanId: loan._id });
      expect(fines2.length).toBe(1);

      const notifications2 = await Notification.find({ userId: studentA._id });
      expect(notifications2.length).toBe(1); // Still exactly 1 notification!
    });

    it('runDueReminders should send reminder once and ignore re-runs on the same day', async () => {
      const daysOut = config.dueReminderDaysBefore;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + daysOut);
      dueDate.setHours(12, 0, 0, 0);

      const loan = await Loan.create({
        collegeId: collegeA._id,
        userId: studentA._id,
        bookId: bookA._id,
        status: 'active',
        issueDate: new Date(),
        dueDate,
        issuedBy: studentA._id,
        maxRenewals: 2,
      });

      // First run: sends reminder
      const affected1 = await runDueReminders();
      expect(affected1).toBe(1);

      const updatedLoan = await Loan.findById(loan._id);
      expect(updatedLoan.lastReminderSentAt).toBeDefined();

      const notifications1 = await Notification.find({ userId: studentA._id });
      expect(notifications1.length).toBe(1);

      // Second run on the same day: loan already has lastReminderSentAt today, so 0 affected
      const affected2 = await runDueReminders();
      expect(affected2).toBe(0);

      const notifications2 = await Notification.find({ userId: studentA._id });
      expect(notifications2.length).toBe(1); // Still exactly 1 reminder!
    });

    it('runRegistrationCleanup should prune unverified registrations older than 7 days idempotently', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

      // Seed 1 stale registration request and 1 recent request
      await RegistrationRequest.create({
        type: 'student_registration',
        studentData: {
          collegeId: collegeA._id,
          studentId: 'STU_OLD',
          name: 'Stale Student',
          email: 'stale@test.com',
        },
        status: 'unverified',
        createdAt: eightDaysAgo,
      });

      await RegistrationRequest.create({
        type: 'student_registration',
        studentData: {
          collegeId: collegeA._id,
          studentId: 'STU_RECENT',
          name: 'Recent Student',
          email: 'recent@test.com',
        },
        status: 'unverified',
        createdAt: oneDayAgo,
      });

      // First cleanup run: prunes the 8-day-old request
      const deleted1 = await runRegistrationCleanup();
      expect(deleted1).toBe(1);

      const remaining = await RegistrationRequest.find({});
      expect(remaining.length).toBe(1);
      expect(remaining[0].studentData.studentId).toBe('stu_recent');

      // Second run: no more stale records, prunes 0
      const deleted2 = await runRegistrationCleanup();
      expect(deleted2).toBe(0);
    });
  });

  describe('Step 24: Timezone-Aware Cron Configuration', () => {
    it('should expose timezoneAwareCronEnabled configuration flag', () => {
      expect(typeof config.timezoneAwareCronEnabled).toBe('boolean');
    });
  });
});
