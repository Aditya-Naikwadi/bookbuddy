const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const Book = require('../models/Book');
const User = require('../models/User');
const College = require('../models/College');
const Fine = require('../models/Fine');
const Reservation = require('../models/Reservation');
const Streak = require('../models/Streak');
const Notification = require('../models/Notification');
const CronRunLog = require('../models/CronRunLog');
const config = require('../config');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_cron_test';
jest.setTimeout(30000);

const {
  runJob,
  runOverdueFineAccrual,
  runQueueExpirySweep,
  runDueReminders,
  runStreakExpirySweep,
  runStreakReminders,
} = require('../services/cronService');

describe('Phase 6 — Background Cron Jobs Integration Tests', () => {
  let collegeA;
  let studentA;
  let studentB;
  let bookA;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  beforeEach(async () => {
    await College.deleteMany({});
    await User.deleteMany({});
    await Book.deleteMany({});
    await Loan.deleteMany({});
    await Reservation.deleteMany({});
    await Fine.deleteMany({});
    await Streak.deleteMany({});
    await Notification.deleteMany({});
    await CronRunLog.deleteMany({});

    // Seed base test data
    collegeA = await College.create({ name: 'Cron College', code: 'CRN' });

    studentA = await User.create({
      studentId: 'STU_CRN_01',
      name: 'Student A',
      email: 'student.a@cron.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    studentB = await User.create({
      studentId: 'STU_CRN_02',
      name: 'Student B',
      email: 'student.b@cron.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    bookA = await Book.create({
      collegeId: collegeA._id,
      isbn: '978-0000000099',
      title: 'Cron Book A',
      author: 'Author Cron',
      category: 'Tech',
      copiesTotal: 1,
      copiesAvailable: 1,
    });
  });

  afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  // 1. Fine accrual creates exactly one Fine for a newly-overdue loan, and doesn't duplicate
  // 8. Every job writes exactly one CronRunLog entry per invocation
  it('1 & 8. should create exactly one Fine on accrual, not duplicate on repeat runs, and log to CronRunLog', async () => {
    // Create an overdue loan (dueDate is 2 days ago)
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

    // Run fine accrual using the wrapper
    await runJob('Overdue Fine Accrual', runOverdueFineAccrual);

    // Verify exactly one Fine document was created
    const fines = await Fine.find({ loanId: loan._id });
    expect(fines.length).toBe(1);
    expect(fines[0].amount).toBe(2 * config.fineRatePerDay); // 2 days overdue
    expect(fines[0].status).toBe('unpaid');

    // Verify CronRunLog entry
    const runLogs = await CronRunLog.find({ jobName: 'Overdue Fine Accrual' });
    expect(runLogs.length).toBe(1);
    expect(runLogs[0].status).toBe('success');
    expect(runLogs[0].affectedCount).toBe(1);

    // Run again immediately on the same day: should update, NOT create a second Fine
    await runJob('Overdue Fine Accrual', runOverdueFineAccrual);

    const finesAfterSecondRun = await Fine.find({ loanId: loan._id });
    expect(finesAfterSecondRun.length).toBe(1); // Still exactly 1 Fine doc!

    // Verify a second run log entry
    const finalRunLogs = await CronRunLog.find({ jobName: 'Overdue Fine Accrual' });
    expect(finalRunLogs.length).toBe(2);
  });

  // 2. Fine amount respects the configured cap
  it('2. should respect the configured fine cap even across multiple days overdue', async () => {
    // Create a loan overdue by 100 days
    const hundredDaysAgo = new Date();
    hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);

    await Loan.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      bookId: bookA._id,
      status: 'active',
      issueDate: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000),
      dueDate: hundredDaysAgo,
      issuedBy: studentA._id,
      maxRenewals: 2,
    });

    await runOverdueFineAccrual();

    const fine = await Fine.findOne({ userId: studentA._id });
    expect(fine).toBeDefined();
    // Cap is 100, whereas 100 days * 5 = 500. It should be capped at 100.
    expect(fine.amount).toBe(config.fineMaxAmount);
  });

  // 3. Queue expiry correctly expires a stale ready_for_pickup hold AND promotes the next queued reservation atomically (reusing Phase 2 logic)
  it('3. should expire stale pickups and atomically promote the next hold in queue', async () => {
    // 1. Student A has hold ready_for_pickup, readyAt was 3 days ago (stale)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const holdA = await Reservation.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      bookId: bookA._id,
      status: 'ready_for_pickup',
      queuePosition: 1,
      readyAt: threeDaysAgo,
    });

    // 2. Student B has hold queued
    const holdB = await Reservation.create({
      collegeId: collegeA._id,
      userId: studentB._id,
      bookId: bookA._id,
      status: 'queued',
      queuePosition: 2,
    });

    // Run sweep
    const affected = await runQueueExpirySweep();
    expect(affected).toBe(1);

    // Verify holdA expired
    const updatedHoldA = await Reservation.findById(holdA._id);
    expect(updatedHoldA.status).toBe('expired');

    // Verify holdB promoted to ready_for_pickup
    const updatedHoldB = await Reservation.findById(holdB._id);
    expect(updatedHoldB.status).toBe('ready_for_pickup');
    expect(updatedHoldB.readyAt).toBeDefined();

    // Verify Student B was notified
    const notification = await Notification.findOne({ userId: studentB._id, type: 'hold_ready' });
    expect(notification).toBeDefined();
  });

  // 4. Due reminders fire once per qualifying loan and do not double-send on consecutive daily runs
  it('4. should send due reminders once for loans exactly N days out, and not double-send on subsequent daily runs', async () => {
    // Create loan due exactly 2 days out
    const dueTime = new Date();
    dueTime.setDate(dueTime.getDate() + config.dueReminderDaysBefore);
    dueTime.setHours(12, 0, 0, 0); // midday

    await Loan.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      bookId: bookA._id,
      status: 'active',
      issueDate: new Date(),
      dueDate: dueTime,
      issuedBy: studentA._id,
      maxRenewals: 2,
    });

    // First run (should match and send reminder)
    const affected1 = await runDueReminders();
    expect(affected1).toBe(1);

    const reminders1 = await Notification.find({ userId: studentA._id });
    expect(reminders1.length).toBe(1);

    // Run again on the same day (or next tick): should match again since dueDate is still 2 days out,
    // but because the date calculation checks the exact same calendar day, it still sends.
    // Wait, the prompt says "do not double-send on consecutive daily runs".
    // If the next day runs (tomorrow), now is tomorrow, so "due in 2 days" is tomorrow + 2.
    // Our loan's dueDate will now be 1 day out, so it will NOT match the "exactly 2 days out" check on tomorrow's run!
    // Let's simulate tomorrow's run by keeping the loan dueDate the same but shifting the check (mocking now).
    // Or we can mock the loan dueDate as being 1 day out (which simulates running it tomorrow).
    // Let's modify the loan dueDate to be 1 day out:
    const loan = await Loan.findOne({ userId: studentA._id });
    loan.dueDate = new Date(Date.now() + (config.dueReminderDaysBefore - 1) * 24 * 60 * 60 * 1000);
    await loan.save();

    // Run tomorrow's cron (dueDate is 1 day out now, so it should not match the 2-day reminder check)
    const affected2 = await runDueReminders();
    expect(affected2).toBe(0);

    const reminders2 = await Notification.find({ userId: studentA._id });
    expect(reminders2.length).toBe(1); // Still exactly 1 reminder sent across both runs!
  });

  // 5. Streak expiry sweep only resets/freezes users at THEIR local midnight
  it('5. should only reset or freeze users whose timezone is currently at midnight', async () => {
    // Student A: America/New_York. Student B: Asia/Kolkata.
    // Seed streaks
    // We will simulate an hour when it is currently midnight in New York but NOT in Kolkata.
    // America/New_York midnight: hour 00:00.
    // If it is 2026-07-14T04:30:00Z (UTC):
    // - New York (UTC-4/UTC-5): EDT is UTC-4, so it is 00:30 (Midnight hour!).
    // - Kolkata (UTC+5:30): it is 10:00 AM (Not midnight).
    const mockTime = new Date('2026-07-14T04:30:00Z');
    const missedLastAction = new Date(mockTime.getTime() - 3 * 24 * 60 * 60 * 1000);

    const streakA = await Streak.create({
      userId: studentA._id,
      collegeId: collegeA._id,
      currentStreak: 5,
      maxStreak: 5,
      freezesAvailable: 1,
      timezone: 'America/New_York',
      lastQualifyingActionAt: missedLastAction,
    });

    const streakB = await Streak.create({
      userId: studentB._id,
      collegeId: collegeA._id,
      currentStreak: 8,
      maxStreak: 8,
      freezesAvailable: 1,
      timezone: 'Asia/Kolkata',
      lastQualifyingActionAt: missedLastAction,
    });

    // Run the sweep with mockTime
    const affected = await runStreakExpirySweep(mockTime);
    expect(affected).toBe(1); // Only Student A (New York) should be processed

    // Student A should have consumed 1 freeze because they missed yesterday/today
    const updatedStreakA = await Streak.findById(streakA._id);
    expect(updatedStreakA.freezesAvailable).toBe(0);
    expect(updatedStreakA.currentStreak).toBe(5); // Saved by freeze

    // Student B should remain untouched since it is not midnight in Kolkata
    const updatedStreakB = await Streak.findById(streakB._id);
    expect(updatedStreakB.freezesAvailable).toBe(1);
    expect(updatedStreakB.currentStreak).toBe(8);
  });

  // 6. Streak reminder only fires for users with currentStreak > 0 who haven't acted today, and doesn't double-send
  it('6. should send streak warnings 3 hours before local midnight and prevent double-sending', async () => {
    // Simulate 9:00 PM (21:00) in New York (exactly 3 hours before midnight)
    // 21:00 EDT is UTC-4, so UTC time is 01:00 next day (July 14).
    const mockTime = new Date('2026-07-14T01:00:00Z');
    const lastAction = new Date(mockTime.getTime() - 30 * 60 * 60 * 1000);

    const streak = await Streak.create({
      userId: studentA._id,
      collegeId: collegeA._id,
      currentStreak: 3,
      maxStreak: 3,
      freezesAvailable: 1,
      timezone: 'America/New_York',
      lastQualifyingActionAt: lastAction,
    });

    // Run reminder
    const affected1 = await runStreakReminders(mockTime);
    expect(affected1).toBe(1);

    const updatedStreak1 = await Streak.findById(streak._id);
    expect(updatedStreak1.lastStreakReminderSentAt).toBeDefined();

    // Check notification
    const notifications1 = await Notification.find({ userId: studentA._id, type: 'streak_at_risk' });
    expect(notifications1.length).toBe(1);

    // Run again at the same hour: should skip due to todayStr reminder sentinel
    const affected2 = await runStreakReminders(mockTime);
    expect(affected2).toBe(0);

    const notifications2 = await Notification.find({ userId: studentA._id, type: 'streak_at_risk' });
    expect(notifications2.length).toBe(1); // Still only 1
  });

  // 7. FAILURE ISOLATION: force one job to throw and assert CronRunLog failed, process doesn't crash, subsequent jobs succeed
  it('7. should record failure logs, not crash the process, and allow subsequent jobs to succeed on error (Failure Isolation)', async () => {
    // 1. Setup a dummy function that throws an error
    const failingJobFn = async () => {
      throw new Error('Database connection failed');
    };

    // 2. Setup a succeeding job function
    let succeededVal = 0;
    const succeedingJobFn = async () => {
      succeededVal = 42;
      return 5; // affected count
    };

    // 3. Execute failing job using runJob wrapper
    // This should NOT throw or crash the thread, because wrapper catches error
    await expect(runJob('Failing Test Job', failingJobFn)).resolves.not.toThrow();

    // 4. Assert that the failing job logged a 'failed' record with details
    const failedLog = await CronRunLog.findOne({ jobName: 'Failing Test Job' });
    expect(failedLog).toBeDefined();
    expect(failedLog.status).toBe('failed');
    expect(failedLog.errorMessage).toBe('Database connection failed');

    // 5. Execute succeeding job immediately after
    // This asserts subsequent jobs continue to execute perfectly
    await runJob('Succeeding Test Job', succeedingJobFn);
    expect(succeededVal).toBe(42);

    const successLog = await CronRunLog.findOne({ jobName: 'Succeeding Test Job' });
    expect(successLog).toBeDefined();
    expect(successLog.status).toBe('success');
    expect(successLog.affectedCount).toBe(5);
  });
});
