process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_phase2_opt_test';
process.env.JWT_SECRET = 'test_jwt_secret_phase2_opt';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_phase2_opt';
jest.setTimeout(60000);

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const EResource = require('../models/EResource');
const Review = require('../models/Review');
const ReadingProgress = require('../models/ReadingProgress');
const { generateTokenPair } = require('../utils/token');
const { getCache, setCache } = require('../utils/redisCache');

describe('Phase 2 Performance & UX Optimizations Verification Suite', () => {
  let college;
  let collegeAdmin;
  let studentUser;
  let adminToken;
  let studentToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    await College.deleteMany({});
    await User.deleteMany({});
    await Book.deleteMany({});
    await EResource.deleteMany({});
    await Review.deleteMany({});
    await Loan.deleteMany({});
    await ReadingProgress.deleteMany({});

    college = await College.create({
      name: 'Phase 2 Test University',
      code: `P2U_${Date.now()}`,
      status: 'active',
      isActive: true,
    });

    collegeAdmin = await User.create({
      name: 'College Admin',
      studentId: 'ADM-P2-01',
      email: 'admin.p2@test.edu',
      password: 'password123',
      role: 'college-admin',
      collegeId: college._id,
      department: 'Library Science',
      status: 'active',
      isActive: true,
    });
    adminToken = generateTokenPair(collegeAdmin).accessToken;

    studentUser = await User.create({
      name: 'Alice Wonder',
      studentId: 'STU-P2-100',
      email: 'alice.wonder@test.edu',
      password: 'password123',
      role: 'student',
      collegeId: college._id,
      department: 'Computer Science',
      status: 'active',
      isActive: true,
    });
    studentToken = generateTokenPair(studentUser).accessToken;
  });

  afterAll(async () => {
    await College.deleteMany({});
    await User.deleteMany({});
    await Book.deleteMany({});
    await EResource.deleteMany({});
    await Review.deleteMany({});
    await Loan.deleteMany({});
    await ReadingProgress.deleteMany({});
    await mongoose.disconnect();
  });

  describe('Item 13 & 19: Email/StudentId Normalization & Explicit Tenant Requirement', () => {
    it('Item 19: should reject registration when collegeId is omitted for non-super-admin', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'No College User',
        studentId: 'STU-NO-COLLEGE',
        email: 'no.college@test.edu',
        password: 'password123',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/College selection is required/i);
    });

    it('Item 13: should normalize email and studentId to lowercase on save', async () => {
      const mixedStudent = await User.create({
        name: 'Bob MixedCase',
        studentId: 'STU-MiXeD-99',
        email: 'BoB.MiXeD@Test.Edu',
        password: 'password123',
        role: 'student',
        collegeId: college._id,
      });

      expect(mixedStudent.studentId).toBe('stu-mixed-99');
      expect(mixedStudent.email).toBe('bob.mixed@test.edu');

      // Login using uppercase variation against normalized compound index
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        studentId: 'STU-MIXED-99',
        password: 'password123',
        collegeId: college._id.toString(),
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.user.email).toBe('bob.mixed@test.edu');
      expect(loginRes.body.user.studentId).toBe('stu-mixed-99');
    });
  });

  describe('Item 14: Keyset/Cursor Pagination on GET /books & Redis Count Caching', () => {
    beforeAll(async () => {
      const booksToCreate = [];
      const baseTime = Date.now() - 50000;
      for (let i = 1; i <= 15; i++) {
        booksToCreate.push({
          collegeId: college._id,
          title: `Keyset Book Volume ${String(i).padStart(2, '0')}`,
          author: `Author ${i}`,
          isbn: `97800011122${String(i).padStart(2, '0')}`,
          category: 'Engineering',
          format: 'physical',
          copiesTotal: 3,
          copiesAvailable: 3,
          createdAt: new Date(baseTime + i * 1000),
        });
      }
      await Book.insertMany(booksToCreate);
    });

    it('should paginate via keyset cursor, return nextCursor, and cache total count', async () => {
      // First page
      const page1Res = await request(app)
        .get('/api/v1/books?limit=5&sortBy=newest')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.success).toBe(true);
      expect(page1Res.body.books.length).toBe(5);
      expect(page1Res.body.pagination.hasMore).toBe(true);
      expect(page1Res.body.pagination.nextCursor).toBeDefined();
      expect(page1Res.body.total).toBe(15);

      const cursor1 = page1Res.body.pagination.nextCursor;
      const page1Titles = page1Res.body.books.map((b) => b.title);

      // Second page with cursor
      const page2Res = await request(app)
        .get(`/api/v1/books?limit=5&sortBy=newest&cursor=${encodeURIComponent(cursor1)}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.success).toBe(true);
      expect(page2Res.body.books.length).toBe(5);
      const page2Titles = page2Res.body.books.map((b) => b.title);

      // Verify no overlap between page 1 and page 2
      expect(page2Titles.some((t) => page1Titles.includes(t))).toBe(false);
    });
  });

  describe('Item 15: Compound Index & Cursor Pagination on EResource', () => {
    beforeAll(async () => {
      const eresourcesToCreate = [];
      const baseTime = Date.now() - 50000;
      for (let i = 1; i <= 8; i++) {
        eresourcesToCreate.push({
          collegeId: college._id,
          title: `Digital Resource ${String(i).padStart(2, '0')}`,
          author: `Digital Author ${i}`,
          type: 'pdf',
          fileUrl: `/uploads/test-${i}.pdf`,
          category: 'Computer Science',
          uploadedBy: collegeAdmin._id,
          moderationStatus: 'approved',
          source: 'internal',
          createdAt: new Date(baseTime + i * 1000),
        });
      }
      await EResource.insertMany(eresourcesToCreate);
    });

    it('should paginate EResources using cursor and return nextCursor', async () => {
      const res1 = await request(app)
        .get('/api/v1/eresources?limit=4')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.length).toBe(4);
      expect(res1.body.pagination.hasMore).toBe(true);
      expect(res1.body.pagination.nextCursor).toBeDefined();

      const nextCursor = res1.body.pagination.nextCursor;

      const res2 = await request(app)
        .get(`/api/v1/eresources?limit=4&cursor=${encodeURIComponent(nextCursor)}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data.length).toBe(4);
      expect(res2.body.pagination.hasMore).toBe(false);
    });
  });

  describe('Item 16: Reading Progress Short-Circuited Verification', () => {
    let testBook;
    beforeAll(async () => {
      testBook = await Book.create({
        collegeId: college._id,
        title: 'Algorithms in Go',
        author: 'Go Author',
        isbn: `9780009998811`,
        category: 'Tech',
        copiesTotal: 1,
        copiesAvailable: 0,
      });

      // User has an active loan
      await Loan.create({
        collegeId: college._id,
        userId: studentUser._id,
        bookId: testBook._id,
        status: 'active',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 86400000),
        issuedBy: collegeAdmin._id,
        maxRenewals: 2,
      });
    });

    it('should verify access on first save and short-circuit subsequent saves via Redis/record shortcut', async () => {
      // First save: Full verification & cache write
      const save1 = await request(app)
        .put(`/api/v1/reading-progress/${testBook._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ position: 'page-10', percentageComplete: 10 });

      expect(save1.status).toBe(200);
      expect(save1.body.success).toBe(true);

      // Verify cached in Redis
      const cacheKey = `reading_access:${studentUser._id}:${testBook._id}`;
      const cached = await getCache(cacheKey);
      expect(cached).toBeDefined();
      expect(cached.hasAccess).toBe(true);

      // Second save: Short-circuits with 0 DB access checks
      const save2 = await request(app)
        .put(`/api/v1/reading-progress/${testBook._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ position: 'page-25', percentageComplete: 25 });

      expect(save2.status).toBe(200);
      expect(save2.body.success).toBe(true);
      expect(save2.body.data.position).toBe('page-25');
    });
  });

  describe('Item 17: College Admin Patron Search & Department Filtering', () => {
    beforeAll(async () => {
      await User.create([
        {
          name: 'Charles Babbage',
          studentId: 'STU-BABBAGE-01',
          email: 'babbage@test.edu',
          password: 'password123',
          role: 'student',
          collegeId: college._id,
          department: 'Mechanical',
          status: 'active',
        },
        {
          name: 'Ada Lovelace',
          studentId: 'STU-LOVELACE-02',
          email: 'ada@test.edu',
          password: 'password123',
          role: 'student',
          collegeId: college._id,
          department: 'Mathematics',
          status: 'active',
        },
      ]);
    });

    it('should filter patrons by department parameter', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/college-admin/patrons?department=Mathematics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Ada Lovelace');
    });

    it('should filter patrons by studentId parameter', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/college-admin/patrons?studentId=STU-BABBAGE-01')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Charles Babbage');
    });
  });

  describe('Item 18: Denormalized ratingSummary on Book with Incremental Updates', () => {
    let ratedBook;
    let reviewId;

    beforeAll(async () => {
      ratedBook = await Book.create({
        collegeId: college._id,
        title: 'Microservices Patterns',
        author: 'Chris Richardson',
        isbn: `9780002223344`,
        category: 'Architecture',
        copiesTotal: 5,
        copiesAvailable: 5,
      });
    });

    it('should incrementally update ratingSummary on review create', async () => {
      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          bookId: ratedBook._id.toString(),
          rating: 5,
          title: 'Masterpiece',
          comment: 'Essential reading for distributed architectures.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      reviewId = res.body.data._id;

      // Verify denormalized on Book
      const updatedBook = await Book.findById(ratedBook._id);
      expect(updatedBook.ratingSummary).toBeDefined();
      expect(updatedBook.ratingSummary.count).toBe(1);
      expect(updatedBook.ratingSummary.average).toBe(5);
      expect(updatedBook.ratingSummary.distribution[5]).toBe(1);
      expect(updatedBook.avgRating).toBe(5);
      expect(updatedBook.ratingCount).toBe(1);
    });

    it('should fetch reviews in O(1) time returning denormalized ratingSummary', async () => {
      const res = await request(app)
        .get(`/api/v1/books/${ratedBook._id}/reviews`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.averageRating).toBe(5);
      expect(res.body.summary.totalReviews).toBe(1);
      expect(res.body.summary.breakdown[5]).toBe(1);
    });

    it('should incrementally adjust ratingSummary on review update', async () => {
      const res = await request(app)
        .put(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          rating: 3,
          title: 'Good but dense',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedBook = await Book.findById(ratedBook._id);
      expect(updatedBook.ratingSummary.count).toBe(1);
      expect(updatedBook.ratingSummary.average).toBe(3);
      expect(updatedBook.ratingSummary.distribution[5]).toBe(0);
      expect(updatedBook.ratingSummary.distribution[3]).toBe(1);
    });

    it('should incrementally adjust ratingSummary on review delete', async () => {
      const res = await request(app)
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedBook = await Book.findById(ratedBook._id);
      expect(updatedBook.ratingSummary.count).toBe(0);
      expect(updatedBook.ratingSummary.average).toBe(0);
      expect(updatedBook.ratingSummary.distribution[3]).toBe(0);
    });
  });
});
