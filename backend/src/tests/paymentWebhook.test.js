const request = require('supertest');
const mongoose = require('mongoose');
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy_test';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret_key_123';
jest.setTimeout(60000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Fine = require('../models/Fine');
const Payment = require('../models/Payment');

describe('Payment Processing & Webhook Signature Idempotency Unit Tests', () => {
  let college;
  let studentUser;
  let book;
  let loan;
  let fine;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await College.deleteMany({ code: 'PAY_TEST_UNI' });
    await User.deleteMany({ email: 'paytest_isolated@bookbuddy.com' });
    await Book.deleteMany({ title: 'Payment Test Book' });
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await College.deleteMany({ code: 'PAY_TEST_UNI' });
    await User.deleteMany({ email: 'paytest_isolated@bookbuddy.com' });
    await Book.deleteMany({ title: 'Payment Test Book' });
    await Loan.deleteMany({});
    await Fine.deleteMany({});
    await Payment.deleteMany({});

    college = await College.create({
      name: 'Payment Test University',
      code: 'PAY_TEST_UNI_' + Math.floor(Math.random() * 10000),
    });

    studentUser = await User.create({
      studentId: 'STU_PAY_' + Math.floor(Math.random() * 10000),
      name: 'Payment Student',
      email: `paytest_${Math.floor(Math.random() * 10000)}@bookbuddy.com`,
      password: 'hashedpassword123',
      role: 'student',
      collegeId: college._id,
    });

    book = await Book.create({
      collegeId: college._id,
      title: 'Payment Test Book',
      author: 'Hector Garcia-Molina',
      category: 'Computer Science',
      isbn: `978-${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      totalCopies: 5,
      availableCopies: 4,
    });

    loan = await Loan.create({
      collegeId: college._id,
      userId: studentUser._id,
      bookId: book._id,
      issuedBy: studentUser._id,
      maxRenewals: 2,
      issuedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      status: 'active',
    });

    fine = await Fine.create({
      userId: studentUser._id,
      collegeId: college._id,
      loanId: loan._id,
      overdueDays: 5,
      amount: 150,
      status: 'unpaid',
    });
  });

  test('1. Reject Forged/Unsigned Webhook: Missing or invalid signature returns 400 and leaves fine unpaid', async () => {
    const payload = {
      event_id: 'evt_forged_' + Math.random(),
      payload: {
        payment: {
          entity: {
            id: 'pay_forged_' + Math.random(),
            amount: 15000,
            notes: { fineId: fine._id.toString() },
          },
        },
      },
    };

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('x-razorpay-signature', 'invalid_forged_signature_hash')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Signature verification failed');

    // Verify fine status in DB remains unpaid
    const checkFine = await Fine.findById(fine._id);
    expect(checkFine.status).toBe('unpaid');
    expect(checkFine.paidAt).toBeNull();
  });

  test('2. Valid Signature Success: Verified signature updates fine to paid and creates payment record', async () => {
    const payload = {
      event_id: 'evt_valid_' + Math.random(),
      payload: {
        payment: {
          entity: {
            id: 'pay_valid_' + Math.random(),
            amount: 15000,
            notes: { fineId: fine._id.toString() },
          },
        },
      },
    };

    const payloadStr = JSON.stringify(payload);
    const validSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadStr)
      .digest('hex');

    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('x-razorpay-signature', validSignature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify Fine in DB was updated to paid
    const updatedFine = await Fine.findById(fine._id);
    expect(updatedFine.status).toBe('paid');
    expect(updatedFine.paidAt).toBeDefined();

    // Verify Payment record was created
    const paymentRecord = await Payment.findOne({ providerEventId: payload.event_id });
    expect(paymentRecord).not.toBeNull();
    expect(paymentRecord.fineId.toString()).toBe(fine._id.toString());
    expect(paymentRecord.amount).toBe(150);
  });

  test('3. Idempotency Prevention: Duplicate webhook delivery is ignored and does not double-mark paid', async () => {
    const eventId = 'evt_duplicate_' + Math.floor(Math.random() * 1000000);
    const payId = 'pay_duplicate_' + Math.floor(Math.random() * 1000000);
    const payload = {
      event_id: eventId,
      payload: {
        payment: {
          entity: {
            id: payId,
            amount: 15000,
            notes: { fineId: fine._id.toString() },
          },
        },
      },
    };

    const payloadStr = JSON.stringify(payload);
    const validSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadStr)
      .digest('hex');

    // First Delivery
    const res1 = await request(app)
      .post('/api/v1/payments/webhook')
      .set('x-razorpay-signature', validSignature)
      .send(payload);

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);

    const firstFineState = await Fine.findById(fine._id);
    const firstPaidAtTime = firstFineState.paidAt.getTime();

    // Second Duplicate Delivery
    const res2 = await request(app)
      .post('/api/v1/payments/webhook')
      .set('x-razorpay-signature', validSignature)
      .send(payload);

    expect(res2.status).toBe(200);
    expect(res2.body.alreadyProcessed).toBe(true);

    // Verify fine paidAt timestamp was NOT modified and duplicate payment record was not created
    const secondFineState = await Fine.findById(fine._id);
    expect(secondFineState.paidAt.getTime()).toBe(firstPaidAtTime);

    const paymentCount = await Payment.countDocuments({ providerEventId: eventId });
    expect(paymentCount).toBe(1);
  });
});
