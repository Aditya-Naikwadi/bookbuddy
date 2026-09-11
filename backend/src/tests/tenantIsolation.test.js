/**
 * Consolidated Suite: Tenant Isolation & Multi-Tenancy Data Security
 * Merged from:
 *  - scopeToCollegeTenantLeak.test.js
 *  - bookTenantIsolation.test.js
 *  - studentTenantIsolation.test.js
 *  - annotationTenantIsolation.test.js
 *  - crossCollegeSharingSecurity.test.js
 *  - collegeDeepLink.security.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('Tenant Isolation & Multi-Tenancy Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: scopeToCollegeTenantLeak.test.js]', () => {
    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_scopetocollege_test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testjwtlibrarysecretkey999';

    jest.setTimeout(30000);

    const request = require('supertest');
    const mongoose = require('mongoose');
    const connectDB = require('../config/db');
    const app = require('../app');

    const Book = require('../models/Book');
    const EResource = require('../models/EResource');
    const Feedback = require('../models/Feedback');
    const Complaint = require('../models/Complaint');
    const College = require('../models/College');
    const User = require('../models/User');
    const { scopeToCollege } = require('../middlewares/scopeToCollege');

    describe('F0.1 Tenant-Scoping Helper & Plugin Acceptance Tests', () => {
      let collegeA, collegeB;
      let userA, userB;
      let tokenA, tokenB;
      let bookA, bookB;
      let eResourceA, eResourceB;
      let feedbackA, feedbackB;
      let complaintA, complaintB;

      beforeAll(async () => {
        await connectDB();

        collegeA = await College.create({
          name: 'College Alpha F01',
          code: `C_ALPHA_${Date.now()}`,
          status: 'active',
        });

        collegeB = await College.create({
          name: 'College Beta F01',
          code: `C_BETA_${Date.now()}`,
          status: 'active',
        });

        userA = await User.create({
          studentId: `STU_A_${Date.now()}`,
          name: 'Alice Alpha',
          email: `alice_${Date.now()}@alphaf01.edu`,
          password: 'password123',
          role: 'student',
          collegeId: collegeA._id,
        });

        userB = await User.create({
          studentId: `STU_B_${Date.now()}`,
          name: 'Bob Beta',
          email: `bob_${Date.now()}@betaf01.edu`,
          password: 'password123',
          role: 'student',
          collegeId: collegeB._id,
        });

        const { generateAccessToken } = require('../utils/token');
        tokenA = generateAccessToken(userA);
        tokenB = generateAccessToken(userB);

        bookA = await Book.create({
          collegeId: collegeA._id,
          title: 'Alpha Internal Textbook',
          author: 'Author A',
          isbn: `978-${Date.now().toString().slice(-10)}`,
          category: 'Science',
        });

        bookB = await Book.create({
          collegeId: collegeB._id,
          title: 'Beta Internal Textbook',
          author: 'Author B',
          isbn: `978-${(Date.now() + 1).toString().slice(-10)}`,
          category: 'Science',
        });

        eResourceA = await EResource.create({
          collegeId: collegeA._id,
          title: 'Alpha Private E-Resource',
          author: 'Author A',
          type: 'pdf',
          fileUrl: '/uploads/ebooks/testA.pdf',
          category: 'Computer Science',
          source: 'internal',
          moderationStatus: 'approved',
          uploadedBy: userA._id,
        });

        eResourceB = await EResource.create({
          collegeId: collegeB._id,
          title: 'Beta Private E-Resource',
          author: 'Author B',
          type: 'pdf',
          fileUrl: '/uploads/ebooks/testB.pdf',
          category: 'Computer Science',
          source: 'internal',
          moderationStatus: 'approved',
          uploadedBy: userB._id,
        });

        feedbackA = await Feedback.create({
          collegeId: collegeA._id,
          submittedBy: userA._id,
          category: 'general',
          message: 'Alpha feedback content',
          rating: 5,
        });

        feedbackB = await Feedback.create({
          collegeId: collegeB._id,
          submittedBy: userB._id,
          category: 'general',
          message: 'Beta feedback content',
          rating: 4,
        });

        complaintA = await Complaint.create({
          collegeId: collegeA._id,
          submittedBy: userA._id,
          subject: 'Alpha noise complaint',
          description: 'Quiet study area noise level high',
        });

        complaintB = await Complaint.create({
          collegeId: collegeB._id,
          submittedBy: userB._id,
          subject: 'Beta printer complaint',
          description: '3rd floor printer out of paper',
        });
      });

      afterAll(async () => {
        try {
          await Book.deleteMany({ _id: { $in: [bookA._id, bookB._id] } });
          await EResource.deleteMany({ _id: { $in: [eResourceA._id, eResourceB._id] } });
          await Feedback.deleteMany({ _id: { $in: [feedbackA._id, feedbackB._id] } });
          await Complaint.deleteMany({ _id: { $in: [complaintA._id, complaintB._id] } });
          await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
          await College.deleteMany({ _id: { $in: [collegeA._id, collegeB._id] } });
        } catch {
          // Ignore cleanup
        } finally {
          if (mongoose.connection.readyState !== 0) {
            // await // mongoose.connection.close();
          }
        }
      });

      describe('Unit Test: scopeToCollege Helper function', () => {
        test('Should auto-inject collegeId into blank filter', () => {
          const scoped = scopeToCollege({}, collegeA._id);
          expect(scoped.collegeId.toString()).toBe(collegeA._id.toString());
        });

        test('Should preserve original filter properties while attaching collegeId', () => {
          const scoped = scopeToCollege({ category: 'Science' }, collegeA._id);
          expect(scoped.category).toBe('Science');
          expect(scoped.collegeId.toString()).toBe(collegeA._id.toString());
        });
      });

      describe('Model Query Scoping via Plugin', () => {
        test('Model method with query option tenantId returns only same-tenant documents', async () => {
          const booksA = await Book.find({}, null, { tenantId: collegeA._id });
          const bookIds = booksA.map((b) => b._id.toString());
          expect(bookIds).toContain(bookA._id.toString());
          expect(bookIds).not.toContain(bookB._id.toString());
        });

        test('Saving new tenant model document without collegeId throws CRITICAL TENANT ERROR', async () => {
          const invalidBook = new Book({
            title: 'Unassigned College Book',
            author: 'No One',
            isbn: '12345',
            category: 'General',
          });

          await expect(invalidBook.save()).rejects.toThrow(/CRITICAL TENANT ERROR/i);
        });
      });

      describe('Controller API Scoping Regression Tests (Book, EResource, Feedback, Complaint)', () => {
        test('GET /api/v1/books - Should return ONLY College A books for User A', async () => {
          const res = await request(app)
            .get('/api/v1/books')
            .set('Authorization', `Bearer ${tokenA}`);

          expect(res.statusCode).toBe(200);
          const bookIds = res.body.books.map((b) => b.id || b._id);
          expect(bookIds).toContain(bookA._id.toString());
          expect(bookIds).not.toContain(bookB._id.toString());
        });

        test('GET /api/v1/eresources - Should return ONLY College A e-resources for User A', async () => {
          const res = await request(app)
            .get('/api/v1/eresources')
            .set('Authorization', `Bearer ${tokenA}`);

          expect(res.statusCode).toBe(200);
          const ids = res.body.data.map((r) => r._id.toString());
          expect(ids).toContain(eResourceA._id.toString());
          expect(ids).not.toContain(eResourceB._id.toString());
        });

        test('GET /api/v1/feedback - Should return ONLY College A feedback for User A', async () => {
          const res = await request(app)
            .get('/api/v1/feedback')
            .set('Authorization', `Bearer ${tokenA}`);

          expect(res.statusCode).toBe(200);
          const ids = res.body.data.map((f) => f._id.toString());
          expect(ids).toContain(feedbackA._id.toString());
          expect(ids).not.toContain(feedbackB._id.toString());
        });

        test('GET /api/v1/complaints - Should return ONLY User A complaints for User A', async () => {
          const res = await request(app)
            .get('/api/v1/complaints')
            .set('Authorization', `Bearer ${tokenA}`);

          expect(res.statusCode).toBe(200);
          const ids = res.body.data.map((c) => c._id.toString());
          expect(ids).toContain(complaintA._id.toString());
          expect(ids).not.toContain(complaintB._id.toString());
        });
      });
    });
  });

  describe('[Source: bookTenantIsolation.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_tenant_test';
    process.env.JWT_SECRET = 'testjwtlibrarysecretkey999';

    jest.setTimeout(30000);

    const app = require('../app');
    const Book = require('../models/Book');
    const User = require('../models/User');
    const College = require('../models/College');
    const { generateTokenPair } = require('../utils/token');

    describe('Book API & Tenant Isolation Tests', () => {
      let collegeAId, collegeBId;
      let userAToken, userBToken;
      let bookA, bookB;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }

        collegeAId = new mongoose.Types.ObjectId().toString();
        collegeBId = new mongoose.Types.ObjectId().toString();

        // Create test colleges
        await College.create([
          { _id: collegeAId, name: 'College Alpha', code: 'ALPHA', status: 'active' },
          { _id: collegeBId, name: 'College Beta', code: 'BETA', status: 'active' },
        ]);

        // Create test users
        const userA = await User.create({
          name: 'Alice Student',
          email: 'alice@alpha.edu',
          studentId: 'STU_ALPHA_001',
          password: 'Password123!',
          role: 'student',
          collegeId: collegeAId,
          isActive: true,
        });

        const userB = await User.create({
          name: 'Bob Student',
          email: 'bob@beta.edu',
          studentId: 'STU_BETA_002',
          password: 'Password123!',
          role: 'student',
          collegeId: collegeBId,
          isActive: true,
        });

        userAToken = generateTokenPair(userA).accessToken;
        userBToken = generateTokenPair(userB).accessToken;

        // Create test books for each college
        bookA = await Book.create({
          collegeId: collegeAId,
          title: 'Alpha Quantum Physics',
          author: 'Dr. Alpha',
          isbn: '978-1111111111',
          category: 'Physics',
          copiesTotal: 5,
          copiesAvailable: 3,
          format: 'physical',
        });

        bookB = await Book.create({
          collegeId: collegeBId,
          title: 'Beta Machine Learning',
          author: 'Dr. Beta',
          isbn: '978-2222222222',
          category: 'Computer Science',
          copiesTotal: 4,
          copiesAvailable: 0,
          format: 'digital',
        });
      });

      afterAll(async () => {
        if (bookA && bookB) {
          await Book.deleteMany({ _id: { $in: [bookA._id, bookB._id] } });
        }
        await User.deleteMany({ email: { $in: ['alice@alpha.edu', 'bob@beta.edu'] } });
        await College.deleteMany({ _id: { $in: [collegeAId, collegeBId] } });
        // await // mongoose.connection.close();
      });

      describe('1. Canonical Book Shape & Endpoint Contract', () => {
        it('GET /api/v1/college/:id/books returns canonical book shape', async () => {
          const res = await request(app)
            .get(`/api/v1/college/${collegeAId}/books`)
            .set('Authorization', `Bearer ${userAToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThanOrEqual(1);

          const firstBook = res.body.data[0];
          expect(firstBook).toHaveProperty('_id');
          expect(firstBook).toHaveProperty('title');
          expect(firstBook).toHaveProperty('author');
          expect(firstBook).toHaveProperty('isbn');
          expect(firstBook).toHaveProperty('category');
          expect(firstBook).toHaveProperty('coverUrl');
          expect(firstBook).toHaveProperty('collegeId', collegeAId);
          expect(firstBook).toHaveProperty('totalCopies');
          expect(firstBook).toHaveProperty('availableCopies');
          expect(firstBook).toHaveProperty('availabilityStatus');
          expect(firstBook).toHaveProperty('addedAt');
        });

        it('GET /api/v1/college/:id/books/stats returns catalog statistics', async () => {
          const res = await request(app)
            .get(`/api/v1/college/${collegeAId}/books/stats`)
            .set('Authorization', `Bearer ${userAToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data.totalCatalogBooks).toBeGreaterThanOrEqual(1);
        });

        it('GET /api/v1/college/:id/books/new-arrivals returns latest additions', async () => {
          const res = await request(app)
            .get(`/api/v1/college/${collegeAId}/books/new-arrivals`)
            .set('Authorization', `Bearer ${userAToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('GET /api/v1/college/:id/books/batch resolves books by ID', async () => {
          const res = await request(app)
            .get(`/api/v1/college/${collegeAId}/books/batch?ids=${bookA._id}`)
            .set('Authorization', `Bearer ${userAToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data.length).toBe(1);
          expect(res.body.data[0].title).toBe('Alpha Quantum Physics');
        });
      });

      describe('2. Strict Cross-College Tenant Isolation', () => {
        it('User from College A CANNOT fetch College B books (403 Forbidden)', async () => {
          const res = await request(app)
            .get(`/api/v1/college/${collegeBId}/books`)
            .set('Authorization', `Bearer ${userAToken}`);

          expect(res.status).toBe(403);
        });

        it('User from College B CANNOT fetch College A book detail (403 Forbidden)', async () => {
          const res = await request(app)
            .get(`/api/v1/college/${collegeAId}/books/${bookA._id}`)
            .set('Authorization', `Bearer ${userBToken}`);

          expect(res.status).toBe(403);
        });

        it('User from College A only sees College A books in list', async () => {
          const res = await request(app)
            .get(`/api/v1/college/${collegeAId}/books`)
            .set('Authorization', `Bearer ${userAToken}`);

          expect(res.status).toBe(200);
          const titles = res.body.data.map((b) => b.title);
          expect(titles).toContain('Alpha Quantum Physics');
          expect(titles).not.toContain('Beta Machine Learning');
        });
      });
    });
  });

  describe('[Source: studentTenantIsolation.test.js]', () => {
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
            // await // mongoose.connection.close();
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
  });

  describe('[Source: annotationTenantIsolation.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_tenant_test';
    process.env.JWT_SECRET = 'testjwtlibrarysecretkey999';

    jest.setTimeout(30000);

    const app = require('../app');
    const Annotation = require('../models/Annotation');
    const EResource = require('../models/EResource');
    const User = require('../models/User');
    const College = require('../models/College');
    const { generateTokenPair } = require('../utils/token');

    describe('Phase 1: Annotation Tenant Isolation & Security Tests', () => {
      let collegeAId, collegeBId;
      let userA, userB, userC;
      let userAToken, userBToken, userCToken;
      let resourceA;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }

        collegeAId = new mongoose.Types.ObjectId().toString();
        collegeBId = new mongoose.Types.ObjectId().toString();

        // Clean up potential leftover test data across all relevant collections
        await Annotation.deleteMany({});
        await User.deleteMany({
          email: { $in: ['alice.ann@alpha.edu', 'bob.ann@beta.edu', 'charlie.ann@alpha.edu'] },
        });
        await College.deleteMany({ code: { $in: ['ALPHA_UNI', 'BETA_INST'] } });

        await College.create([
          { _id: collegeAId, name: 'Alpha University', code: 'ALPHA_UNI', status: 'active' },
          { _id: collegeBId, name: 'Beta Institute', code: 'BETA_INST', status: 'active' },
        ]);

        userA = await User.create({
          name: 'Alice Student',
          email: 'alice.ann@alpha.edu',
          studentId: 'STU_ANN_001',
          password: 'Password123!',
          role: 'student',
          collegeId: collegeAId,
          isActive: true,
        });

        userB = await User.create({
          name: 'Bob Student',
          email: 'bob.ann@beta.edu',
          studentId: 'STU_ANN_002',
          password: 'Password123!',
          role: 'student',
          collegeId: collegeBId,
          isActive: true,
        });

        userC = await User.create({
          name: 'Charlie Student',
          email: 'charlie.ann@alpha.edu',
          studentId: 'STU_ANN_003',
          password: 'Password123!',
          role: 'student',
          collegeId: collegeAId,
          isActive: true,
        });

        userAToken = generateTokenPair(userA).accessToken;
        userBToken = generateTokenPair(userB).accessToken;
        userCToken = generateTokenPair(userC).accessToken;

        resourceA = await EResource.create({
          collegeId: collegeAId,
          uploadedBy: userA._id,
          category: 'Science',
          type: 'pdf',
          title: 'Physics for Engineers',
          author: 'Dr. Newton',
          fileUrl: 'https://example.com/physics.pdf',
          fileType: 'pdf',
          format: 'pdf',
          accessLevel: 'public',
          status: 'active',
        });
      });

      afterAll(async () => {
        await Annotation.deleteMany({});
        if (resourceA?._id) {
          await EResource.deleteMany({ _id: resourceA._id });
        }
        await User.deleteMany({
          email: { $in: ['alice.ann@alpha.edu', 'bob.ann@beta.edu', 'charlie.ann@alpha.edu'] },
        });
        await College.deleteMany({ _id: { $in: [collegeAId, collegeBId] } });
        // await // mongoose.connection.close();
      });

      describe('1. Tenant Isolation & Ownership Safeguards', () => {
        let annotationA;

        it('Student A creates an annotation for resourceA', async () => {
          const res = await request(app)
            .post(`/api/v1/books/${resourceA._id}/annotations`)
            .set('Authorization', `Bearer ${userAToken}`)
            .send({
              type: 'highlight',
              page: 5,
              highlightText: 'Quantum entanglement basics',
              color: 'yellow',
              clientId: 'client-uuid-001',
            });

          expect(res.status).toBe(201);
          expect(res.body.success).toBe(true);
          expect(res.body.data.userId.toString()).toBe(userA._id.toString());
          expect(res.body.data.collegeId.toString()).toBe(collegeAId.toString());
          annotationA = res.body.data;
        });

        it('Student A posting with spoofed collegeId/userId in body is ignored and forced to token identity', async () => {
          const spoofedCollegeId = new mongoose.Types.ObjectId().toString();
          const spoofedUserId = new mongoose.Types.ObjectId().toString();

          const res = await request(app)
            .post(`/api/v1/books/${resourceA._id}/annotations`)
            .set('Authorization', `Bearer ${userAToken}`)
            .send({
              collegeId: spoofedCollegeId,
              userId: spoofedUserId,
              type: 'bookmark',
              page: 10,
              label: 'Chapter 2 Start',
              clientId: 'client-uuid-002',
            });

          expect(res.status).toBe(201);
          expect(res.body.data.collegeId.toString()).toBe(collegeAId.toString());
          expect(res.body.data.userId.toString()).toBe(userA._id.toString());
        });

        it('Student B (different college) cannot see Student A annotations for resourceA', async () => {
          const res = await request(app)
            .get(`/api/v1/books/${resourceA._id}/annotations`)
            .set('Authorization', `Bearer ${userBToken}`);

          expect(res.status).toBe(200);
          expect(res.body.data).toEqual([]);
        });

        it('Student C (same college, different user) cannot see Student A annotations', async () => {
          const res = await request(app)
            .get(`/api/v1/books/${resourceA._id}/annotations`)
            .set('Authorization', `Bearer ${userCToken}`);

          expect(res.status).toBe(200);
          expect(res.body.data).toEqual([]);
        });

        it('Student B cannot PATCH Student A annotation (404/unauthorized)', async () => {
          const res = await request(app)
            .patch(`/api/v1/annotations/${annotationA._id}`)
            .set('Authorization', `Bearer ${userBToken}`)
            .send({ color: 'pink', noteText: 'Malicious update' });

          expect(res.status).toBe(404);
        });

        it('Student C cannot DELETE Student A annotation (404/unauthorized)', async () => {
          const res = await request(app)
            .delete(`/api/v1/annotations/${annotationA._id}`)
            .set('Authorization', `Bearer ${userCToken}`);

          expect(res.status).toBe(404);
        });

        it('Student A can update their own annotation', async () => {
          const res = await request(app)
            .patch(`/api/v1/annotations/${annotationA._id}`)
            .set('Authorization', `Bearer ${userAToken}`)
            .send({ color: 'green', noteText: 'Added study note' });

          expect(res.status).toBe(200);
          expect(res.body.data.color).toBe('green');
          expect(res.body.data.noteText).toBe('Added study note');
        });
      });

      describe('2. Data Caps & Validation', () => {
        it('Note length exceeding 5000 characters is rejected with HTTP 400', async () => {
          const hugeNote = 'A'.repeat(5001);
          const res = await request(app)
            .post(`/api/v1/books/${resourceA._id}/annotations`)
            .set('Authorization', `Bearer ${userAToken}`)
            .send({
              type: 'note',
              page: 1,
              noteText: hugeNote,
            });

          expect(res.status).toBe(400);
        });

        it('Annotation soft cap limit (500/user/book) returns ANNOTATION_COUNT_LIMIT_REACHED error', async () => {
          const countSpy = jest.spyOn(Annotation, 'countDocuments').mockResolvedValue(500);

          const res = await request(app)
            .post(`/api/v1/books/${resourceA._id}/annotations`)
            .set('Authorization', `Bearer ${userAToken}`)
            .send({
              type: 'highlight',
              page: 2,
              highlightText: 'Cap test',
            });

          countSpy.mockRestore();

          expect(res.status).toBe(400);
          expect(res.body.code).toBe('ANNOTATION_COUNT_LIMIT_REACHED');
        });
      });
    });
  });

  describe('[Source: crossCollegeSharingSecurity.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_cross_college_sec_test';

    const app = require('../app');
    const Book = require('../models/Book');
    const EResource = require('../models/EResource');
    const ShareRequest = require('../models/ShareRequest');
    const User = require('../models/User');
    const College = require('../models/College');
    const { generateAccessToken } = require('../utils/token');

    describe('Cross-College Resource Sharing Security Audit (F6.3, F6.4, F6.5)', () => {
      let collegeA, collegeB, collegeC;
      let adminA, adminB, adminC, studentB;
      let tokenAdminA, tokenAdminB, tokenAdminC, tokenStudentB;
      let shareableBook, nonShareableBook, shareableEResource, nonShareableEResource;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
        await Book.deleteMany({});
        await EResource.deleteMany({});
        await ShareRequest.deleteMany({});
        await User.deleteMany({});
        await College.deleteMany({});

        // Create 3 Colleges
        collegeA = await College.create({
          name: 'College Alpha',
          shortName: 'ALPHA',
          code: `ALPHA_${Date.now()}`,
        });

        collegeB = await College.create({
          name: 'College Beta',
          shortName: 'BETA',
          code: `BETA_${Date.now()}`,
        });

        collegeC = await College.create({
          name: 'College Gamma (Unrelated Third-Party)',
          shortName: 'GAMMA',
          code: `GAMMA_${Date.now()}`,
        });

        // Create Users
        adminA = await User.create({
          studentId: `ADM_A_${Date.now()}`,
          name: 'Admin Alpha',
          email: `admin_a_${Date.now()}@alpha.edu`,
          password: 'password123',
          role: 'college-admin',
          collegeId: collegeA._id,
        });

        adminB = await User.create({
          studentId: `ADM_B_${Date.now()}`,
          name: 'Admin Beta',
          email: `admin_b_${Date.now()}@beta.edu`,
          password: 'password123',
          role: 'college-admin',
          collegeId: collegeB._id,
        });

        adminC = await User.create({
          studentId: `ADM_C_${Date.now()}`,
          name: 'Admin Gamma',
          email: `admin_c_${Date.now()}@gamma.edu`,
          password: 'password123',
          role: 'college-admin',
          collegeId: collegeC._id,
        });

        studentB = await User.create({
          studentId: `STU_B_${Date.now()}`,
          name: 'Student Beta',
          email: `student_b_${Date.now()}@beta.edu`,
          password: 'password123',
          role: 'student',
          collegeId: collegeB._id,
        });

        tokenAdminA = generateAccessToken(adminA);
        tokenAdminB = generateAccessToken(adminB);
        tokenAdminC = generateAccessToken(adminC);
        tokenStudentB = generateAccessToken(studentB);

        // Shareable Book (isShareableAcrossColleges: true)
        shareableBook = await Book.create({
          collegeId: collegeA._id,
          isbn: `ISBN_SH_${Date.now()}`,
          title: 'Shared Algorithms Volume 1',
          author: 'Thomas Cormen',
          category: 'Computer Science',
          isShareableAcrossColleges: true,
        });

        // Non-Shareable Book (isShareableAcrossColleges: false)
        nonShareableBook = await Book.create({
          collegeId: collegeA._id,
          isbn: `ISBN_NSH_${Date.now()}`,
          title: 'Shared Algorithms Volume 2 (Private Campus Edition)',
          author: 'Thomas Cormen',
          category: 'Computer Science',
          isShareableAcrossColleges: false,
        });

        // Shareable EResource
        shareableEResource = await EResource.create({
          collegeId: collegeA._id,
          title: 'Shared Data Science Lab Notes',
          author: 'Alpha Research Lab',
          type: 'pdf',
          category: 'Data Science',
          fileUrl: 'https://storage.example.com/shared.pdf',
          uploadedBy: adminA._id,
          isShareableAcrossColleges: true,
        });

        // Non-Shareable EResource
        nonShareableEResource = await EResource.create({
          collegeId: collegeA._id,
          title: 'Shared Data Science Exam Solutions (Private)',
          author: 'Alpha Research Lab',
          type: 'pdf',
          category: 'Data Science',
          fileUrl: 'https://storage.example.com/private.pdf',
          uploadedBy: adminA._id,
          isShareableAcrossColleges: false,
        });
      });

      afterAll(async () => {
        await Book.deleteMany({});
        await EResource.deleteMany({});
        await ShareRequest.deleteMany({});
        await User.deleteMany({});
        await College.deleteMany({});
        // await // mongoose.connection.close();
      });

      describe('F6.3 — GET /api/v1/catalog/cross-college', () => {
        it('Acceptance Criteria: non-shareable resources NEVER appear in cross-college discovery endpoint, even when matching search query', async () => {
          const res = await request(app)
            .get('/api/v1/catalog/cross-college?q=Algorithms')
            .set('Authorization', `Bearer ${tokenStudentB}`);

          expect(res.statusCode).toBe(200);
          expect(res.body.success).toBe(true);

          const returnedBookIds = res.body.data.books.map((b) => b._id.toString());

          // ACCEPTANCE CRITERIA: Shareable book MUST be included
          expect(returnedBookIds).toContain(shareableBook._id.toString());

          // ACCEPTANCE CRITERIA: Non-shareable book MUST NEVER be included
          expect(returnedBookIds).not.toContain(nonShareableBook._id.toString());
        });
      });

      describe('F6.4 — POST /api/v1/share-requests (Requester Authorization)', () => {
        it('Acceptance Criteria: manipulated request body specifying a different requestingCollegeId is IGNORED by server', async () => {
          const manipulatedCollegeId = new mongoose.Types.ObjectId().toString();

          const res = await request(app)
            .post('/api/v1/share-requests')
            .set('Authorization', `Bearer ${tokenStudentB}`)
            .send({
              resourceId: shareableBook._id,
              resourceType: 'book',
              requestingCollegeId: manipulatedCollegeId, // Manipulated body payload
            });

          expect(res.statusCode).toBe(201);
          expect(res.body.success).toBe(true);

          // ACCEPTANCE CRITERIA: requestingCollegeId in DB document matches studentB's actual collegeId (College B), ignoring client body
          const createdReq = await ShareRequest.findById(res.body.data._id);
          expect(createdReq.requestingCollegeId.toString()).toBe(collegeB._id.toString());
          expect(createdReq.requestingCollegeId.toString()).not.toBe(manipulatedCollegeId);
        });

        it('rejects request creation if target resource is not shareable across colleges', async () => {
          const res = await request(app)
            .post('/api/v1/share-requests')
            .set('Authorization', `Bearer ${tokenStudentB}`)
            .send({
              resourceId: nonShareableBook._id,
              resourceType: 'book',
            });

          expect(res.statusCode).toBe(400);
          expect(res.body.message).toContain('not enabled for cross-college sharing');
        });
      });

      describe('F6.5 — PATCH /api/v1/share-requests/:id (Owning-Admin Authorization)', () => {
        let activeShareRequest;

        beforeEach(async () => {
          await ShareRequest.deleteMany({});
          activeShareRequest = await ShareRequest.create({
            resourceId: shareableBook._id,
            resourceTypeModel: 'Book',
            resourceType: 'book',
            owningCollegeId: collegeA._id,
            requestingCollegeId: collegeB._id,
            requestedBy: studentB._id,
            status: 'requested',
          });
        });

        it('Acceptance Criteria: Admin of College C CANNOT approve or reject a request between College A and College B', async () => {
          // Admin C (Unrelated third-party) attempts to approve request
          const resAdminC = await request(app)
            .patch(`/api/v1/share-requests/${activeShareRequest._id}`)
            .set('Authorization', `Bearer ${tokenAdminC}`)
            .send({ status: 'approved' });

          // ACCEPTANCE CRITERIA: Returns 403 Forbidden
          expect(resAdminC.statusCode).toBe(403);
          expect(resAdminC.body.message).toContain(
            'Only the administrator of the owning college can approve'
          );

          // Verify request status remains unchanged in DB
          const untouchedReq = await ShareRequest.findById(activeShareRequest._id);
          expect(untouchedReq.status).toBe('requested');
        });

        it('allows Admin of College A (owning college) to approve request and appends statusHistory', async () => {
          const resAdminA = await request(app)
            .patch(`/api/v1/share-requests/${activeShareRequest._id}`)
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .send({ status: 'approved' });

          expect(resAdminA.statusCode).toBe(200);
          expect(resAdminA.body.success).toBe(true);

          const updatedReq = await ShareRequest.findById(activeShareRequest._id);
          expect(updatedReq.status).toBe('approved');
          expect(updatedReq.approvedBy.toString()).toBe(adminA._id.toString());
          expect(updatedReq.statusHistory.length).toBeGreaterThan(0);
          expect(updatedReq.statusHistory[updatedReq.statusHistory.length - 1].status).toBe(
            'approved'
          );
        });
      });
    });
  });

  describe('[Source: collegeDeepLink.security.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_test';

    jest.setTimeout(30000);

    const app = require('../app');
    const College = require('../models/College');
    const User = require('../models/User');

    describe('F13 Security Suite — Public By-Slug Endpoint & College Deep Links', () => {
      let collegeA;
      let collegeB;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
        await College.deleteMany({ code: { $in: ['SPRING-01', 'SHELBY-01'] } });

        collegeA = await College.create({
          name: 'Springfield College',
          code: 'SPRING-01',
          slug: 'springfield-college',
          status: 'active',
          enabledFeatures: ['catalog', 'readingLists', 'bulletinBoard'],
        });

        collegeB = await College.create({
          name: 'Shelbyville Institute',
          code: 'SHELBY-01',
          slug: 'shelbyville-institute',
          status: 'active',
          enabledFeatures: ['catalog', 'loans'],
        });
      });

      afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
          await College.deleteMany({ code: { $in: ['SPRING-01', 'SHELBY-01'] } });
          // await // mongoose.connection.close();
        }
      });

      describe('F13.4 — Public GET /api/v1/colleges/by-slug/:slug payload over-fetching protection', () => {
        it('returns 200 with strictly ONLY name, slug, and enabledFeatures in data', async () => {
          const res = await request(app).get('/api/v1/colleges/by-slug/springfield-college');

          expect(res.statusCode).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data).toBeDefined();

          const keys = Object.keys(res.body.data);
          expect(keys.sort()).toEqual(['enabledFeatures', 'name', 'slug']);

          expect(res.body.data.name).toBe('Springfield College');
          expect(res.body.data.slug).toBe('springfield-college');
          expect(Array.isArray(res.body.data.enabledFeatures)).toBe(true);

          // Verify ZERO over-fetching of sensitive fields
          expect(res.body.data._id).toBeUndefined();
          expect(res.body.data.collegeId).toBeUndefined();
          expect(res.body.data.adminUserId).toBeUndefined();
          expect(res.body.data.contactEmail).toBeUndefined();
          expect(res.body.data.creationPath).toBeUndefined();
        });

        it('returns 404 for non-existent college slug', async () => {
          const res = await request(app).get('/api/v1/colleges/by-slug/non-existent-slug');
          expect(res.statusCode).toBe(404);
          expect(res.body.success).toBe(false);
        });
      });

      describe('F13.1 — College Slug Generation & Deduplication', () => {
        it('automatically generates unique slugs on college creation', async () => {
          const col1 = await College.create({
            name: 'Metropolis State University',
            code: 'METRO-01',
          });
          const col2 = await College.create({
            name: 'Metropolis State University',
            code: 'METRO-02',
          });

          expect(col1.slug).toBe('metropolis-state-university');
          expect(col2.slug).toBe('metropolis-state-university-1');
        });
      });
    });
  });
});
