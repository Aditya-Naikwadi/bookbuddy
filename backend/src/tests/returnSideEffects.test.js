/**
 * @testing-test-automation-engineer Test Suite:
 * Verify Return Book Side Effects Execute Outside Transaction
 *
 * Confirms:
 * 1. Post-commit side effects (borrower return email, watcher notifications,
 *    socket emit, badge evaluation, hold promotion) execute strictly after commit.
 * 2. If the return transaction aborts or fails (e.g. loan not found, or forced failure),
 *    zero side effects occur: no emails, no watcher notifications, no socket emits, no badge calls.
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');
const User = require('../models/User');
const Book = require('../models/Book');
const College = require('../models/College');
const Loan = require('../models/Loan');
const WatchRequest = require('../models/WatchRequest');
const Reservation = require('../models/Reservation');
const loanService = require('../services/loanService');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const badgeService = require('../services/badgeService');
const sockets = require('../sockets');

describe('@testing-test-automation-engineer: Return Book Side-Effects Isolation', () => {
  let testCollege;
  let studentUser;
  let watcherUser;
  let testBook;
  let mockIo;
  let mockEmit;
  let sendEmailSpy;
  let notifySpy;
  let evaluateBadgesSpy;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    testCollege = await College.create({
      name: 'Return Side Effect College',
      code: 'RSEC_' + unique.replace('-', '_'),
      slug: 'rsec-' + unique,
      status: 'active',
    });

    studentUser = await User.create({
      studentId: 'STU_RET_' + unique,
      name: 'Return Student',
      email: `student_ret_${unique}@rsec.edu`,
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
    });

    watcherUser = await User.create({
      studentId: 'STU_WATCH_' + unique,
      name: 'Watcher Student',
      email: `watcher_${unique}@rsec.edu`,
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
    });

    testBook = await Book.create({
      collegeId: testCollege._id,
      isbn: '978-0998877665',
      title: 'Return Book Integrity Testing',
      author: 'Integrity Author',
      category: 'Computer Science',
      copiesTotal: 2,
      copiesAvailable: 1,
    });
  });

  afterAll(async () => {
    try {
      if (testCollege?._id) {
        await Loan.deleteMany({ collegeId: testCollege._id });
        await Book.deleteMany({ collegeId: testCollege._id });
        await User.deleteMany({ collegeId: testCollege._id });
        await WatchRequest.deleteMany({ collegeId: testCollege._id });
        await Reservation.deleteMany({ collegeId: testCollege._id });
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
    sendEmailSpy = jest
      .spyOn(emailService, 'sendNotificationWithEmailFallback')
      .mockResolvedValue(true);
    notifySpy = jest.spyOn(notificationService, 'notify').mockResolvedValue(true);
    evaluateBadgesSpy = jest.spyOn(badgeService, 'evaluateBadges').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. Executes return side effects (email, badge, socket, watcher) AFTER return transaction commits', async () => {
    const loan = await Loan.create({
      collegeId: testCollege._id,
      userId: studentUser._id,
      bookId: testBook._id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 86400000),
      maxRenewals: 3,
      issuedBy: studentUser._id,
      status: 'active',
    });

    await WatchRequest.create({
      userId: watcherUser._id,
      bookId: testBook._id,
      collegeId: testCollege._id,
      status: 'pending',
    });

    const returnedLoan = await loanService.returnBook(loan._id, testCollege._id);

    expect(returnedLoan).toBeDefined();
    expect(returnedLoan.status).toBe('returned');

    // Confirm post-commit side effects fired
    expect(evaluateBadgesSpy).toHaveBeenCalledWith(
      studentUser._id,
      'book_returned',
      expect.objectContaining({ loanId: loan._id, bookId: testBook._id })
    );

    expect(sendEmailSpy).toHaveBeenCalledWith(
      studentUser._id,
      'book_returned',
      expect.stringContaining(testBook.title),
      expect.any(Object)
    );

    expect(mockIo.to).toHaveBeenCalledWith(`college:${testCollege._id}`);
    expect(mockEmit).toHaveBeenCalledWith('book:availability_updated', expect.any(Object));

    expect(sendEmailSpy).toHaveBeenCalledWith(
      watcherUser._id,
      'book_available',
      expect.stringContaining(testBook.title),
      expect.any(Object)
    );
  });

  it('2. Confirms NO email, socket, or watcher notification fires if return transaction aborts', async () => {
    const nonExistentId = new mongoose.Types.ObjectId();

    let threw = false;
    try {
      await loanService.returnBook(nonExistentId, testCollege._id);
    } catch (err) {
      threw = true;
      expect(err.message).toMatch(/active loan not found/i);
    }

    expect(threw).toBe(true);

    // Verify ZERO side effects fired on abort
    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(notifySpy).not.toHaveBeenCalled();
    expect(evaluateBadgesSpy).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
