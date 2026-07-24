const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy_test';
process.env.JWT_SECRET = 'secret';
jest.setTimeout(60000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Fine = require('../models/Fine');
const LabSeat = require('../models/LabSeat');
const LabBooking = require('../models/LabBooking');
const jwt = require('jsonwebtoken');
const { generatePatronToken, verifyPatronToken } = require('../utils/patronTokenUtil');

describe('Backend Audit Fixes Unit Tests (Items 1 - 3)', () => {
  let college;
  let studentUser;
  let studentToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await College.deleteMany({ code: 'ATU999' });
    await User.deleteMany({ email: 'auditstudent@bookbuddy.com' });
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await College.deleteMany({ code: 'ATU999' });
    await User.deleteMany({ email: 'auditstudent@bookbuddy.com' });
    await Book.deleteMany({ collegeId: { $exists: true } });
    await Loan.deleteMany({});
    await Fine.deleteMany({});
    await LabSeat.deleteMany({});
    await LabBooking.deleteMany({});
    college = await College.create({
      name: 'Audit Test University',
      code: 'ATU999',
      selectedServices: ['facilities_booking', 'catalog_management'],
      enabledFeatures: ['facilities_booking', 'catalog_management'],
    });

    // 2. Seed Student User
    studentUser = await User.create({
      studentId: 'STU_AUDIT_001',
      name: 'Audit Student',
      email: 'auditstudent@bookbuddy.com',
      password: 'hashedpassword123',
      role: 'student',
      collegeId: college._id,
      membershipStatus: 'active',
    });

    // Generate test JWT auth token
    studentToken = jwt.sign(
      { sub: studentUser._id, role: studentUser.role, collegeId: college._id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );
  });

  // ==========================================================
  // Item 1: Patron Card Rotating Verification Token & Verification Endpoint
  // ==========================================================
  describe('1. Patron Card Gate Verification Token', () => {
    test('generatePatronToken creates a valid 30s token', () => {
      const { token, expiresAt } = generatePatronToken(studentUser._id, studentUser.studentId);
      expect(token).toBeDefined();
      expect(expiresAt).toBeGreaterThan(Date.now());

      const verified = verifyPatronToken(token);
      expect(verified.valid).toBe(true);
      expect(verified.studentId).toBe('STU_AUDIT_001');
      expect(verified.userId).toBe(studentUser._id.toString());
    });

    test('verifyPatronToken rejects expired or malformed tokens', () => {
      // Malformed token
      const malformed = verifyPatronToken('invalid-token-string');
      expect(malformed.valid).toBe(false);
      expect(malformed.reason).toContain('Malformed');

      // Expired token (signed with exp 2 seconds in past)
      const pastExp = Math.floor(Date.now() / 1000) - 2;
      const expiredToken = jwt.sign(
        {
          userId: studentUser._id.toString(),
          studentId: 'STU_AUDIT_001',
          type: 'patron-card-gate',
          exp: pastExp,
        },
        process.env.JWT_SECRET || 'secret'
      );
      const expiredResult = verifyPatronToken(expiredToken);
      expect(expiredResult.valid).toBe(false);
      expect(expiredResult.reason).toContain('expired');
    });

    test('POST /api/patron-card/verify successfully verifies a valid scanned token', async () => {
      const { token } = generatePatronToken(studentUser._id, studentUser.studentId);

      const res = await request(app).post('/api/patron-card/verify').send({ token });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.studentId).toBe('STU_AUDIT_001');
      expect(res.body.data.name).toBe('Audit Student');
    });

    test('POST /api/patron-card/verify rejects an expired or invalid token', async () => {
      const res = await request(app)
        .post('/api/patron-card/verify')
        .send({ token: 'bogus-scanned-qr-code' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.data.valid).toBe(false);
    });
  });

  // ==========================================================
  // Item 2: Fine-Based Loan Renewal Guardrail
  // ==========================================================
  describe('2. Loan Renewal Fine-Based Guardrails', () => {
    let book;
    let activeLoan;

    beforeEach(async () => {
      book = await Book.create({
        collegeId: college._id,
        title: 'Audit Testing Handbook',
        author: 'QA Lead',
        category: 'General',
        isbn: '978-0-123456-78-9',
        copiesTotal: 5,
        copiesAvailable: 4,
      });

      activeLoan = await Loan.create({
        collegeId: college._id,
        userId: studentUser._id,
        bookId: book._id,
        issuedBy: studentUser._id,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 86400000),
        status: 'active',
        renewalCount: 0,
        maxRenewals: 3,
      });
    });

    test('GET /api/dashboards/student/loans flags renewalEligibility.eligible = false when unpaid fines exceed limit', async () => {
      // Seed fine of ₹150 (exceeding default limit of ₹100)
      await Fine.create({
        collegeId: college._id,
        userId: studentUser._id,
        loanId: activeLoan._id,
        amount: 150,
        overdueDays: 5,
        reason: 'overdue',
        status: 'unpaid',
      });

      const res = await request(app)
        .get('/api/dashboards/student/loans')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const targetLoan = res.body.data.active.find(
        (l) => l._id.toString() === activeLoan._id.toString()
      );
      expect(targetLoan).toBeDefined();
      expect(targetLoan.renewalEligibility.eligible).toBe(false);
      expect(targetLoan.renewalEligibility.reason).toContain(
        'Blocked: ₹150.00 unpaid fines exceed'
      );
    });

    test('POST /api/dashboards/student/loans/:id/renew rejects renewal when unpaid fines exceed limit', async () => {
      await Fine.create({
        collegeId: college._id,
        userId: studentUser._id,
        loanId: activeLoan._id,
        amount: 120,
        overdueDays: 3,
        reason: 'damage',
        status: 'unpaid',
      });

      const res = await request(app)
        .post(`/api/dashboards/student/loans/${activeLoan._id}/renew`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Unpaid fines');
    });
  });

  // ==========================================================
  // Item 3: Lab Seat Booking Cross-Seat Overlap Prevention
  // ==========================================================
  describe('3. Lab Seat Booking Cross-Seat Overlap & Concurrency', () => {
    let seatA;
    let seatB;
    let startTime;
    let endTime;

    beforeEach(async () => {
      seatA = await LabSeat.create({
        collegeId: college._id,
        labName: 'Central Computing Lab',
        seatNumber: 'PC-101',
        zone: 'pc_lab',
        maintenanceStatus: 'operational',
      });

      seatB = await LabSeat.create({
        collegeId: college._id,
        labName: 'Central Computing Lab',
        seatNumber: 'PC-102',
        zone: 'pc_lab',
        maintenanceStatus: 'operational',
      });

      // Target slot: tomorrow at 10:00 UTC
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      startTime = new Date(
        Date.UTC(
          tomorrow.getUTCFullYear(),
          tomorrow.getUTCMonth(),
          tomorrow.getUTCDate(),
          10,
          0,
          0,
          0
        )
      );
      endTime = new Date(
        Date.UTC(
          tomorrow.getUTCFullYear(),
          tomorrow.getUTCMonth(),
          tomorrow.getUTCDate(),
          11,
          0,
          0,
          0
        )
      );
    });

    test('POST /api/lab/bookings rejects cross-seat double booking for same student in overlapping slot', async () => {
      // 1. Book Seat A
      const res1 = await request(app)
        .post('/api/lab/bookings')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          seatId: seatA._id,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });

      expect(res1.statusCode).toBe(201);
      expect(res1.body.success).toBe(true);

      // 2. Attempt to book Seat B for the SAME student in the SAME overlapping time slot
      const res2 = await request(app)
        .post('/api/lab/bookings')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          seatId: seatB._id,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });

      expect(res2.statusCode).toBe(409);
      expect(res2.body.message).toContain('already hold an active lab seat reservation');
    });
  });
});
