/**
 * Consolidated Suite: admin Dashboard And I L S
 * Merged from:
 *  - admin.test.js
 *  - studentDashboardAudit.test.js
 *  - ilsDashboardAndAcquisitions.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('admin Dashboard And I L S Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: admin.test.js]', () => {
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
        // await // mongoose.connection.close();
      });

      // 1. Privilege Escalation Guard (Sig verification & 403 checks)
      it('1. should reject college_admin with 403 on super_admin routes, and reject tampered tokens with 401', async () => {
        // A normal college_admin gets 403 Forbidden
        const resForbidden = await request(app)
          .get('/api/v1/dashboards/admin-portal/overview')
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
          .get('/api/v1/dashboards/admin-portal/overview')
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
          .post('/api/v1/dashboards/admin-portal/admins')
          .set('Authorization', `Bearer ${tokenSuperAdmin}`)
          .send(newAdminData);

        expect(resCreate.status).toBe(201);
        expect(resCreate.body.success).toBe(true);
        expect(resCreate.body.data.collegeId).toBe(collegeA._id.toString());
        expect(resCreate.body.data.role).toBe('college-admin');

        const newAdminToken = generateTokenPair(resCreate.body.data).accessToken;

        // Verify tenant-scoping: When the new admin requests patrons, they only see college A's patrons
        const resScope = await request(app)
          .get('/api/v1/dashboards/college-admin/patrons')
          .set('Authorization', `Bearer ${newAdminToken}`);

        expect(resScope.status).toBe(200);
        // Student A is in College A, Student B is in College B. Scoped list should contain A but not B.
        const studentIds = resScope.body.data.map((u) => u._id.toString());
        expect(studentIds).toContain(studentA._id.toString());
        expect(studentIds).not.toContain(studentB._id.toString());
      });

      // 3. Audit log count and failure logs
      it('3. should write exactly one AuditLog entry on successful admin action, and zero on validation errors', async () => {
        // Successful college creation
        const resSuccess = await request(app)
          .post('/api/v1/dashboards/admin-portal/colleges')
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
          .post('/api/v1/dashboards/admin-portal/colleges')
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
          .post('/api/v1/dashboards/admin-portal/admins')
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
          .get('/api/v1/dashboards/admin-portal/overview')
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

        await Book.create({
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
          .get('/api/v1/dashboards/college-admin/analytics/summary')
          .set('Authorization', `Bearer ${tokenAdminA}`);
        expect(resA.status).toBe(200);
        expect(resA.body.data.activeLoans).toBe(1);

        // College B Admin Request
        const resB = await request(app)
          .get('/api/v1/dashboards/college-admin/analytics/summary')
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
          .get('/api/v1/dashboards/college-admin/analytics/summary')
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
          .get('/api/v1/dashboards/admin-portal/audit-logs')
          .set('Authorization', `Bearer ${tokenAdminA}`);
        expect(resDenied.status).toBe(403);

        // Super_admin reads logs filterable by collegeA
        const resFiltered = await request(app)
          .get(`/api/v1/dashboards/admin-portal/audit-logs?collegeId=${collegeA._id.toString()}`)
          .set('Authorization', `Bearer ${tokenSuperAdmin}`);

        expect(resFiltered.status).toBe(200);
        expect(resFiltered.body.data.length).toBe(1);
        expect(resFiltered.body.data[0].action).toBe('college.create');
      });

      // 9. College Onboarding and Lifecycle State Machine
      it('9. should transition college status through pending -> active -> suspended -> archived and reject terminal state modifications', async () => {
        // A. Create a college
        const collegeRes = await request(app)
          .post('/api/v1/dashboards/admin-portal/colleges')
          .set('Authorization', `Bearer ${tokenSuperAdmin}`)
          .send({ name: 'State University Tech', code: 'SUT' });
        expect(collegeRes.status).toBe(201);
        expect(collegeRes.body.data.status).toBe('pending');
        const collegeId = collegeRes.body.data._id;

        // B. Verify we can list colleges and get college details
        const listRes = await request(app)
          .get('/api/v1/dashboards/admin-portal/colleges')
          .set('Authorization', `Bearer ${tokenSuperAdmin}`);
        expect(listRes.status).toBe(200);
        const codes = listRes.body.data.map((c) => c.code);
        expect(codes).toContain('SUT');

        const detailRes = await request(app)
          .get(`/api/v1/dashboards/admin-portal/colleges/${collegeId}`)
          .set('Authorization', `Bearer ${tokenSuperAdmin}`);
        expect(detailRes.status).toBe(200);
        expect(detailRes.body.data.status).toBe('pending');

        // C. Provision first admin (transitions college status to active)
        const adminRes = await request(app)
          .post('/api/v1/dashboards/admin-portal/admins')
          .set('Authorization', `Bearer ${tokenSuperAdmin}`)
          .send({
            studentId: 'ADM_SUT_001',
            name: 'SUT Admin',
            email: 'admin@sut.edu',
            password: 'password123',
            collegeId,
          });
        expect(adminRes.status).toBe(201);

        // Verify college is now active
        const activeCollege = await College.findById(collegeId);
        expect(activeCollege.status).toBe('active');

        // D. Suspend the college
        const suspendRes = await request(app)
          .patch(`/api/v1/dashboards/admin-portal/colleges/${collegeId}/status`)
          .set('Authorization', `Bearer ${tokenSuperAdmin}`)
          .send({ status: 'suspended' });
        expect(suspendRes.status).toBe(200);
        expect(suspendRes.body.data.status).toBe('suspended');

        // E. Archive the college
        const archiveRes = await request(app)
          .patch(`/api/v1/dashboards/admin-portal/colleges/${collegeId}/status`)
          .set('Authorization', `Bearer ${tokenSuperAdmin}`)
          .send({ status: 'archived' });
        expect(archiveRes.status).toBe(200);
        expect(archiveRes.body.data.status).toBe('archived');

        // F. Try to reinstate archived college (should fail since archived is terminal)
        const failRes = await request(app)
          .patch(`/api/v1/dashboards/admin-portal/colleges/${collegeId}/status`)
          .set('Authorization', `Bearer ${tokenSuperAdmin}`)
          .send({ status: 'active' });
        expect(failRes.status).toBe(400);
      });

      // 10. Suspension and Archival Lockout Propagation
      it('10. should immediately block access for students/admins belonging to suspended/archived colleges', async () => {
        // Get token for Student A (College A is currently active)
        const resActive = await request(app)
          .get('/api/v1/auth/profile')
          .set('Authorization', `Bearer ${tokenStudentA}`);
        expect(resActive.status).toBe(200);

        // Suspend College A
        await request(app)
          .patch(`/api/v1/dashboards/admin-portal/colleges/${collegeA._id.toString()}/status`)
          .set('Authorization', `Bearer ${tokenSuperAdmin}`)
          .send({ status: 'suspended' });

        // Request as Student A again (should fail with 403)
        const resSuspended = await request(app)
          .get('/api/v1/auth/profile')
          .set('Authorization', `Bearer ${tokenStudentA}`);
        expect(resSuspended.status).toBe(403);
        expect(resSuspended.body.message).toContain('suspended');
      });

      // 11. E-Resource Moderation & Staged Publishing State Machine
      it('11. should enforce staging flow for e-resources: pending -> approved -> published', async () => {
        // Create an internal resource in pending state
        const resource = await EResource.create({
          collegeId: collegeA._id,
          title: 'Unpublished Internal Book',
          author: 'Author Internal',
          type: 'epub',
          fileUrl: '/api/v1/reader/local/internal.epub',
          uploadedBy: studentA._id,
          moderationStatus: 'pending',
          category: 'Science',
          storageKey: 'uploads/ebooks/internal.epub',
          fileSizeBytes: 1000,
        });

        // Student A tries to stream it (should fail with 403)
        const resStreamFail = await request(app)
          .get(`/api/v1/reader/${resource._id.toString()}/content`)
          .set('Authorization', `Bearer ${tokenStudentA}`);
        expect(resStreamFail.status).toBe(403);

        // Approve the resource
        const resApprove = await request(app)
          .put(`/api/v1/dashboards/admin-portal/moderation/${resource._id.toString()}`)
          .set('Authorization', `Bearer ${tokenSuperAdmin}`)
          .send({ status: 'approved', note: 'Looks good' });
        expect(resApprove.status).toBe(200);
        expect(resApprove.body.data.moderationStatus).toBe('approved');

        // Student A tries to stream it (should still fail with 403 because it is approved but not published)
        const resStreamFail2 = await request(app)
          .get(`/api/v1/reader/${resource._id.toString()}/content`)
          .set('Authorization', `Bearer ${tokenStudentA}`);
        expect(resStreamFail2.status).toBe(403);

        // Publish the resource
        const resPublish = await request(app)
          .post(`/api/v1/dashboards/admin-portal/moderation/${resource._id.toString()}/publish`)
          .set('Authorization', `Bearer ${tokenSuperAdmin}`);
        expect(resPublish.status).toBe(200);
        expect(resPublish.body.data.moderationStatus).toBe('published');

        // Student A tries to stream it (should bypass the 403 moderation status block, though may 404 on physical file check)
        const resStreamSuccess = await request(app)
          .get(`/api/v1/reader/${resource._id.toString()}/content`)
          .set('Authorization', `Bearer ${tokenStudentA}`);
        expect(resStreamSuccess.status).toBe(404); // 404 = file not found, which is correct because the physical file doesn't exist
      });

      // 12. Platform Metrics Aggregation and Cached rollup
      it('12. should execute metrics aggregation cron job and fetch from cache on overview requests', async () => {
        // Run cron job manually
        const { runMetricsAggregation } = require('../services/cronService');
        const snapshotCount = await runMetricsAggregation();
        expect(snapshotCount).toBeGreaterThan(0);

        // Request overview (must return successful aggregated metrics)
        const res = await request(app)
          .get('/api/v1/dashboards/admin-portal/overview')
          .set('Authorization', `Bearer ${tokenSuperAdmin}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.totalColleges).toBe(2);
      });

      // 13. End-to-End: Super Admin publishes -> student can view in catalog and open detail page, zero 404s
      it('13. Super Admin publishes -> student can view in catalog and open detail page, zero 404s', async () => {
        const studentA2 = await User.create({
          studentId: 'STU_ALPH_002',
          name: 'Student Alpha Two',
          email: 'student.a2@alpha.edu',
          password: 'password123',
          role: 'student',
          collegeId: collegeA._id,
        });
        const tokenStudentA2 = generateTokenPair(studentA2).accessToken;

        // Student A uploads a resource
        const resource = await EResource.create({
          collegeId: collegeA._id,
          title: 'Global Quantum Computing',
          author: 'Dr. Physicist',
          type: 'pdf',
          fileUrl: '/api/v1/reader/local/quantum.pdf',
          uploadedBy: studentA._id,
          moderationStatus: 'pending',
          category: 'Computer Science',
          storageKey: 'uploads/ebooks/quantum.pdf',
          fileSizeBytes: 2048,
        });

        // 1. Super Admin approves it
        const resApprove = await request(app)
          .put(`/api/v1/dashboards/admin-portal/moderation/${resource._id.toString()}`)
          .set('Authorization', `Bearer ${tokenSuperAdmin}`)
          .send({ status: 'approved', note: 'Approved for publication' });
        expect(resApprove.status).toBe(200);
        expect(resApprove.body.data.moderationStatus).toBe('approved');

        // 2. Super Admin publishes globally
        const resPublish = await request(app)
          .post(`/api/v1/dashboards/admin-portal/moderation/${resource._id.toString()}/publish`)
          .set('Authorization', `Bearer ${tokenSuperAdmin}`);
        expect(resPublish.status).toBe(200);
        expect(resPublish.body.data.moderationStatus).toBe('published');

        // 3. Student A2 (who did NOT upload the resource) views eresources list via student dashboard
        const resList = await request(app)
          .get('/api/v1/dashboards/student/eresources')
          .set('Authorization', `Bearer ${tokenStudentA2}`);
        expect(resList.status).toBe(200);
        const foundInList = resList.body.data.find(
          (r) => r._id.toString() === resource._id.toString()
        );
        expect(foundInList).toBeDefined();
        expect(foundInList.moderationStatus).toBe('published');

        // 4. Student A2 opens detail page directly (MUST return 200, ZERO 404s)
        const resDetail = await request(app)
          .get(`/api/v1/dashboards/student/eresources/${resource._id.toString()}`)
          .set('Authorization', `Bearer ${tokenStudentA2}`);
        expect(resDetail.status).toBe(200);
        expect(resDetail.body.success).toBe(true);
        expect(resDetail.body.data._id.toString()).toBe(resource._id.toString());
        expect(resDetail.body.data.moderationStatus).toBe('published');
      });
    });
  });

  describe('[Source: studentDashboardAudit.test.js]', () => {
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
        // await // mongoose.connection.close();
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
          status: 'active',
          isActive: true,
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

        const { generateAccessToken } = require('../utils/token');
        studentToken = generateAccessToken(studentUser);
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
          expect(verified.studentId.toLowerCase()).toBe('stu_audit_001');
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

          const res = await request(app).post('/api/v1/patron-card/verify').send({ token });

          expect(res.statusCode).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data.valid).toBe(true);
          expect(res.body.data.studentId.toLowerCase()).toBe('stu_audit_001');
          expect(res.body.data.name).toBe('Audit Student');
        });

        test('POST /api/patron-card/verify rejects an expired or invalid token', async () => {
          const res = await request(app)
            .post('/api/v1/patron-card/verify')
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
            .get('/api/v1/dashboards/student/loans')
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
            .post(`/api/v1/dashboards/student/loans/${activeLoan._id}/renew`)
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

        test('POST /api/v1/lab/bookings rejects cross-seat double booking for same student in overlapping slot', async () => {
          // 1. Book Seat A
          const res1 = await request(app)
            .post('/api/v1/lab/bookings')
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
            .post('/api/v1/lab/bookings')
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
  });

  describe('[Source: ilsDashboardAndAcquisitions.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_ils_test';
    process.env.JWT_SECRET = 'testjwtlibrarysecretkey999';

    jest.setTimeout(30000);

    const app = require('../app');
    const College = require('../models/College');
    const User = require('../models/User');
    const Book = require('../models/Book');
    const Loan = require('../models/Loan');
    const Reservation = require('../models/Reservation');
    const AcquisitionOrder = require('../models/AcquisitionOrder');
    const { generateTokenPair } = require('../utils/token');

    describe('ILS Dashboard & Acquisitions Module Integration Tests', () => {
      let college;
      let adminUser;
      let adminToken;
      let studentUser;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }

        // Clean up collections
        await Promise.all([
          College.deleteMany({ code: 'ILS_TEST_COL' }),
          User.deleteMany({ email: /@ilstest\.edu/ }),
          AcquisitionOrder.deleteMany({}),
        ]);

        college = await College.create({
          name: 'ILS Test College',
          code: 'ILS_TEST_COL',
          status: 'active',
        });

        adminUser = await User.create({
          name: 'Head Librarian',
          email: 'librarian@ilstest.edu',
          studentId: 'STAFF_LIB_01',
          password: 'Password123!',
          role: 'college-admin',
          collegeId: college._id,
          isActive: true,
          permissions: [
            'canManageAcquisitions',
            'canViewAnalytics',
            'canManagePatrons',
            'canManageCirculation',
            'canManageCatalog',
          ],
        });

        const tokens = generateTokenPair(adminUser);
        adminToken = tokens.accessToken;

        studentUser = await User.create({
          name: 'ILS Student',
          email: 'student@ilstest.edu',
          password: 'Password123!',
          role: 'student',
          studentId: 'ILS_STU_01',
          collegeId: college._id,
          isActive: true,
        });

        // Seed a sample book and loan
        const testBook = await Book.create({
          title: 'Database Systems Implementation',
          author: 'Hector Garcia-Molina',
          isbn: '9780130319951',
          category: 'Computer Science',
          shelfLocation: 'Stacks A-12',
          copies: 5,
          copiesAvailable: 1, // Low stock <= 2
          collegeId: college._id,
        });

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        await Loan.create({
          collegeId: college._id,
          userId: studentUser._id,
          bookId: testBook._id,
          status: 'active',
          issuedBy: adminUser._id,
          maxRenewals: 2,
          borrowDate: new Date(Date.now() - 15 * 86400000),
          dueDate: yesterday, // Overdue
        });

        await Reservation.create({
          collegeId: college._id,
          userId: studentUser._id,
          bookId: testBook._id,
          status: 'queued',
          queuePosition: 1,
        });
      });

      afterAll(async () => {
        await Promise.all([
          College.deleteMany({ code: 'ILS_TEST_COL' }),
          User.deleteMany({ email: /@ilstest\.edu/ }),
          AcquisitionOrder.deleteMany({}),
          Book.deleteMany({ collegeId: college._id }),
          Loan.deleteMany({ collegeId: college._id }),
          Reservation.deleteMany({ collegeId: college._id }),
        ]);
        if (mongoose.connection.readyState !== 0) {
          // await // mongoose.disconnect();
        }
      });

      describe('1. Acquisitions & Serials Endpoints', () => {
        let createdOrderId;

        it('POST /api/v1/acquisitions - should create a new purchase order with multi-item array', async () => {
          const res = await request(app)
            .post('/api/v1/acquisitions')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              vendorName: 'Pearson Academic Press',
              budgetCode: 'CS-DEPT-2026',
              priority: 'high',
              status: 'submitted',
              items: [
                {
                  title: 'Operating Systems: Three Easy Pieces',
                  author: 'Remzi Arpaci-Dusseau',
                  isbn: '9781985086593',
                  quantity: 10,
                  unitPrice: 45.0,
                },
                {
                  title: 'Computer Networking: A Top-Down Approach',
                  author: 'James Kurose',
                  isbn: '9780133594140',
                  quantity: 5,
                  unitPrice: 80.0,
                },
              ],
            });

          expect(res.status).toBe(201);
          expect(res.body.success).toBe(true);
          expect(res.body.data.vendorName).toBe('Pearson Academic Press');
          expect(res.body.data.totalAmount).toBe(850.0); // (10*45) + (5*80) = 450 + 400 = 850
          expect(res.body.data.status).toBe('submitted');
          createdOrderId = res.body.data._id;
        });

        it('GET /api/v1/acquisitions - should list acquisition orders scoped to tenant college', async () => {
          const res = await request(app)
            .get('/api/v1/acquisitions')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThanOrEqual(1);
          expect(res.body.data[0].vendorName).toBe('Pearson Academic Press');
        });

        it('GET /api/v1/acquisitions/stats - should aggregate totalSpent and order counts', async () => {
          const res = await request(app)
            .get('/api/v1/acquisitions/stats')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data.totalOrders).toBeGreaterThanOrEqual(1);
          expect(res.body.data.byStatus.submitted).toBeGreaterThanOrEqual(1);
        });

        it('PATCH /api/v1/acquisitions/:id/status - should transition order status to approved', async () => {
          const res = await request(app)
            .patch(`/api/v1/acquisitions/${createdOrderId}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'approved' });

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data.status).toBe('approved');
          expect(res.body.data.approvedBy).toBeDefined();
        });
      });

      describe('2. Staff Dashboard Widgets & Reports Endpoints', () => {
        it('GET /api/v1/dashboards/college-admin/staff-widgets - should return overdue, holds, low stock, and today activity', async () => {
          const res = await request(app)
            .get('/api/v1/dashboards/college-admin/staff-widgets')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('overdue');
          expect(res.body.data).toHaveProperty('holds');
          expect(res.body.data).toHaveProperty('lowStock');
          expect(res.body.data).toHaveProperty('todayActivity');

          expect(res.body.data.overdue.count).toBeGreaterThanOrEqual(1);
          expect(res.body.data.holds.count).toBeGreaterThanOrEqual(1);
          expect(res.body.data.lowStock.count).toBeGreaterThanOrEqual(1);
        });

        it('GET /api/v1/dashboards/college-admin/reports/circulation - should generate circulation report records', async () => {
          const res = await request(app)
            .get('/api/v1/dashboards/college-admin/reports/circulation')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data.type).toBe('circulation');
          expect(res.body.data.summary).toBeDefined();
          expect(Array.isArray(res.body.data.records)).toBe(true);
        });

        it('GET /api/v1/dashboards/college-admin/reports/inventory - should generate physical inventory report', async () => {
          const res = await request(app)
            .get('/api/v1/dashboards/college-admin/reports/inventory')
            .set('Authorization', `Bearer ${adminToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data.type).toBe('inventory');
          expect(res.body.data.summary.uniqueTitles).toBeGreaterThanOrEqual(1);
        });
      });
    });
  });
});
