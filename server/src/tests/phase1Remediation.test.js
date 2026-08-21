const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_phase1_test';

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Fine = require('../models/Fine');
const Loan = require('../models/Loan');
const Payment = require('../models/Payment');
const { generateTokenPair } = require('../utils/token');

describe('Phase 1 Remediation Integration Tests', () => {
  let college;
  let student;
  let tokenStudent;
  let fine;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    try {
      await mongoose.connection.db.collection('payments').dropIndex('providerEventId_1');
    } catch (_err) {
      // Index may already be dropped
    }
    await Payment.syncIndexes();
  });

  afterAll(async () => {
    await College.deleteMany({});
    await User.deleteMany({});
    await Fine.deleteMany({});
    await Loan.deleteMany({});
    await Payment.deleteMany({});
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await College.deleteMany({});
    await User.deleteMany({});
    await Fine.deleteMany({});
    await Loan.deleteMany({});
    await Payment.deleteMany({});

    college = await College.create({
      name: 'Phase 1 College',
      code: 'P1C',
      domain: 'phase1.edu',
      status: 'active',
      isActive: true,
    });

    student = await User.create({
      studentId: 'STU_P1',
      name: 'Phase 1 Student',
      email: 'student@phase1.edu',
      password: 'password123',
      collegeId: college._id,
      role: 'student',
      isActive: true,
    });

    tokenStudent = generateTokenPair(student).accessToken;

    const loan = await Loan.create({
      userId: student._id,
      collegeId: college._id,
      bookId: new mongoose.Types.ObjectId(),
      issuedBy: student._id,
      maxRenewals: 2,
      status: 'overdue',
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });

    fine = await Fine.create({
      userId: student._id,
      collegeId: college._id,
      loanId: loan._id,
      overdueDays: 5,
      amount: 50,
      reason: 'Overdue textbook',
      status: 'unpaid',
    });
  });

  test('1. Idempotency Middleware: Retried payment request with same Idempotency-Key returns cached response', async () => {
    const idempotencyKey = `key_test_${Date.now()}`;

    // First payment checkout request
    const res1 = await request(app)
      .post('/api/v1/payments/checkout-session')
      .set('Authorization', `Bearer ${tokenStudent}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ fineId: fine._id.toString() });

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.headers['x-cache-lookup']).toBeUndefined();

    // Second retried request with identical Idempotency-Key
    const res2 = await request(app)
      .post('/api/v1/payments/checkout-session')
      .set('Authorization', `Bearer ${tokenStudent}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ fineId: fine._id.toString() });

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
    expect(res2.headers['x-cache-lookup']).toBe('HIT-Idempotency');
    expect(res2.body.data.orderId).toBe(res1.body.data.orderId);
  });

  test('2. Path Versioning: Canonical /api/v1/ and legacy /api/ endpoints both work, with legacy emitting deprecation header', async () => {
    // Canonical /api/v1/ endpoint hit
    const resCanonical = await request(app).get('/api/v1/registration/colleges');

    expect(resCanonical.status).toBe(200);
    expect(resCanonical.headers['x-deprecated-path']).toBeUndefined();

    // Legacy unversioned /api/ endpoint hit
    const resLegacy = await request(app).get('/api/registration/colleges');

    expect(resLegacy.status).toBe(200);
    expect(resLegacy.headers['x-deprecated-path']).toBe('true');
    expect(resLegacy.headers['x-deprecation-warning']).toMatch(/removed in 90 days/i);
  });
});
