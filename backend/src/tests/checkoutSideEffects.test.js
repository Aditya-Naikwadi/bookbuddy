/**
 * @testing-test-automation-engineer Test Suite:
 * Verify Checkout Side Effects Execute Outside Transaction
 *
 * Confirms:
 * 1. Side effects (streakService.recordQualifyingAction, badge evaluation, Socket.IO emit)
 *    execute after runInTransaction resolves successfully.
 * 2. If the checkout transaction aborts / encounters a failure, zero side effects occur:
 *    no streak record is written and no socket availability event is emitted.
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');
const User = require('../models/User');
const Book = require('../models/Book');
const College = require('../models/College');
const Loan = require('../models/Loan');
const loanService = require('../services/loanService');
const streakService = require('../services/streakService');
const sockets = require('../sockets');

describe('@testing-test-automation-engineer: Checkout Transaction Side-Effects Isolation', () => {
  let testCollege;
  let studentUser;
  let adminUser;
  let testBook;
  let mockIo;
  let mockEmit;
  let recordStreakSpy;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    testCollege = await College.create({
      name: 'Transaction Side Effect College',
      code: 'TSEC_' + unique.replace('-', '_'),
      slug: 'tsec-' + unique,
      status: 'active',
    });

    studentUser = await User.create({
      studentId: 'STU_TX_' + unique,
      name: 'Transaction Test Student',
      email: `student_${unique}@tsec.edu`,
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
    });

    adminUser = await User.create({
      name: 'Transaction Admin',
      email: `admin_${unique}@tsec.edu`,
      password: 'Password123!',
      role: 'college-admin',
      collegeId: testCollege._id,
      status: 'active',
    });

    testBook = await Book.create({
      collegeId: testCollege._id,
      isbn: '978-0112233445',
      title: 'Transactional Integrity in Systems',
      author: 'Distributed Systems Author',
      category: 'Computer Science',
      copiesTotal: 5,
      copiesAvailable: 5,
    });
  });

  afterAll(async () => {
    try {
      if (testCollege?._id) {
        await Loan.deleteMany({ collegeId: testCollege._id });
        await Book.deleteMany({ collegeId: testCollege._id });
        await User.deleteMany({ collegeId: testCollege._id });
        await College.deleteMany({ _id: testCollege._id });
      }
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore cleanup errors
    }
  });

  beforeEach(() => {
    mockEmit = jest.fn();
    mockIo = {
      to: jest.fn().mockReturnValue({ emit: mockEmit }),
    };
    jest.spyOn(sockets, 'getIo').mockReturnValue(mockIo);
    recordStreakSpy = jest.spyOn(streakService, 'recordQualifyingAction').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. Executes streak recording and Socket.IO broadcast AFTER checkout transaction succeeds', async () => {
    const loan = await loanService.checkoutBook(
      studentUser._id,
      testBook._id,
      testCollege._id,
      adminUser._id
    );

    expect(loan).toBeDefined();
    expect(loan.status).toBe('active');

    // Confirm side effects executed
    expect(recordStreakSpy).toHaveBeenCalledTimes(1);
    expect(recordStreakSpy).toHaveBeenCalledWith(studentUser._id, testCollege._id, 'checkout');

    expect(mockIo.to).toHaveBeenCalledWith(`college:${testCollege._id}`);
    expect(mockEmit).toHaveBeenCalledWith('book:availability_updated', {
      bookId: testBook._id,
      availableCopies: 4,
    });
  });

  it('2. Confirms NO broadcast and NO streak record occurs if the transaction aborts', async () => {
    // Attempting to check out the same book again while an active loan already exists
    // will trigger an error inside the transaction, aborting it
    let threwError = false;
    try {
      await loanService.checkoutBook(studentUser._id, testBook._id, testCollege._id, adminUser._id);
    } catch (err) {
      threwError = true;
      expect(err.message).toMatch(/active loan/i);
    }

    expect(threwError).toBe(true);

    // Assert that NO side effects executed during or after the aborted transaction
    expect(recordStreakSpy).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('3. Confirms NO broadcast or streak occurs if Loan creation fails in transaction', async () => {
    // Create a new book for this test
    const anotherBook = await Book.create({
      collegeId: testCollege._id,
      isbn: '978-0998877665',
      title: 'Rollback Book Test',
      author: 'Rollback Author',
      category: 'Science',
      copiesTotal: 2,
      copiesAvailable: 2,
    });

    // Mock Loan.create inside transaction to simulate a database constraint/insert failure
    const loanCreateSpy = jest
      .spyOn(Loan, 'create')
      .mockRejectedValueOnce(new Error('Simulated Database Write Failure'));

    let threwError = false;
    try {
      await loanService.checkoutBook(
        studentUser._id,
        anotherBook._id,
        testCollege._id,
        adminUser._id
      );
    } catch (err) {
      threwError = true;
      expect(err.message).toBe('Simulated Database Write Failure');
    }

    expect(threwError).toBe(true);

    // Book copies must have been rolled back
    const refreshedBook = await Book.findById(anotherBook._id);
    expect(refreshedBook.copiesAvailable).toBe(2);

    // Side effects must NOT have been called
    expect(recordStreakSpy).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();

    loanCreateSpy.mockRestore();
  });
});
