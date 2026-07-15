const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_admin_test';
process.env.JWT_SECRET = 'testjwtadminsecretkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtadminrefreshsecretkey999';
process.env.JWT_ACCESS_EXPIRY = '10m';
process.env.JWT_REFRESH_EXPIRY = '7d';
jest.setTimeout(30000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Fine = require('../models/Fine');
const AuditLog = require('../models/AuditLog');
const Complaint = require('../models/Complaint');
const EResource = require('../models/EResource');
const LabSeat = require('../models/LabSeat');
const LabBooking = require('../models/LabBooking');
const { generateTokenPair } = require('../utils/token');

describe('Phase 7 — Super Admin & Analytics Integration Tests', () => {
  let collegeA;
  let collegeB;
  
  let superAdmin;
  let adminA;
  let adminB;
  let studentA;
  let studentB;

  let tokenSuperAdmin;
  let tokenAdminA;
  let tokenAdminB;
  let tokenStudentA;

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
    await Fine.deleteMany({});
    await AuditLog.deleteMany({});
    await Complaint.deleteMany({});
    await EResource.deleteMany({});
    await LabSeat.deleteMany({});
    await LabBooking.deleteMany({});

    // Seed Colleges
    collegeA = await College.create({ name: 'Alpha University', code: 'ALPH' });
    collegeB = await College.create({ name: 'Beta College', code: 'BETA' });

    // Seed Super Admin (unscoped / no collegeId)
    superAdmin = await User.create({
      studentId: 'SUP_001',
      name: 'Super Admin',
      email: 'super@bookbuddy.com',
      password: 'password123',
      role: 'super-admin',
    });

    // Seed College Admins
    adminA = await User.create({
      studentId: 'ADM_ALPH_001',
      name: 'Admin Alpha',
      email: 'admin.a@alpha.edu',
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeA._id,
    });

    adminB = await User.create({
      studentId: 'ADM_BETA_001',
      name: 'Admin Beta',
      email: 'admin.b@beta.edu',
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeB._id,
    });

    // Seed Students
    studentA = await User.create({
      studentId: 'STU_ALPH_001',
      name: 'Student Alpha',
      email: 'student.a@alpha.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    studentB = await User.create({
      studentId: 'STU_BETA_001',
      name: 'Student Beta',
      email: 'student.b@beta.edu',
      password: 'password123',
      role: 'student',
      collegeId: collegeB._id,
    });

    // Generate Tokens
    tokenSuperAdmin = generateTokenPair(superAdmin).accessToken;
    tokenAdminA = generateTokenPair(adminA).accessToken;
    tokenAdminB = generateTokenPair(adminB).accessToken;
    tokenStudentA = generateTokenPair(studentA).accessToken;
  });

  afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  // 1. Privilege Escalation Guard (Sig verification & 403 checks)
  it('1. should reject college_admin with 403 on super_admin routes, and reject tampered tokens with 401', async () => {
    // A normal college_admin gets 403 Forbidden
    const resForbidden = await request(app)
      .get('/api/dashboards/admin-portal/overview')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(resForbidden.status).toBe(403);

    // Tampered token: Valid header/payload but forged signature (signed with wrong secret)
    const tamperedPayload = {
      sub: studentA._id.toString(),
      role: 'super-admin',
      collegeId: null,
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    const tamperedToken = jwt.sign(tamperedPayload, 'wrong_secret_key_123');

    const resTampered = await request(app)
      .get('/api/dashboards/admin-portal/overview')
      .set('Authorization', `Bearer ${tamperedToken}`);
    
    // Auth middleware throws signature error and returns 401
    expect(resTampered.status).toBe(401);
  });

  // 2. POST /admins creation and tenant-scoping verification
  it('2. should allow super_admin to create college_admin, and verify they are correctly scoped to their tenant', async () => {
    const newAdminData = {
      studentId: 'ADM_ALPH_999',
      name: 'New Alpha Admin',
      email: 'new.admin@alpha.edu',
      password: 'password123',
      collegeId: collegeA._id.toString(),
    };

    // Create the admin via super_admin endpoint
    const resCreate = await request(app)
      .post('/api/dashboards/admin-portal/admins')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send(newAdminData);

    expect(resCreate.status).toBe(201);
    expect(resCreate.body.success).toBe(true);
    expect(resCreate.body.data.collegeId).toBe(collegeA._id.toString());
    expect(resCreate.body.data.role).toBe('college-admin');

    const newAdminToken = generateTokenPair(resCreate.body.data).accessToken;

    // Verify tenant-scoping: When the new admin requests patrons, they only see college A's patrons
    const resScope = await request(app)
      .get('/api/dashboards/college-admin/patrons')
      .set('Authorization', `Bearer ${newAdminToken}`);

    expect(resScope.status).toBe(200);
    // Student A is in College A, Student B is in College B. Scoped list should contain A but not B.
    const studentIds = resScope.body.data.map(u => u._id.toString());
    expect(studentIds).toContain(studentA._id.toString());
    expect(studentIds).not.toContain(studentB._id.toString());
  });

  // 3. Audit log count and failure logs
  it('3. should write exactly one AuditLog entry on successful admin action, and zero on validation errors', async () => {
    // Successful college creation
    const resSuccess = await request(app)
      .post('/api/dashboards/admin-portal/colleges')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ name: 'Gamma Institute', code: 'GAM' });
    expect(resSuccess.status).toBe(201);

    let logsSuccess = [];
    for (let i = 0; i < 10; i++) {
      logsSuccess = await AuditLog.find({ action: 'college.create' });
      if (logsSuccess.length === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(logsSuccess.length).toBe(1);
    expect(logsSuccess[0].actorId.toString()).toBe(superAdmin._id.toString());
    expect(logsSuccess[0].metadata.code).toBe('GAM');

    // Failed validation request: Empty name/code
    const resFail = await request(app)
      .post('/api/dashboards/admin-portal/colleges')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ name: '', code: '' });
    expect(resFail.status).toBe(400); // Validation error

    const logsTotal = await AuditLog.find({ action: 'college.create' });
    expect(logsTotal.length).toBe(1); // Still exactly 1, no new log generated
  });

  // 4. Verification that passwordHash / refreshTokenHash is never inside AuditLog metadata
  it('4. should never write password, passwordHash, or refreshTokenHash into AuditLog metadata', async () => {
    const newAdminData = {
      studentId: 'ADM_ALPH_888',
      name: 'Clean Admin',
      email: 'clean.admin@alpha.edu',
      password: 'mySecretPassword123',
      collegeId: collegeA._id.toString(),
    };

    const res = await request(app)
      .post('/api/dashboards/admin-portal/admins')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send(newAdminData);
    expect(res.status).toBe(201);

    // Direct database query on AuditLog (with retry to wait for async write)
    let auditRecord = null;
    for (let i = 0; i < 10; i++) {
      auditRecord = await AuditLog.findOne({ action: 'college_admin.create' });
      if (auditRecord) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(auditRecord).not.toBeNull();

    // Verify metadata does not contain sensitive properties
    const metaStr = JSON.stringify(auditRecord.metadata);
    expect(metaStr).not.toContain('password');
    expect(metaStr).not.toContain('Hash');
    expect(metaStr).not.toContain('mySecretPassword');
  });

  // 5. GET /overview numbers match hand-calculated expected values against known seed data
  it('5. should match hand-calculated overview statistics for the super_admin', async () => {
    // Seed Books
    const bookA = await Book.create({
      collegeId: collegeA._id,
      isbn: '978-1111111111',
      title: 'Book A',
      author: 'Author A',
      category: 'Science',
      copiesTotal: 1,
      copiesAvailable: 0,
    });

    const bookB = await Book.create({
      collegeId: collegeB._id,
      isbn: '978-2222222222',
      title: 'Book B',
      author: 'Author B',
      category: 'Math',
      copiesTotal: 1,
      copiesAvailable: 0,
    });

    // Seed Loans (2 active)
    await Loan.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      bookId: bookA._id,
      status: 'active',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      issuedBy: adminA._id,
      maxRenewals: 2,
    });

    await Loan.create({
      collegeId: collegeB._id,
      userId: studentB._id,
      bookId: bookB._id,
      status: 'active',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      issuedBy: adminB._id,
      maxRenewals: 2,
    });

    // Seed Fines (2 unpaid with total = 35)
    await Fine.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      loanId: new mongoose.Types.ObjectId(),
      amount: 15,
      status: 'unpaid',
      overdueDays: 5,
    });

    await Fine.create({
      collegeId: collegeB._id,
      userId: studentB._id,
      loanId: new mongoose.Types.ObjectId(),
      amount: 20,
      status: 'unpaid',
      overdueDays: 5,
    });

    // Request overview
    const res = await request(app)
      .get('/api/dashboards/admin-portal/overview')
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalColleges).toBe(2);
    expect(res.body.data.activeLoans).toBe(2);
    expect(res.body.data.unpaidFinesCount).toBe(2);
    expect(res.body.data.totalUnpaidFineAmount).toBe(35);
    expect(res.body.data.userCountsByRole['college-admin']).toBe(2);
    expect(res.body.data.userCountsByRole['student']).toBe(2);
    expect(res.body.data.userCountsByRole['super-admin']).toBe(1);
  });

  // 6. Tenant isolation in /analytics/summary
  it('6. should strictly isolate analytics scoping between different colleges', async () => {
    const bookA = await Book.create({
      collegeId: collegeA._id,
      isbn: '978-1111111111',
      title: 'Book A',
      author: 'Author A',
      category: 'Science',
      copiesTotal: 1,
      copiesAvailable: 0,
    });

    const bookB = await Book.create({
      collegeId: collegeB._id,
      isbn: '978-2222222222',
      title: 'Book B',
      author: 'Author B',
      category: 'Math',
      copiesTotal: 1,
      copiesAvailable: 0,
    });

    // 1 Loan in College A, 0 Loans in College B
    await Loan.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      bookId: bookA._id,
      status: 'active',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      issuedBy: adminA._id,
      maxRenewals: 2,
    });

    // College A Admin Request
    const resA = await request(app)
      .get('/api/dashboards/college-admin/analytics/summary')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(resA.status).toBe(200);
    expect(resA.body.data.activeLoans).toBe(1);

    // College B Admin Request
    const resB = await request(app)
      .get('/api/dashboards/college-admin/analytics/summary')
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(resB.status).toBe(200);
    expect(resB.body.data.activeLoans).toBe(0);
  });

  // 7. Aggregation pipeline correctness verification against known seed values
  it('7. should match exact hand-calculated analytics pipeline outputs', async () => {
    // Seed Books (3 for Catalog size count)
    const book1 = await Book.create({
      collegeId: collegeA._id,
      isbn: '978-1000000001',
      title: 'Science Book X',
      author: 'Author X',
      category: 'Science',
      copiesTotal: 5,
      copiesAvailable: 5,
    });
    const book2 = await Book.create({
      collegeId: collegeA._id,
      isbn: '978-1000000002',
      title: 'Science Book Y',
      author: 'Author Y',
      category: 'Science',
      copiesTotal: 5,
      copiesAvailable: 5,
    });
    await Book.create({
      collegeId: collegeA._id,
      isbn: '978-1000000003',
      title: 'Science Book Z',
      author: 'Author Z',
      category: 'Science',
      copiesTotal: 5,
      copiesAvailable: 5,
    });

    // Seed approved digital resource (1 approved, 1 pending)
    await EResource.create({
      collegeId: collegeA._id,
      title: 'EPUB Doc',
      author: 'Author Doc',
      type: 'epub',
      fileUrl: 'http://example.com/doc.epub',
      uploadedBy: studentA._id,
      moderationStatus: 'approved',
      category: 'Science',
    });
    await EResource.create({
      collegeId: collegeA._id,
      title: 'Pending Doc',
      author: 'Author Doc',
      type: 'pdf',
      fileUrl: 'http://example.com/pending.pdf',
      uploadedBy: studentA._id,
      moderationStatus: 'pending',
      category: 'Science',
    });

    // Seed Loans (book1 borrowed twice, book2 borrowed once)
    const loan1 = await Loan.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      bookId: book1._id,
      status: 'active',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      issuedBy: adminA._id,
      maxRenewals: 2,
    });
    const loan2 = await Loan.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      bookId: book1._id,
      status: 'overdue',
      issueDate: new Date(),
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      issuedBy: adminA._id,
      maxRenewals: 2,
    });
    await Loan.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      bookId: book2._id,
      status: 'active',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      issuedBy: adminA._id,
      maxRenewals: 2,
    });

    // Seed Fines (total unpaid fine = 120)
    await Fine.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      loanId: loan1._id,
      amount: 50,
      status: 'unpaid',
      overdueDays: 5,
    });
    await Fine.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      loanId: loan2._id,
      amount: 70,
      status: 'unpaid',
      overdueDays: 5,
    });
    await Fine.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      loanId: loan1._id,
      amount: 100,
      status: 'paid', // should be excluded
      overdueDays: 5,
    });

    // Seed Complaints (1 resolved with resolution time: 2 hours)
    const createTime = new Date('2026-07-14T10:00:00Z');
    const resolveTime = new Date('2026-07-14T12:00:00Z');
    await Complaint.create({
      collegeId: collegeA._id,
      submittedBy: studentA._id,
      subject: 'Wifi issues',
      description: 'Wifi is slow in the library',
      category: 'facility',
      status: 'resolved',
      resolvedBy: adminA._id,
      createdAt: createTime,
      resolvedAt: resolveTime,
    });

    // Seed Lab operational seats and bookings (2 seats, 1 booking) -> utilization: 0.5
    const seat1 = await LabSeat.create({
      collegeId: collegeA._id,
      labName: 'CS Lab 1',
      seatNumber: 'S01',
      specs: 'PC',
      maintenanceStatus: 'operational',
    });
    await LabSeat.create({
      collegeId: collegeA._id,
      labName: 'CS Lab 1',
      seatNumber: 'S02',
      specs: 'PC',
      maintenanceStatus: 'operational',
    });
    await LabBooking.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      seatId: seat1._id,
      date: new Date(),
      slot: '09:00-10:00',
      startTime: new Date(),
      endTime: new Date(),
      status: 'booked',
    });

    // Request analytics summary
    const res = await request(app)
      .get('/api/dashboards/college-admin/analytics/summary')
      .set('Authorization', `Bearer ${tokenAdminA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.activeLoans).toBe(2);
    expect(res.body.data.overdueLoans).toBe(1);
    expect(res.body.data.unpaidFinesTotal).toBe(120);
    expect(res.body.data.catalogSize).toBe(3);
    expect(res.body.data.digitalResourceCount).toBe(1);
    expect(res.body.data.avgComplaintResolutionHours).toBe(2.0);
    expect(res.body.data.labUtilizationRate).toBe(0.5);

    // Most-borrowed books verification
    const topBooks = res.body.data.topBooks;
    expect(topBooks.length).toBe(2);
    expect(topBooks[0].title).toBe('Science Book X');
    expect(topBooks[0].count).toBe(2);
    expect(topBooks[1].title).toBe('Science Book Y');
    expect(topBooks[1].count).toBe(1);
  });

  // 8. GET /audit-logs endpoint checks (Filtering and role checks)
  it('8. should limit GET /audit-logs to super_admin and filter accurately by collegeId/action', async () => {
    // Setup audit records
    await AuditLog.create({
      actorId: superAdmin._id,
      actorRole: 'super-admin',
      action: 'college.create',
      collegeId: collegeA._id,
    });

    await AuditLog.create({
      actorId: superAdmin._id,
      actorRole: 'super-admin',
      action: 'college_admin.create',
      collegeId: collegeB._id,
    });

    // Check college_admin is rejected
    const resDenied = await request(app)
      .get('/api/dashboards/admin-portal/audit-logs')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(resDenied.status).toBe(403);

    // Super_admin reads logs filterable by collegeA
    const resFiltered = await request(app)
      .get(`/api/dashboards/admin-portal/audit-logs?collegeId=${collegeA._id.toString()}`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);

    expect(resFiltered.status).toBe(200);
    expect(resFiltered.body.data.length).toBe(1);
    expect(resFiltered.body.data[0].action).toBe('college.create');
  });
});
