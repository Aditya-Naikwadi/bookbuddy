process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_student_tenant_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testjwtlibrarysecretkey999';

jest.setTimeout(30000);

const request = require('supertest');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const app = require('../app');

const College = require('../models/College');
const User = require('../models/User');
const Book = require('../models/Book');
const EResource = require('../models/EResource');
const Loan = require('../models/Loan');
const Fine = require('../models/Fine');
const Complaint = require('../models/Complaint');
const LabBooking = require('../models/LabBooking');
const LabSeat = require('../models/LabSeat');
const { generateAccessToken } = require('../utils/token');

describe('Student Multi-Tenant Data Isolation & Endpoint Scoping Test Suite', () => {
  let collegeA, collegeB;
  let studentA, studentB;
  let tokenA, tokenB;
  let bookA, bookB;
  let eResourceA, eResourceB;
  let loanA, loanB;
  let fineA, fineB;
  let complaintA, complaintB;
  let facilityA, facilityB;
  let labBookingA, labBookingB;

  beforeAll(async () => {
    await connectDB();

    const stamp = Date.now();

    // 1. Create two isolated colleges
    collegeA = await College.create({
      name: `College Alpha ${stamp}`,
      code: `ALPHA_${stamp}`,
      slug: `alpha-${stamp}`,
      subdomain: `alpha-${stamp}`,
      status: 'active',
      enabledFeatures: [
        'catalog',
        'loans',
        'fines',
        'e-resources',
        'facilities',
        'support',
        'gamification',
      ],
    });

    collegeB = await College.create({
      name: `College Beta ${stamp}`,
      code: `BETA_${stamp}`,
      slug: `beta-${stamp}`,
      subdomain: `beta-${stamp}`,
      status: 'active',
      enabledFeatures: [
        'catalog',
        'loans',
        'fines',
        'e-resources',
        'facilities',
        'support',
        'gamification',
      ],
    });

    // 2. Create students in each college
    studentA = await User.create({
      name: 'Student Alpha',
      studentId: `STU_A_${stamp}`,
      email: `studentA_${stamp}@alpha.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
      status: 'active',
    });

    studentB = await User.create({
      name: 'Student Beta',
      studentId: `STU_B_${stamp}`,
      email: `studentB_${stamp}@beta.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeB._id,
      status: 'active',
    });

    tokenA = generateAccessToken(studentA);
    tokenB = generateAccessToken(studentB);

    // 3. Create Books
    bookA = await Book.create({
      collegeId: collegeA._id,
      title: 'Advanced Robotics Alpha',
      author: 'Prof Alpha',
      isbn: `978-${stamp.toString().slice(-10)}`,
      category: 'Robotics',
      copiesTotal: 5,
      copiesAvailable: 4,
    });

    bookB = await Book.create({
      collegeId: collegeB._id,
      title: 'Organic Chemistry Beta',
      author: 'Prof Beta',
      isbn: `978-${(stamp + 1).toString().slice(-10)}`,
      category: 'Chemistry',
      copiesTotal: 3,
      copiesAvailable: 2,
    });

    // 4. Create EResources
    eResourceA = await EResource.create({
      collegeId: collegeA._id,
      title: 'Alpha Digital Lab Manual',
      author: 'Dr. Alpha',
      type: 'pdf',
      fileUrl: '/uploads/ebooks/alpha.pdf',
      category: 'Engineering',
      source: 'internal',
      moderationStatus: 'approved',
      uploadedBy: studentA._id,
    });

    eResourceB = await EResource.create({
      collegeId: collegeB._id,
      title: 'Beta Digital Chemistry Notes',
      author: 'Dr. Beta',
      type: 'pdf',
      fileUrl: '/uploads/ebooks/beta.pdf',
      category: 'Chemistry',
      source: 'internal',
      moderationStatus: 'approved',
      uploadedBy: studentB._id,
    });

    // 5. Create Loans
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    loanA = await Loan.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      bookId: bookA._id,
      dueDate,
      status: 'active',
      issuedBy: studentA._id,
      maxRenewals: 2,
      renewalCount: 0,
    });

    loanB = await Loan.create({
      collegeId: collegeB._id,
      userId: studentB._id,
      bookId: bookB._id,
      dueDate,
      status: 'active',
      issuedBy: studentB._id,
      maxRenewals: 2,
      renewalCount: 0,
    });

    // 6. Create Fines
    fineA = await Fine.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      loanId: loanA._id,
      overdueDays: 5,
      amount: 50,
      status: 'unpaid',
    });

    fineB = await Fine.create({
      collegeId: collegeB._id,
      userId: studentB._id,
      loanId: loanB._id,
      overdueDays: 7,
      amount: 75,
      status: 'unpaid',
    });

    // 7. Create Complaints
    complaintA = await Complaint.create({
      collegeId: collegeA._id,
      submittedBy: studentA._id,
      subject: 'Lab AC Issue Alpha',
      description: 'Air conditioning not working in lab 101',
      status: 'open',
    });

    complaintB = await Complaint.create({
      collegeId: collegeB._id,
      submittedBy: studentB._id,
      subject: 'Chair Broken Beta',
      description: 'Seat 14 in study room B is broken',
      status: 'open',
    });

    // 8. Create Facility Seats & Lab Bookings
    facilityA = await LabSeat.create({
      collegeId: collegeA._id,
      labName: 'Computer Lab Alpha',
      seatNumber: 'WS-A01',
      resourceType: 'workstation',
      maintenanceStatus: 'operational',
    });

    facilityB = await LabSeat.create({
      collegeId: collegeB._id,
      labName: 'Computer Lab Beta',
      seatNumber: 'WS-B01',
      resourceType: 'workstation',
      maintenanceStatus: 'operational',
    });

    const now = new Date();
    const later = new Date(Date.now() + 2 * 60 * 60 * 1000);

    labBookingA = await LabBooking.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      seatId: facilityA._id,
      date: now,
      startTime: now,
      endTime: later,
      status: 'booked',
    });

    labBookingB = await LabBooking.create({
      collegeId: collegeB._id,
      userId: studentB._id,
      seatId: facilityB._id,
      date: now,
      startTime: now,
      endTime: later,
      status: 'booked',
    });
  });

  afterAll(async () => {
    try {
      await Book.deleteMany({ _id: { $in: [bookA._id, bookB._id] } });
      await EResource.deleteMany({ _id: { $in: [eResourceA._id, eResourceB._id] } });
      await Loan.deleteMany({ _id: { $in: [loanA._id, loanB._id] } });
      await Fine.deleteMany({ _id: { $in: [fineA._id, fineB._id] } });
      await Complaint.deleteMany({ _id: { $in: [complaintA._id, complaintB._id] } });
      await LabSeat.deleteMany({ _id: { $in: [facilityA._id, facilityB._id] } });
      await LabBooking.deleteMany({ _id: { $in: [labBookingA._id, labBookingB._id] } });
      await User.deleteMany({ _id: { $in: [studentA._id, studentB._id] } });
      await College.deleteMany({ _id: { $in: [collegeA._id, collegeB._id] } });
    } catch {
      // Ignore
    } finally {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    }
  });

  describe('1. Catalog / OPAC Tenant Isolation', () => {
    test('Student A only receives College Alpha books', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/student/catalog')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      const ids = res.body.data.map((b) => b._id.toString());
      expect(ids).toContain(bookA._id.toString());
      expect(ids).not.toContain(bookB._id.toString());
    });

    test('Student B only receives College Beta books', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/student/catalog')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.statusCode).toBe(200);
      const ids = res.body.data.map((b) => b._id.toString());
      expect(ids).toContain(bookB._id.toString());
      expect(ids).not.toContain(bookA._id.toString());
    });
  });

  describe('2. E-Resources Tenant Isolation', () => {
    test('Student A only sees approved E-Resources from College Alpha', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/student/eresources')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      const items = res.body.data?.items || res.body.data || [];
      const ids = items.map((r) => r._id.toString());
      expect(ids).toContain(eResourceA._id.toString());
      expect(ids).not.toContain(eResourceB._id.toString());
    });

    test('Student B only sees approved E-Resources from College Beta', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/student/eresources')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.statusCode).toBe(200);
      const items = res.body.data?.items || res.body.data || [];
      const ids = items.map((r) => r._id.toString());
      expect(ids).toContain(eResourceB._id.toString());
      expect(ids).not.toContain(eResourceA._id.toString());
    });
  });

  describe('3. Loans & Circulation Tenant Isolation', () => {
    test('Student A only receives active loans for Student A', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/student/loans')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      const loanList = res.body.data?.active || res.body.data || [];
      const loanIds = (Array.isArray(loanList) ? loanList : []).map((l) => l._id.toString());
      expect(loanIds).toContain(loanA._id.toString());
      expect(loanIds).not.toContain(loanB._id.toString());
    });

    test('Student B cannot renew a loan belonging to Student A', async () => {
      const res = await request(app)
        .post(`/api/v1/dashboards/student/loans/${loanA._id}/renew`)
        .set('Authorization', `Bearer ${tokenB}`);

      // Should return 404 or 403 because loanA belongs to studentA/collegeA
      expect([403, 404]).toContain(res.statusCode);
    });
  });

  describe('4. Fines Tenant Isolation', () => {
    test('Student A only receives fines for Student A', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/student/fines')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      const fineIds = res.body.data.map((f) => f._id.toString());
      expect(fineIds).toContain(fineA._id.toString());
      expect(fineIds).not.toContain(fineB._id.toString());
    });
  });

  describe('5. Complaints & Support Tenant Isolation', () => {
    test('Student A only receives complaints submitted by Student A', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/student/complaints')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      const complaintIds = res.body.data.map((c) => c._id.toString());
      expect(complaintIds).toContain(complaintA._id.toString());
      expect(complaintIds).not.toContain(complaintB._id.toString());
    });
  });

  describe('6. Facility & Lab Bookings Tenant Isolation', () => {
    test('Student A only sees bookings for Student A', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/student/lab-bookings')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      const bookingIds = res.body.data.map((b) => b._id.toString());
      expect(bookingIds).toContain(labBookingA._id.toString());
      expect(bookingIds).not.toContain(labBookingB._id.toString());
    });
  });

  describe('7. Dashboard Overview Aggregate Tenant Scoping', () => {
    test('Student A overview aggregates only College Alpha data', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/student/overview')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      const data = res.body.data;
      expect(data.user.collegeId.toString()).toBe(collegeA._id.toString());

      const activeLoanIds = data.activeLoans.map((l) => l._id.toString());
      expect(activeLoanIds).toContain(loanA._id.toString());
      expect(activeLoanIds).not.toContain(loanB._id.toString());

      const activeBookingIds = data.activeBookings.map((b) => b._id.toString());
      expect(activeBookingIds).toContain(labBookingA._id.toString());
      expect(activeBookingIds).not.toContain(labBookingB._id.toString());
    });
  });
});
