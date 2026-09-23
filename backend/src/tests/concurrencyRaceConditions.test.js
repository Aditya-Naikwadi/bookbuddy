/**
 * @testing-performance-benchmarker & @security-appsec-engineer Test Suite:
 * Concurrency Race Condition Invariants & Stress Testing
 *
 * Verifies that under concurrent parallel requests, the invariants hold:
 * 1. RSVP Capacity: Event with maxCapacity=3 under 10 concurrent RSVPs accepts exactly 3, rejects 7, zero overshoot.
 * 2. Fine Double-Payment: 10 concurrent payment requests for one unpaid fine process exactly once, 9 rejected.
 * 3. Waiver Over-Redemption: User with 1 waiver coupon under concurrent waiver requests spends exactly 1, coupon never negative.
 * 4. Book Copies Ceiling: Concurrent returns never increment copiesAvailable beyond copiesTotal.
 * 5. Streak Freeze Consumption: User with 1 freeze under 5 concurrent repairs uses exactly 1, 4 rejected.
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');
const User = require('../models/User');
const College = require('../models/College');
const Fine = require('../models/Fine');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Streak = require('../models/Streak');
const Announcement = require('../models/Announcement');

const announcementController = require('../controllers/announcementController');
const fineService = require('../services/fineService');
const loanService = require('../services/loanService');
const streakService = require('../services/streakService');
const sockets = require('../sockets');

describe('Concurrency Race Condition Invariants Test Suite', () => {
  let testCollege;
  let adminUser;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    testCollege = await College.create({
      name: 'Concurrency Test College',
      code: 'CTC_' + unique.replace('-', '_'),
      slug: 'ctc-' + unique,
      status: 'active',
    });

    adminUser = await User.create({
      studentId: 'ADM_' + unique,
      name: 'Admin Test',
      email: `admin_${unique}@ctc.edu`,
      password: 'Password123!',
      role: 'college-admin',
      collegeId: testCollege._id,
      status: 'active',
    });

    jest.spyOn(sockets, 'emitStreakUpdate').mockImplementation(() => {});
  });

  afterAll(async () => {
    try {
      if (testCollege?._id) {
        await User.deleteMany({ collegeId: testCollege._id });
        await College.deleteMany({ _id: testCollege._id });
      }
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. [RSVP Capacity] 10 concurrent RSVPs for maxCapacity=3: exactly 3 succeed, 7 rejected, final count === 3', async () => {
    const event = await Announcement.create({
      title: 'High-Concurrency Tech Workshop',
      content: 'Hands-on system design event.',
      category: 'Event',
      isEvent: true,
      collegeId: testCollege._id,
      maxCapacity: 3,
      rsvpUsers: [],
      createdBy: adminUser._id,
    });

    // Create 10 distinct student users
    const studentUsers = await Promise.all(
      Array.from({ length: 10 }).map((_, i) =>
        User.create({
          studentId: `STU_RSVP_${Date.now()}_${i}`,
          name: `RSVP Student ${i}`,
          email: `rsvp_${Date.now()}_${i}@ctc.edu`,
          password: 'Password123!',
          role: 'student',
          collegeId: testCollege._id,
          status: 'active',
        })
      )
    );

    // Fire 10 simultaneous RSVP requests
    const rsvpPromises = studentUsers.map((user) => {
      const req = {
        params: { id: event._id.toString() },
        user: { id: user._id, _id: user._id, collegeId: testCollege._id },
        query: {},
      };
      let resJson = null;
      let statusCode = 200;
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (data) => {
          resJson = data;
          return res;
        },
      };

      return announcementController
        .toggleRSVP(req, res)
        .then(() => ({ success: true, user: user._id, data: resJson }))
        .catch((err) => ({
          success: false,
          user: user._id,
          error: err.message,
          statusCode: err.statusCode || 400,
        }));
    });

    const results = await Promise.all(rsvpPromises);

    const succeeded = results.filter((r) => r.success);
    const rejected = results.filter((r) => !r.success);

    expect(succeeded.length).toBe(3);
    expect(rejected.length).toBe(7);

    // Verify rejection messages
    rejected.forEach((rej) => {
      expect(rej.error).toMatch(/maximum capacity/i);
    });

    // Check database state
    const reloaded = await Announcement.findById(event._id);
    expect(reloaded.rsvpUsers.length).toBe(3);

    // Cleanup
    await Announcement.deleteMany({ _id: event._id });
    await User.deleteMany({ _id: { $in: studentUsers.map((u) => u._id) } });
  });

  it('2. [Fine Double-Payment] 10 concurrent payFine requests: exactly 1 succeeds, 9 fail with already paid', async () => {
    const student = await User.create({
      studentId: `STU_PAY_${Date.now()}`,
      name: 'Fine Payer',
      email: `fine_payer_${Date.now()}@ctc.edu`,
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
    });

    const fine = await Fine.create({
      collegeId: testCollege._id,
      userId: student._id,
      loanId: new mongoose.Types.ObjectId(),
      overdueDays: 5,
      amount: 150,
      reason: 'Late return',
      status: 'unpaid',
    });

    // Fire 10 simultaneous payFine calls for the same fine
    const payPromises = Array.from({ length: 10 }).map(() =>
      fineService
        .payFine(fine._id, student._id, testCollege._id, false)
        .then((res) => ({ success: true, data: res }))
        .catch((err) => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(payPromises);

    const succeeded = results.filter((r) => r.success);
    const rejected = results.filter((r) => !r.success);

    expect(succeeded.length).toBe(1);
    expect(rejected.length).toBe(9);

    rejected.forEach((rej) => {
      expect(rej.error).toMatch(/already paid or waived/i);
    });

    // Database verification
    const reloadedFine = await Fine.findById(fine._id);
    expect(reloadedFine.status).toBe('paid');
    expect(reloadedFine.paidAt).toBeDefined();

    // Cleanup
    await Fine.deleteMany({ _id: fine._id });
    await User.deleteMany({ _id: student._id });
  });

  it('3. [Coupon Waiver Over-Redemption] 1 waiver coupon under concurrent requests: exactly 1 spends coupon', async () => {
    const student = await User.create({
      studentId: `STU_WAIVE_${Date.now()}`,
      name: 'Waiver Student',
      email: `waiver_${Date.now()}@ctc.edu`,
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
      fineWaiverCoupons: 1, // Only 1 coupon available
    });

    const fineA = await Fine.create({
      collegeId: testCollege._id,
      userId: student._id,
      loanId: new mongoose.Types.ObjectId(),
      overdueDays: 3,
      amount: 50,
      reason: 'Overdue A',
      status: 'unpaid',
    });

    const fineB = await Fine.create({
      collegeId: testCollege._id,
      userId: student._id,
      loanId: new mongoose.Types.ObjectId(),
      overdueDays: 3,
      amount: 50,
      reason: 'Overdue B',
      status: 'unpaid',
    });

    // Fire 2 concurrent waiver payments for fineA and fineB
    const [resA, resB] = await Promise.all([
      fineService
        .payFine(fineA._id, student._id, testCollege._id, true)
        .then(() => ({ success: true, fine: 'A' }))
        .catch((err) => ({ success: false, fine: 'A', error: err.message })),
      fineService
        .payFine(fineB._id, student._id, testCollege._id, true)
        .then(() => ({ success: true, fine: 'B' }))
        .catch((err) => ({ success: false, fine: 'B', error: err.message })),
    ]);

    const results = [resA, resB];
    const succeeded = results.filter((r) => r.success);
    const rejected = results.filter((r) => !r.success);

    expect(succeeded.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0].error).toMatch(/no fine waiver coupons available/i);

    // Verify user balance
    const reloadedUser = await User.findById(student._id);
    expect(reloadedUser.fineWaiverCoupons).toBe(0); // Zero, never negative!

    // Cleanup
    await Fine.deleteMany({ _id: { $in: [fineA._id, fineB._id] } });
    await User.deleteMany({ _id: student._id });
  });

  it('4. [Book Return Copies Limit] Concurrent returns never exceed copiesTotal', async () => {
    const book = await Book.create({
      collegeId: testCollege._id,
      isbn: `978-0000000001-${Date.now()}`,
      title: 'Concurrency Book',
      author: 'Concurrency Expert',
      category: 'Computer Science',
      copiesTotal: 2,
      copiesAvailable: 0,
    });

    const studentA = await User.create({
      studentId: `STU_LA_${Date.now()}`,
      name: 'Borrower A',
      email: `borrower_a_${Date.now()}@ctc.edu`,
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
    });

    const studentB = await User.create({
      studentId: `STU_LB_${Date.now()}`,
      name: 'Borrower B',
      email: `borrower_b_${Date.now()}@ctc.edu`,
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
    });

    const loanA = await Loan.create({
      collegeId: testCollege._id,
      userId: studentA._id,
      bookId: book._id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 86400000),
      maxRenewals: 3,
      status: 'active',
      issuedBy: adminUser._id,
    });

    const loanB = await Loan.create({
      collegeId: testCollege._id,
      userId: studentB._id,
      bookId: book._id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 86400000),
      maxRenewals: 3,
      status: 'active',
      issuedBy: adminUser._id,
    });

    // Fire 2 concurrent return requests
    await Promise.all([
      loanService.returnBook(loanA._id, testCollege._id),
      loanService.returnBook(loanB._id, testCollege._id),
    ]);

    const reloadedBook = await Book.findById(book._id);
    expect(reloadedBook.copiesAvailable).toBe(2);
    expect(reloadedBook.copiesAvailable).toBeLessThanOrEqual(reloadedBook.copiesTotal);

    // Cleanup
    await Loan.deleteMany({ _id: { $in: [loanA._id, loanB._id] } });
    await Book.deleteMany({ _id: book._id });
    await User.deleteMany({ _id: { $in: [studentA._id, studentB._id] } });
  });

  it('5. [Streak Freeze Repair] 5 concurrent repair requests with freezesAvailable=1: exactly 1 succeeds, 4 fail', async () => {
    const student = await User.create({
      studentId: `STU_STR_${Date.now()}`,
      name: 'Streak Repairer',
      email: `streak_rep_${Date.now()}@ctc.edu`,
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
    });

    await Streak.create({
      userId: student._id,
      collegeId: testCollege._id,
      currentStreak: 0,
      maxStreak: 5,
      freezesAvailable: 1, // Only 1 freeze available
      timezone: 'Asia/Kolkata',
    });

    // Fire 5 concurrent repair requests
    const repairPromises = Array.from({ length: 5 }).map(() =>
      streakService
        .useStreakRepair(student._id)
        .then((res) => ({ success: true, data: res }))
        .catch((err) => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(repairPromises);

    const succeeded = results.filter((r) => r.success);
    const rejected = results.filter((r) => !r.success);

    expect(succeeded.length).toBe(1);
    expect(rejected.length).toBe(4);

    rejected.forEach((rej) => {
      expect(rej.error).toMatch(/no freezes available/i);
    });

    const reloadedStreak = await Streak.findOne({ userId: student._id });
    expect(reloadedStreak.freezesAvailable).toBe(0); // Zero, never negative!
    expect(reloadedStreak.currentStreak).toBe(5); // Restored to maxStreak

    // Cleanup
    await Streak.deleteMany({ userId: student._id });
    await User.deleteMany({ _id: student._id });
  });
});
