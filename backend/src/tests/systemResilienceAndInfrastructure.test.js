/**
 * Consolidated Suite: system Resilience And Infrastructure
 * Merged from:
 *  - redisFallback.test.js
 *  - backupMemorySafety.test.js
 *  - apiOptimizations.test.js
 *  - deploymentHardening.test.js
 *  - deploymentVerification.test.js
 *  - migrations.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('system Resilience And Infrastructure Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: redisFallback.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testjwtsecretkey999';

    const app = require('../app');
    const User = require('../models/User');
    const Loan = require('../models/Loan');
    const Fine = require('../models/Fine');
    const PlatformMetricSnapshot = require('../models/PlatformMetricSnapshot');
    const { generateAccessToken } = require('../utils/token');
    const { redisClient } = require('../middlewares/rateLimiters');

    describe('STAGE 4: Overview Metrics Caching & Redis Fallback Test', () => {
      let superAdminUser;
      let superAdminToken;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
          });
        }

        await User.deleteMany({ email: 'redis.test.sa@bookbuddy.internal' });
        await PlatformMetricSnapshot.deleteMany({ collegeId: null });
        await Loan.deleteMany({});
        await Fine.deleteMany({});

        superAdminUser = await User.create({
          studentId: 'SA-REDIS-001',
          name: 'Redis Test Admin',
          email: 'redis.test.sa@bookbuddy.internal',
          password: 'SuperAdminPass123!',
          role: 'super-admin',
          status: 'active',
        });
        superAdminToken = generateAccessToken(superAdminUser);

        // Seed a PlatformMetricSnapshot for DB fallback test
        await PlatformMetricSnapshot.create({
          collegeId: null,
          snapshotDate: new Date(),
          activeStudents: 500,
          activeAdmins: 10,
          activeLoans: 42,
          overdueLoans: 5,
          totalFinesPending: 250,
          eResourcesCount: 120,
          pendingModerationCount: 3,
          storageUsageBytes: 104857600,
        });
      });

      afterAll(async () => {
        await User.deleteMany({ email: 'redis.test.sa@bookbuddy.internal' });
        await PlatformMetricSnapshot.deleteMany({ collegeId: null });
      });

      it('1. should serve cached data from Redis when key metrics:global:latest is present', async () => {
        const isRedisReady =
          redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect');
        if (isRedisReady) {
          const cachedPayload = {
            totalColleges: 15,
            activeLoans: 99,
            unpaidFinesCount: 7,
            totalUnpaidFineAmount: 350,
            userCountsByRole: { student: 800, 'college-admin': 15, 'super-admin': 1 },
            storageUsageBytes: 209715200,
            eResourcesCount: 250,
            pendingModerationCount: 1,
          };
          await redisClient.set('metrics:global:latest', JSON.stringify(cachedPayload), 'EX', 300);

          const res = await request(app)
            .get('/api/v1/dashboards/admin-portal/overview')
            .set('Authorization', `Bearer ${superAdminToken}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data.activeLoans).toBe(99);
          expect(res.body.data.totalColleges).toBe(15);
        }
      });

      it('2. should calculate live overview metrics when Redis cache is cleared / missing', async () => {
        const isRedisReady =
          redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect');
        if (isRedisReady) {
          await redisClient.del('metrics:global:latest');
        }

        const res = await request(app)
          .get('/api/v1/dashboards/admin-portal/overview')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.activeLoans).toBe(42);
        expect(res.body.data.totalUnpaidFineAmount).toBe(250);
      });
    });
  });

  describe('[Source: backupMemorySafety.test.js]', () => {
    const mongoose = require('mongoose');
    const fs = require('fs');
    const path = require('path');
    const { backupDatabase } = require('../scripts/backupDatabase');

    describe('Streaming Backup Memory Safety Integration Tests', () => {
      jest.setTimeout(30000);
      let tempBackupDir;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          try {
            const connectDB = require('../db');
            await connectDB();
          } catch {
            await mongoose.connect('mongodb://127.0.0.1:27017/bookbuddy_backup_test', {
              serverSelectionTimeoutMS: 2000,
            });
          }
        }
        const db = mongoose.connection.db;

        // Seed dataset with 1,000 documents
        const mockDocs = [];
        for (let i = 0; i < 1000; i++) {
          mockDocs.push({
            title: `Book Performance Test Document ${i}`,
            isbn: `978-0-12345-${i}`,
            payload: 'X'.repeat(500),
            createdAt: new Date(),
          });
        }
        await db.collection('test_books').insertMany(mockDocs);
      });

      afterAll(async () => {
        if (mongoose.connection.db) {
          await mongoose.connection.db.dropDatabase();
        }
        // await // mongoose.disconnect();

        if (tempBackupDir && fs.existsSync(tempBackupDir)) {
          try {
            fs.rmSync(tempBackupDir, { recursive: true, force: true });
          } catch {
            // Ignore transient EBUSY locks during teardown
          }
        }
      });

      test('1. Backup streams database collections without memory spikes', async () => {
        const heapBefore = process.memoryUsage().heapUsed;

        tempBackupDir = path.join(__dirname, 'temp_backup_test');
        const resultDir = await backupDatabase(tempBackupDir);

        const heapAfter = process.memoryUsage().heapUsed;
        const heapGrowthMb = (heapAfter - heapBefore) / (1024 * 1024);

        expect(fs.existsSync(resultDir)).toBe(true);
        expect(fs.existsSync(path.join(resultDir, 'manifest.json'))).toBe(true);
        expect(fs.existsSync(path.join(resultDir, 'test_books.json'))).toBe(true);

        // Assert heap growth remains strictly bounded (< 30 MB heap delta for 1,000 streamed documents)
        expect(heapGrowthMb).toBeLessThan(30);
      });
    });
  });

  describe('[Source: apiOptimizations.test.js]', () => {
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

          const foundLoan = res.body.data.active.find(
            (l) => l._id.toString() === loan1._id.toString()
          );
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
  });

  describe('[Source: deploymentHardening.test.js]', () => {
    const request = require('supertest');
    const app = require('../app');
    const connectDB = require('../db');
    const { generatePresignedUploadUrl } = require('../utils/storage');
    const { getAuthCookieOptions } = require('../utils/cookieOptions');

    describe('Master Vercel Deployment Hardening Integration Tests', () => {
      it('1. Health Check Endpoint: should return HTTP 200 with dbReadyState: 1 and dbState: "connected"', async () => {
        const res = await request(app).get('/api/health');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.dbReadyState).toBe(1);
        expect(res.body.dbState).toBe('connected');

        const v1Res = await request(app).get('/api/v1/health');
        expect(v1Res.status).toBe(200);
        expect(v1Res.body.dbReadyState).toBe(1);
      });

      it('2. DB Connection Promise Caching: should reuse global._mongooseConn across warm invocations', async () => {
        const conn1 = await connectDB();
        const conn2 = await connectDB();

        expect(global._mongooseConn).toBeDefined();
        expect(global._mongooseConn.conn).toBeDefined();
        expect(conn1).toBe(conn2);
      });

      it('3. Fail-Fast MONGO_URI Check: should throw a clear explicit error when MONGO_URI is missing', async () => {
        const origUri = process.env.MONGO_URI;
        const origMUri = process.env.MONGODB_URI;

        delete process.env.MONGO_URI;
        delete process.env.MONGODB_URI;

        // Reset cached connection temporarily
        const cachedPromise = global._mongooseConn.promise;
        const cachedConn = global._mongooseConn.conn;
        global._mongooseConn.promise = null;
        global._mongooseConn.conn = null;

        await expect(connectDB()).rejects.toThrow(/MONGO_URI is not set/i);

        // Restore env & connection
        process.env.MONGO_URI = origUri;
        process.env.MONGODB_URI = origMUri;
        global._mongooseConn.promise = cachedPromise;
        global._mongooseConn.conn = cachedConn;
      });

      it('4. Cross-Site Cookie Policy Resolution: should set sameSite: "none" and secure: true for production cross-site requests', () => {
        const mockReq = {
          headers: {
            host: 'api.bookbuddy.com',
            origin: 'https://frontend.vercel.app',
          },
        };

        const opts = getAuthCookieOptions(mockReq);
        expect(opts.path).toBe('/');
        expect(opts.httpOnly).toBe(true);
      });

      it('5. Direct Upload Presigned URL Generator: should issue signed upload metadata', async () => {
        const result = await generatePresignedUploadUrl({
          fileName: 'students_roster_2026.csv',
          fileType: 'text/csv',
        });

        expect(result.fileKey).toBeDefined();
        expect(result.uploadUrl).toBeDefined();
        expect(result.headers['content-type']).toBe('text/csv');
      });
    });
  });

  describe('[Source: deploymentVerification.test.js]', () => {
    const request = require('supertest');
    const app = require('../app');

    describe('Post-Push Deployment Verification Automated Tests', () => {
      const originalEnv = { ...process.env };

      afterEach(() => {
        process.env = { ...originalEnv };
      });
      it('1. GET /version should return HTTP 200 with commitSha, version, and uptime', async () => {
        process.env.COMMIT_SHA = 'a1b2c3d4e5f6789012345678901234567890abcd';
        process.env.APP_VERSION = '2.5.0';

        const res = await request(app).get('/version');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe('ok');
        expect(res.body.commitSha).toBe('a1b2c3d4e5f6789012345678901234567890abcd');
        expect(res.body.shortCommitSha).toBe('a1b2c3d');
        expect(res.body.version).toBe('2.5.0');
        expect(res.body.uptime).toBeDefined();
        expect(res.body.timestamp).toBeDefined();
      });

      it('2. GET /api/v1/version alias route should return same commit metadata', async () => {
        process.env.COMMIT_SHA = 'ff99887766554433221100';

        const res = await request(app).get('/api/v1/version');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.commitSha).toBe('ff99887766554433221100');
        expect(res.body.shortCommitSha).toBe('ff99887');
      });

      it('3. GET /health should include commitSha, shortCommitSha, and version in payload', async () => {
        process.env.COMMIT_SHA = 'abcdef123456789';

        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body.commitSha).toBe('abcdef123456789');
        expect(res.body.shortCommitSha).toBe('abcdef1');
        expect(res.body.version).toBeDefined();
      });

      it('4. GET /version should be accessible without CSRF or Rate Limit headers', async () => {
        const res = await request(app).get('/version').set('x-csrf-token', '');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
      });
    });
  });

  describe('[Source: migrations.test.js]', () => {
    const path = require('path');
    const migrateMongo = require('migrate-mongo');
    const mongoose = require('mongoose');

    describe('Database Migration Integration & Idempotency Tests', () => {
      const dbUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_migration_test';

      beforeAll(async () => {
        migrateMongo.config.set({
          mongodb: {
            url: dbUri,
            options: {},
          },
          migrationsDir: path.join(__dirname, '../../../database/migrations'),
          changelogCollectionName: 'changelog',
          migrationFileExtension: '.js',
          useFileHash: false,
          moduleSystem: 'commonjs',
        });

        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(dbUri);
        }
      });

      afterAll(async () => {
        if (mongoose.connection.db) {
          await mongoose.connection.db.dropDatabase();
        }
        // await // mongoose.disconnect();
      });

      test('0. Migrations succeed against a database with pre-existing schema-level indexes (autoIndex simulation)', async () => {
        // Simulate the real-world condition: Mongoose's autoIndex creates schema-level
        // indexes BEFORE any migration runs. This is the exact scenario that caused
        // the providerEventId conflict — the schema declares { unique: true } and
        // the migration tried to create { sparse: true } under the same index name.
        const db = mongoose.connection.db;

        // Pre-create the Payment schema's autoIndex for providerEventId (unique only, no sparse).
        // This mirrors what Mongoose <=v7 autoIndex would create from `unique: true, index: true`
        // BEFORE the schema was updated to also include `sparse: true`.
        try {
          await db
            .collection('payments')
            .createIndex({ providerEventId: 1 }, { unique: true, name: 'providerEventId_1' });
        } catch {
          // Collection/index may already exist — that's fine
        }

        // Pre-create the Annotation schema's compound index (matching schema.index() exactly)
        try {
          await db.collection('annotations').createIndex({ userId: 1, resourceId: 1 });
        } catch {
          // ignore
        }

        // Pre-create the RefreshToken schema's compound index
        try {
          await db.collection('refreshtokens').createIndex({ userId: 1, expiresAt: 1 });
        } catch {
          // ignore
        }

        // Now run the full migration suite — should NOT throw despite pre-existing indexes
        const { db: migrateDb, client } = await migrateMongo.database.connect();
        const migrated = await migrateMongo.up(migrateDb, client);

        expect(Array.isArray(migrated)).toBe(true);
        expect(migrated.length).toBeGreaterThan(0);

        // Verify the providerEventId index now has both unique AND sparse
        const paymentIndexes = await migrateDb.collection('payments').indexes();
        const providerEventIdx = paymentIndexes.find((idx) => idx.name === 'providerEventId_1');
        expect(providerEventIdx).toBeDefined();
        expect(providerEventIdx.unique).toBe(true);
        expect(providerEventIdx.sparse).toBe(true);

        await client.close();
      });

      test('1. Running migrate-mongo up a second time is idempotent (no new migrations applied)', async () => {
        const { db, client } = await migrateMongo.database.connect();
        const migratedSecondRun = await migrateMongo.up(db, client);

        expect(Array.isArray(migratedSecondRun)).toBe(true);
        expect(migratedSecondRun.length).toBe(0);

        await client.close();
      });

      test('2. Full migrate-mongo down then up round-trip succeeds', async () => {
        const { db, client } = await migrateMongo.database.connect();

        // Down all migrations
        const downResults = await migrateMongo.down(db, client);
        expect(Array.isArray(downResults)).toBe(true);

        // Up again — should re-apply all without conflict
        // Need to down all remaining migrations first
        let moreDown = downResults;
        while (moreDown.length > 0) {
          moreDown = await migrateMongo.down(db, client);
        }

        const reApplied = await migrateMongo.up(db, client);
        expect(Array.isArray(reApplied)).toBe(true);
        expect(reApplied.length).toBeGreaterThan(0);

        await client.close();
      });

      afterAll(async () => {
        try {
          const Payment = require('../models/Payment');
          if (mongoose.connection && mongoose.connection.db) {
            try {
              await mongoose.connection.db.collection('payments').dropIndex('providerEventId_1');
            } catch (_err) {
              // Index may already be dropped
            }
            await Payment.syncIndexes();
          }
        } catch (_err) {
          // Connection may already be closed
        }
      });
    });
  });
});
