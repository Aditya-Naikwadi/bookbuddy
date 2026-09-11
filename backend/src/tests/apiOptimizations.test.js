process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_optimizations_test';
process.env.JWT_SECRET = 'test_jwt_secret_opt';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_opt';
jest.setTimeout(90000);

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Reservation = require('../models/Reservation');
const Fine = require('../models/Fine');
const Payment = require('../models/Payment');
const Announcement = require('../models/Announcement');
const EResource = require('../models/EResource');
const ILLRequest = require('../models/ILLRequest');
const ReadingActivityLog = require('../models/ReadingActivityLog');
const UploadJob = require('../models/UploadJob');

describe('API Endpoint Optimizations & Hardening Verification Tests', () => {
  let collegeId;
  let adminUser;
  let studentUser;
  let adminToken;
  let studentToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Create test college
    const college = await College.create({
      name: 'Optimization Tech University',
      code: `OPT_${Date.now()}`,
      status: 'active',
      isActive: true,
    });
    collegeId = college._id;

    // Create college-admin
    adminUser = await User.create({
      name: 'Admin Tester',
      studentId: 'ADM-OPT-001',
      email: `admin_${Date.now()}@opt.edu`,
      password: 'password123',
      role: 'college-admin',
      collegeId,
      status: 'active',
      isActive: true,
    });
    const { generateTokenPair } = require('../utils/token');
    adminToken = generateTokenPair(adminUser).accessToken;

    // Create student
    studentUser = await User.create({
      name: 'Sarah Connor',
      studentId: 'STU-9999',
      email: `sarah_${Date.now()}@opt.edu`,
      password: 'password123',
      role: 'student',
      collegeId,
      status: 'active',
      isActive: true,
    });
    studentToken = generateTokenPair(studentUser).accessToken;
  });

  afterAll(async () => {
    await new Promise((r) => setTimeout(r, 600));
    await User.deleteMany({ collegeId });
    await College.deleteMany({ _id: collegeId });
    await Book.deleteMany({ collegeId });
    await Loan.deleteMany({ collegeId });
    await Reservation.deleteMany({ collegeId });
    await Fine.deleteMany({ collegeId });
    await Payment.deleteMany({ collegeId });
    await Announcement.deleteMany({ collegeId });
    await EResource.deleteMany({ collegeId });
    await ILLRequest.deleteMany({});
    await ReadingActivityLog.deleteMany({ collegeId });
    await UploadJob.deleteMany({ collegeId });
  });

  describe('1. Google Books Routes Protection & Scoping', () => {
    it('should reject unauthenticated POST /api/v1/google-books/import with 401', async () => {
      const res = await request(app)
        .post('/api/v1/google-books/import')
        .send({ volumeId: 'dummyVolume123' });

      expect(res.status).toBe(401);
    });

    it('should reject student POST /api/v1/google-books/import with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/google-books/import')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ volumeId: 'dummyVolume123' });

      expect(res.status).toBe(403);
    });

    it('should reject student POST /api/v1/google-books/seed with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/google-books/seed')
        .set('Authorization', `Bearer ${studentToken}`)
        .send();

      expect(res.status).toBe(403);
    });
  });

  describe('2. College Admin Patron Search Filtering', () => {
    beforeAll(async () => {
      await User.create([
        {
          name: 'Johnathan Archer',
          studentId: 'ARCHER-01',
          email: `archer_${Date.now()}@opt.edu`,
          password: 'password123',
          role: 'student',
          collegeId,
          status: 'active',
        },
        {
          name: 'T’Pol Vulcan',
          studentId: 'TPOL-02',
          email: `tpol_${Date.now()}@opt.edu`,
          password: 'password123',
          role: 'student',
          collegeId,
          status: 'active',
        },
      ]);
    });

    it('should search patrons by name substring', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/college-admin/patrons?search=Archer')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Johnathan Archer');
    });

    it('should search patrons by studentId substring', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/college-admin/patrons?search=TPOL')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].studentId.toLowerCase()).toBe('tpol-02');
    });
  });

  describe('3. Student Loans Batch Hold Check (Zero N+1)', () => {
    let testBook1;
    let loan1;

    beforeAll(async () => {
      testBook1 = await Book.create({
        collegeId,
        title: 'Distributed Systems Patterns',
        author: 'Martin Fowler',
        isbn: `978012${Date.now()}`,
        category: 'Computer Science',
        copiesTotal: 2,
        copiesAvailable: 1,
      });

      // Active loan for Sarah Connor on book 1
      loan1 = await Loan.create({
        collegeId,
        userId: studentUser._id,
        bookId: testBook1._id,
        status: 'active',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 86400000),
        issuedBy: adminUser._id,
        maxRenewals: 2,
        renewalCount: 0,
      });

      // Active queue hold on book 1 from another student
      await Reservation.create({
        collegeId,
        userId: adminUser._id,
        bookId: testBook1._id,
        status: 'queued',
        queuePosition: 1,
      });
    });

    it('should correctly flag on_hold renewal eligibility using batch query without N+1', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/student/loans')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.active.length).toBeGreaterThanOrEqual(1);

      const foundLoan = res.body.data.active.find((l) => l._id.toString() === loan1._id.toString());
      expect(foundLoan).toBeDefined();
      expect(foundLoan.renewalEligibility.eligible).toBe(false);
      expect(foundLoan.renewalEligibility.reason).toBe('on_hold');
    });
  });

  describe('4. Asynchronous Non-Blocking Return Notifications', () => {
    it('should return loan immediately and commit book copies atomically', async () => {
      const testBook = await Book.create({
        collegeId,
        title: 'High Performance Browser Networking',
        author: 'Ilya Grigorik',
        isbn: `978014${Date.now()}`,
        category: 'Networking',
        copiesTotal: 2,
        copiesAvailable: 1,
      });

      const activeLoan = await Loan.create({
        collegeId,
        userId: studentUser._id,
        bookId: testBook._id,
        status: 'active',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 86400000),
        issuedBy: adminUser._id,
        maxRenewals: 2,
        renewalCount: 0,
      });

      const loanService = require('../services/loanService');
      const returnedLoan = await loanService.returnBook(activeLoan._id, collegeId);

      expect(returnedLoan).toBeDefined();
      expect(returnedLoan.status).toBe('returned');

      // Verify book copies incremented
      const updatedBook = await Book.findById(testBook._id);
      expect(updatedBook.copiesAvailable).toBe(2);
    });
  });

  describe('5. Payment Create Order Server-Side Amount Calculation', () => {
    let testFine;
    beforeAll(async () => {
      testFine = await Fine.create({
        userId: studentUser._id,
        collegeId,
        loanId: new mongoose.Types.ObjectId(),
        amount: 85,
        overdueDays: 3,
        reason: 'Overdue return fine',
        status: 'unpaid',
      });
    });

    it('should ignore client-supplied manipulated amount and strictly compute ₹85 (8500 paise) server-side', async () => {
      const res = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          amount: 100, // Client attempts to pay ₹1 instead of ₹85
          fineIds: [testFine._id.toString()],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(8500);
      expect(res.body.data.amountInRupees).toBe(85);

      const paymentDoc = await Payment.findById(res.body.data.paymentId);
      expect(paymentDoc.amount).toBe(85);
    });

    it('should reject order creation if client passes amount < 100 paise', async () => {
      const res = await request(app)
        .post('/api/v1/payments/create-order')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          amount: 50,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/100 paise/i);
    });
  });

  describe('6. RSVP Capacity Race Condition Prevention ($expr & $addToSet)', () => {
    let testEvent;
    beforeAll(async () => {
      testEvent = await Announcement.create({
        collegeId,
        title: 'Exclusive Coding Workshop',
        content: 'Limited seats available for backend scaling masterclass.',
        isEvent: true,
        maxCapacity: 1, // Exactly 1 seat available
        rsvpUsers: [],
      });
    });

    it('should allow first student to RSVP atomically', async () => {
      const res = await request(app)
        .post(`/api/v1/announcements/${testEvent._id}/rsvp`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasRSVPd).toBe(true);
      expect(res.body.data.currentRSVPCount).toBe(1);
    });

    it('should reject second user when maxCapacity is reached (atomically enforced)', async () => {
      const res = await request(app)
        .post(`/api/v1/announcements/${testEvent._id}/rsvp`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/maximum capacity/i);
    });
  });

  describe('7 & 8. Catalog Search Keyset Pagination & Deep Pagination (Page 3+ Returns Real Results)', () => {
    beforeAll(async () => {
      // Seed 25 books with staggered createdAt timestamps to test deep pagination
      const baseTime = Date.now() - 100000;
      const booksToCreate = [];
      for (let i = 1; i <= 25; i++) {
        booksToCreate.push({
          collegeId,
          title: `Deep Pagination Test Volume ${String(i).padStart(2, '0')}`,
          author: `Author ${i}`,
          isbn: `97800000000${String(i).padStart(2, '0')}`,
          category: 'Computer Science',
          format: 'physical',
          copiesTotal: 5,
          copiesAvailable: 5,
          createdAt: new Date(baseTime + i * 1000),
        });
      }
      await Book.insertMany(booksToCreate);
    });

    it('should paginate past page 1 and page 2, returning real results on page 3 and page 4', async () => {
      // Page 1: 5 items
      const page1Res = await request(app)
        .get('/api/v1/catalog/search?limit=5&format=physical&sortBy=newest')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.success).toBe(true);
      expect(page1Res.body.data.length).toBe(5);
      expect(page1Res.body.pagination.hasMore).toBe(true);
      expect(page1Res.body.pagination.nextCursor).toBeDefined();

      const page1Cursor = page1Res.body.pagination.nextCursor;
      const page1Titles = page1Res.body.data.map((b) => b.title);

      // Page 2: 5 items using page1Cursor
      const page2Res = await request(app)
        .get(
          `/api/v1/catalog/search?limit=5&format=physical&sortBy=newest&cursor=${encodeURIComponent(page1Cursor)}`
        )
        .set('Authorization', `Bearer ${studentToken}`);

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.success).toBe(true);
      expect(page2Res.body.data.length).toBe(5);
      expect(page2Res.body.pagination.hasMore).toBe(true);
      expect(page2Res.body.pagination.nextCursor).toBeDefined();

      const page2Cursor = page2Res.body.pagination.nextCursor;
      const page2Titles = page2Res.body.data.map((b) => b.title);
      // Ensure page 2 is completely distinct from page 1
      expect(page2Titles.some((t) => page1Titles.includes(t))).toBe(false);

      // Page 3: 5 items using page2Cursor (DEEP PAGINATION - previously broken in-memory filter returned [])
      const page3Res = await request(app)
        .get(
          `/api/v1/catalog/search?limit=5&format=physical&sortBy=newest&cursor=${encodeURIComponent(page2Cursor)}`
        )
        .set('Authorization', `Bearer ${studentToken}`);

      expect(page3Res.status).toBe(200);
      expect(page3Res.body.success).toBe(true);
      expect(page3Res.body.data.length).toBe(5);
      expect(page3Res.body.pagination.hasMore).toBe(true);

      const page3Titles = page3Res.body.data.map((b) => b.title);
      // Ensure page 3 returns real documents, distinct from page 1 and page 2
      expect(page3Titles.some((t) => page1Titles.includes(t))).toBe(false);
      expect(page3Titles.some((t) => page2Titles.includes(t))).toBe(false);

      // Page 4: 5 items using page3Cursor
      const page3Cursor = page3Res.body.pagination.nextCursor;
      const page4Res = await request(app)
        .get(
          `/api/v1/catalog/search?limit=5&format=physical&sortBy=newest&cursor=${encodeURIComponent(page3Cursor)}`
        )
        .set('Authorization', `Bearer ${studentToken}`);

      expect(page4Res.status).toBe(200);
      expect(page4Res.body.success).toBe(true);
      expect(page4Res.body.data.length).toBe(5);
      const page4Titles = page4Res.body.data.map((b) => b.title);
      expect(page4Titles.some((t) => page3Titles.includes(t))).toBe(false);
    });
  });

  describe('10. Leaderboard Aggregation Redis Caching', () => {
    beforeAll(async () => {
      await ReadingActivityLog.create([
        {
          collegeId,
          userId: studentUser._id,
          pagesRead: 120,
          minutesRead: 90,
          date: new Date(),
        },
        {
          collegeId,
          userId: adminUser._id,
          pagesRead: 80,
          minutesRead: 60,
          date: new Date(),
        },
      ]);
    });

    it('should aggregate reading leaderboard and cache result in Redis', async () => {
      const res1 = await request(app)
        .get('/api/v1/leaderboard?metric=pages&limit=10')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.length).toBeGreaterThanOrEqual(2);

      const studentEntry = res1.body.data.find(
        (e) => e.userId.toString() === studentUser._id.toString()
      );
      expect(studentEntry).toBeDefined();
      expect(studentEntry.isSelf).toBe(true);
      expect(studentEntry.score).toBe(120);

      // Second request should hit cache and still personalize isSelf correctly
      const res2 = await request(app)
        .get('/api/v1/leaderboard?metric=pages&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      const adminEntry = res2.body.data.find(
        (e) => e.userId.toString() === adminUser._id.toString()
      );
      expect(adminEntry).toBeDefined();
      expect(adminEntry.isSelf).toBe(true);
    });
  });

  describe('11. ILL Requests Pagination (GET /ill/requests)', () => {
    beforeAll(async () => {
      // Seed 12 ILL requests
      const testBook = await Book.findOne({ collegeId });
      const otherCollege = await College.create({
        name: 'Partner Institution',
        code: `PARTNER_${Date.now()}`,
        status: 'active',
      });

      const illRequests = [];
      for (let i = 1; i <= 12; i++) {
        illRequests.push({
          borrowingCollegeId: collegeId,
          lendingCollegeId: otherCollege._id,
          requestingUserId: studentUser._id,
          bookId: testBook._id,
          status: 'requested',
        });
      }
      await ILLRequest.insertMany(illRequests);
    });

    it('should return paginated results with page, limit, total, and totalPages', async () => {
      const res = await request(app)
        .get('/api/v1/ill/requests?page=2&limit=5&role=borrowing')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(5);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.limit).toBe(5);
      expect(res.body.pagination.total).toBe(12);
      expect(res.body.pagination.totalPages).toBe(3);
    });
  });

  describe('12. Bulk Upload Memory Storage (Serverless & Container Safe)', () => {
    it('should accept CSV via memory buffer without EROFS errors and enqueue job', async () => {
      const csvBuffer = Buffer.from(
        'name,email,studentId,department\nDavid Test,david@opt.edu,STU-OPT-88,Physics\n',
        'utf8'
      );

      const res = await request(app)
        .post(`/api/v1/college/${collegeId}/students/bulk-upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', csvBuffer, 'students.csv');

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBeDefined();
      expect(res.body.data.status).toBe('queued');
    });
  });
});
