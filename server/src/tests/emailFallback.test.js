const mongoose = require('mongoose');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const { returnBook } = require('../services/loanService');
const { sendNotificationWithEmailFallback } = require('../services/emailService');
const mailer = require('../utils/mailer');

describe('Email Fallback via Nodemailer for Offline Users', () => {
  let college;
  let offlineUser;
  let book;
  let loan;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri =
        process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_email_fallback_test';
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
      });
    }

    await College.deleteMany({});
    await User.deleteMany({});
    await Book.deleteMany({});
    await Loan.deleteMany({});

    college = await College.create({ name: 'Email Test College', code: 'ETC' });
    offlineUser = await User.create({
      studentId: 'OFFLINE_001',
      name: 'Offline User',
      email: 'offline.user@test.com',
      password: 'password123',
      role: 'student',
      collegeId: college._id,
    });
    book = await Book.create({
      collegeId: college._id,
      isbn: '978-5555555555',
      title: 'Email Fallback Testing Book',
      author: 'Email Author',
      category: 'Science',
      copiesTotal: 1,
      copiesAvailable: 0,
    });
    loan = await Loan.create({
      collegeId: college._id,
      userId: offlineUser._id,
      bookId: book._id,
      issuedBy: offlineUser._id,
      maxRenewals: 2,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'active',
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Loan.deleteMany({});
      await Book.deleteMany({});
      await User.deleteMany({});
      await College.deleteMany({});
    }
  });

  test('sendNotificationWithEmailFallback dispatches email when user has no active socket', async () => {
    const queueEmailSpy = jest.spyOn(mailer, 'queueEmail');

    const result = await sendNotificationWithEmailFallback(
      offlineUser._id,
      'book_returned',
      'Your borrowed book was returned.',
      { subject: 'Book Return Test' }
    );

    expect(result.online).toBe(false);
    expect(result.emailSent).toBe(true);
    expect(queueEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'offline.user@test.com',
        subject: 'Book Return Test',
      })
    );

    queueEmailSpy.mockRestore();
  });

  test('Acceptance Criteria: Simulating an offline user (no active socket) at the moment of book return results in an email being sent', async () => {
    const queueEmailSpy = jest.spyOn(mailer, 'queueEmail');

    const returnedLoan = await returnBook(loan._id, college._id);
    expect(returnedLoan.status).toBe('returned');

    // Verify email was dispatched to the offline user for book return
    expect(queueEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'offline.user@test.com',
        subject: expect.stringContaining('Book Return Confirmation'),
      })
    );

    queueEmailSpy.mockRestore();
  });
});
