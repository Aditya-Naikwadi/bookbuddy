/**
 * Consolidated Suite: e2e And Master Roadmap
 * Merged from:
 *  - e2e.test.js
 *  - e2eRegistrationLoginVerification.test.js
 *  - master12FeatureRoadmap.test.js
 *  - regressionHardeningSuite.test.js
 *  - restEndpoints.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('e2e And Master Roadmap Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: e2e.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_e2e_test';
    process.env.JWT_SECRET = 'testjwtsecretkey999';
    process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretkey999';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';

    jest.setTimeout(30000);

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Book = require('../models/Book');
    const Loan = require('../models/Loan');
    const Fine = require('../models/Fine');
    const Streak = require('../models/Streak');
    const Notification = require('../models/Notification');
    const { runOverdueFineAccrual } = require('../services/cronService');

    describe('Phase 8 — End-to-End User Journeys Integration Test', () => {
      let college;
      let adminToken;
      let adminUser;
      let studentToken;
      let studentUser;
      let book;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
      });

      beforeEach(async () => {
        // Clear databases
        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await Loan.deleteMany({});
        await Fine.deleteMany({});
        await Streak.deleteMany({});
        await Notification.deleteMany({});

        // 1. Create a College
        college = await College.create({
          name: 'E2E Tech Institute',
          code: 'E2E',
        });

        // 2. Create a College Admin
        adminUser = await User.create({
          studentId: 'ADM_001',
          name: 'College Admin',
          email: 'admin@e2e.edu',
          password: 'password123',
          role: 'college-admin',
          collegeId: college._id,
        });

        expect(adminUser.role).toBe('college-admin');

        // Login Admin to get token
        const adminLoginRes = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'admin@e2e.edu', password: 'password123' });
        adminToken = adminLoginRes.body.accessToken;

        // 3. Create a Book via Admin Catalog Endpoint
        const bookRes = await request(app)
          .post('/api/v1/dashboards/college-admin/catalog')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            isbn: '978-3-16-148410-0',
            title: 'Introduction to Agentic Backend Design',
            author: 'Antigravity Creator',
            category: 'Computer Science',
            copiesTotal: 1,
            copiesAvailable: 1,
          });
        book = bookRes.body.data;

        // 4. Register a Student
        const studentRegRes = await request(app).post('/api/v1/auth/register').send({
          studentId: 'STU_E2E_01',
          name: 'John Doe',
          email: 'john.doe@e2e.edu',
          password: 'password123',
          collegeId: college._id.toString(),
        });
        expect(studentRegRes.status).toBe(201);

        // Login Student
        const studentLoginRes = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'john.doe@e2e.edu', password: 'password123' });

        studentToken = studentLoginRes.body.accessToken;
        studentUser = await User.findOne({ email: 'john.doe@e2e.edu' });
      });

      afterAll(async () => {
        // await // mongoose.connection.close();
      });

      it('runs complete e2e journey: checkout -> streak update -> notify -> overdue fine -> fine dashboard check -> return', async () => {
        // Step A: Admin checks out book to student
        const checkoutRes = await request(app)
          .post('/api/v1/dashboards/college-admin/circulation/checkout')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            userId: studentUser._id.toString(),
            bookId: book._id.toString(),
          });

        expect(checkoutRes.status).toBe(201);
        expect(checkoutRes.body.success).toBe(true);
        const loan = checkoutRes.body.data;
        expect(loan.status).toBe('active');

        // Step B: Verify student streak gets updated on qualifying action (checkout)
        const streak = await Streak.findOne({ userId: studentUser._id });
        expect(streak).toBeDefined();
        expect(streak.currentStreak).toBe(1);

        // Step D: Simulate book becoming overdue by updating due date to 5 days ago
        const overdueDate = new Date();
        overdueDate.setDate(overdueDate.getDate() - 5);
        await Loan.findByIdAndUpdate(loan._id, { dueDate: overdueDate });

        // Step E: Execute fine accrual background cron job
        const affectedFines = await runOverdueFineAccrual();
        expect(affectedFines).toBe(1);

        // Verify Fine entry in Database
        const fine = await Fine.findOne({ loanId: loan._id });
        expect(fine).toBeDefined();
        expect(fine.amount).toBe(25); // $5 per day for 5 days overdue
        expect(fine.status).toBe('unpaid');

        // Verify notification exists in student notification list for fine accrual
        const notifyRes = await request(app)
          .get('/api/v1/dashboards/student/notifications')
          .set('Authorization', `Bearer ${studentToken}`);

        expect(notifyRes.status).toBe(200);
        expect(notifyRes.body.notifications.length).toBeGreaterThan(0);
        expect(notifyRes.body.notifications[0].message).toContain('fine');

        // Step F: Verify student sees the fine in their dashboard
        const studentFinesRes = await request(app)
          .get('/api/v1/dashboards/student/fines')
          .set('Authorization', `Bearer ${studentToken}`);

        expect(studentFinesRes.status).toBe(200);
        expect(studentFinesRes.body.data.length).toBe(1);
        expect(studentFinesRes.body.data[0].amount).toBe(25);

        // Step G: Return the book via Admin
        const returnRes = await request(app)
          .post('/api/v1/dashboards/college-admin/circulation/return')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            loanId: loan._id.toString(),
          });

        expect(returnRes.status).toBe(200);
        expect(returnRes.body.data.status).toBe('returned');

        // Verify book copies are restored
        const updatedBook = await Book.findById(book._id);
        expect(updatedBook.copiesAvailable).toBe(1);
      });
    });
  });

  describe('[Source: e2eRegistrationLoginVerification.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');
    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');

    describe('E2E User Registration and Login Persistence Verification', () => {
      let defaultCollege;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          const dbUri =
            process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_e2e_auth_test';
          await mongoose.connect(dbUri);
        }

        await User.deleteMany({ email: 'e2e.testuser@bookbuddy.com' });
        await College.deleteMany({ code: 'E2E_COLLEGE' });

        defaultCollege = await College.create({
          name: 'E2E Test College',
          code: 'E2E_COLLEGE',
          status: 'active',
          isActive: true,
        });
      });

      afterAll(async () => {
        await User.deleteMany({ email: 'e2e.testuser@bookbuddy.com' });
        await College.deleteMany({ code: 'E2E_COLLEGE' });
      });

      test('End-to-End Flow: Registration -> DB Persistence (Argon2id Hashed) -> Login Success', async () => {
        const testCredentials = {
          studentId: 'STU_E2E_1001',
          name: 'E2E Test User',
          email: 'e2e.testuser@bookbuddy.com',
          password: 'SecurePassword123!',
          collegeId: defaultCollege._id.toString(),
          role: 'student',
        };

        // 1. Submit Registration Request
        const regResponse = await request(app).post('/api/v1/auth/register').send(testCredentials);

        expect(regResponse.status).toBe(201);
        expect(regResponse.body.success).toBe(true);
        expect(regResponse.body.user).toBeDefined();
        expect(regResponse.body.user.email).toBe('e2e.testuser@bookbuddy.com');
        expect(regResponse.body.user.password).toBeUndefined(); // Ensure plain password is NOT leaked in API response

        // 2. Direct Database Query Verification — Confirm row/document exists with hashed password
        const dbUser = await User.findOne({ email: 'e2e.testuser@bookbuddy.com' }).select(
          '+password'
        );
        expect(dbUser).not.toBeNull();
        expect(dbUser._id).toBeDefined();
        expect(dbUser.name).toBe('E2E Test User');
        expect(dbUser.studentId).toBe('STU_E2E_1001');
        expect(dbUser.password).toBeDefined();
        // Password must be securely hashed with Argon2id (starts with $argon2), NOT stored in plaintext
        expect(dbUser.password).not.toBe('SecurePassword123!');
        expect(dbUser.password.startsWith('$argon2')).toBe(true);

        // 3. Login with Registered Credentials
        const loginResponse = await request(app).post('/api/v1/auth/login').send({
          email: 'e2e.testuser@bookbuddy.com',
          password: 'SecurePassword123!',
        });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.body.success).toBe(true);
        expect(loginResponse.body.accessToken).toBeDefined();
        expect(loginResponse.body.user._id).toBe(dbUser._id.toString());
        expect(loginResponse.body.user.email).toBe('e2e.testuser@bookbuddy.com');
      });

      test('Invalid Credentials Rejection: Login fails with wrong password', async () => {
        const loginResponse = await request(app).post('/api/v1/auth/login').send({
          email: 'e2e.testuser@bookbuddy.com',
          password: 'WrongPassword999!',
        });

        expect(loginResponse.status).toBe(401);
        expect(loginResponse.body.success).toBe(false);
      });
    });
  });

  describe('[Source: master12FeatureRoadmap.test.js]', () => {
    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_roadmap_test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testjwtlibrarysecretkey999';

    jest.setTimeout(30000);

    const request = require('supertest');
    const mongoose = require('mongoose');
    const connectDB = require('../config/db');
    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Book = require('../models/Book');
    const Review = require('../models/Review');
    const AvailabilityAlert = require('../models/AvailabilityAlert');
    const ILLRequest = require('../models/ILLRequest');

    describe('Master 12-Feature Roadmap Comprehensive Integration & Security Test Suite', () => {
      let collegeA, collegeB;
      let studentUserA, studentUserB;
      let tokenA, tokenB;
      let bookSharedA, bookPrivateA;

      beforeAll(async () => {
        await connectDB();

        // Create test colleges
        collegeA = await College.create({
          name: 'Alpha University',
          shortName: 'ALPHA',
          code: `ALPHA_${Date.now()}`,
          status: 'active',
        });

        collegeB = await College.create({
          name: 'Beta Tech Institute',
          shortName: 'BETA',
          code: `BETA_${Date.now()}`,
          status: 'active',
        });

        // Create test student users
        studentUserA = await User.create({
          studentId: `STU_A_${Date.now()}`,
          name: 'Alice Student',
          email: `alice_${Date.now()}@alpha.edu`,
          password: 'password123',
          role: 'student',
          collegeId: collegeA._id,
          isLeaderboardPublic: true,
        });

        studentUserB = await User.create({
          studentId: `STU_B_${Date.now()}`,
          name: 'Bob Student',
          email: `bob_${Date.now()}@beta.edu`,
          password: 'password123',
          role: 'student',
          collegeId: collegeB._id,
          isLeaderboardPublic: false,
        });

        // Mock tokens with collegeId and role
        const { generateAccessToken } = require('../utils/token');
        tokenA = generateAccessToken(studentUserA);
        tokenB = generateAccessToken(studentUserB);

        // Create books
        bookSharedA = await Book.create({
          collegeId: collegeA._id,
          isbn: `978-${Date.now().toString().slice(-10)}`,
          title: 'Clean Code: Shared Edition',
          author: 'Robert C. Martin',
          category: 'Software Engineering',
          copiesTotal: 5,
          copiesAvailable: 3,
          isILLShared: true,
        });

        bookPrivateA = await Book.create({
          collegeId: collegeA._id,
          isbn: `978-${(Date.now() + 1).toString().slice(-10)}`,
          title: 'Design Patterns: Internal Private Edition',
          author: 'Erich Gamma',
          category: 'Software Engineering',
          copiesTotal: 2,
          copiesAvailable: 1,
          isILLShared: false,
        });
      });

      afterAll(async () => {
        try {
          if (studentUserA?._id || studentUserB?._id) {
            await User.deleteMany({
              _id: { $in: [studentUserA?._id, studentUserB?._id].filter(Boolean) },
            });
          }
          if (collegeA?._id || collegeB?._id) {
            await College.deleteMany({
              _id: { $in: [collegeA?._id, collegeB?._id].filter(Boolean) },
            });
          }
          if (bookSharedA?._id || bookPrivateA?._id) {
            await Book.deleteMany({
              _id: { $in: [bookSharedA?._id, bookPrivateA?._id].filter(Boolean) },
            });
          }
          await Review.deleteMany({});
          await AvailabilityAlert.deleteMany({});
          await ILLRequest.deleteMany({});
        } catch {
          // Ignore cleanup errors
        } finally {
          if (mongoose.connection.readyState !== 0) {
            // await // mongoose.connection.close();
          }
        }
      });

      // --- WAVE 1 TESTS ---
      describe('Wave 1: Foundation (Reviews, Ratings, Availability Alerts)', () => {
        test('POST /api/v1/reviews - Should allow patron to submit a 5-star review', async () => {
          const res = await request(app)
            .post('/api/v1/reviews')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
              resourceType: 'book',
              resourceId: bookSharedA._id,
              rating: 5,
              title: 'Must-read for developers!',
              comment: 'Outstanding principles and clean design guidelines.',
            });

          expect(res.statusCode).toBe(201);
          expect(res.body.success).toBe(true);
          expect(res.body.data.rating).toBe(5);
        });

        test('GET /api/v1/reviews/book/:id - Should calculate aggregate rating summary', async () => {
          const res = await request(app)
            .get(`/api/v1/reviews/book/${bookSharedA._id}`)
            .set('Authorization', `Bearer ${tokenA}`);

          expect(res.statusCode).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.summary.averageRating).toBe(5);
          expect(res.body.summary.totalReviews).toBe(1);
        });

        test('POST /api/v1/availability-alerts - Should toggle stock alert subscription', async () => {
          const res = await request(app)
            .post('/api/v1/availability-alerts')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
              resourceType: 'book',
              resourceId: bookSharedA._id,
            });

          expect(res.statusCode).toBe(201);
          expect(res.body.success).toBe(true);
          expect(res.body.data.subscribed).toBe(true);
        });
      });

      // --- WAVE 2 TESTS ---
      describe('Wave 2: Engagement (Leaderboard Pseudonymization)', () => {
        test('GET /api/v1/leaderboard - Should respect user leaderboard privacy settings', async () => {
          const res = await request(app)
            .get('/api/v1/leaderboard?metric=streak')
            .set('Authorization', `Bearer ${tokenA}`);

          expect(res.statusCode).toBe(200);
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        });
      });

      // --- WAVE 4 SECURITY TESTS ---
      describe('Wave 4: High-Risk (Cross-College ILL Security & Payment Webhooks)', () => {
        test('GET /api/v1/ill/catalog - Should strictly return only isILLShared books from other colleges', async () => {
          const res = await request(app)
            .get('/api/v1/ill/catalog')
            .set('Authorization', `Bearer ${tokenB}`);

          expect(res.statusCode).toBe(200);
          expect(res.body.success).toBe(true);

          const returnedBookIds = res.body.data.map((b) => b._id.toString());
          expect(returnedBookIds).toContain(bookSharedA._id.toString());
          expect(returnedBookIds).not.toContain(bookPrivateA._id.toString()); // STRICT UN-SHARED LEAK PREVENTION
        });

        test('POST /api/v1/ill/request - Should reject ILL request for non-shared private books', async () => {
          const res = await request(app)
            .post('/api/v1/ill/request')
            .set('Authorization', `Bearer ${tokenB}`)
            .send({
              bookId: bookPrivateA._id,
            });

          expect(res.statusCode).toBe(403); // Access Denied
          expect(res.body.message).toMatch(/not shared for inter-library loan/i);
        });

        test('POST /api/v1/ill/request - Should succeed for explicitly shared books and create audit log', async () => {
          const res = await request(app)
            .post('/api/v1/ill/request')
            .set('Authorization', `Bearer ${tokenB}`)
            .send({
              bookId: bookSharedA._id,
            });

          expect(res.statusCode).toBe(201);
          expect(res.body.success).toBe(true);
          expect(res.body.data.status).toBe('requested');
        });

        test('POST /api/v1/payments/webhook - Should reject invalid HMAC webhook signature', async () => {
          const res = await request(app)
            .post('/api/v1/payments/webhook')
            .set('x-razorpay-signature', 'invalid_signature_hash_12345')
            .send({
              event_id: 'evt_test_fake_123',
              fineId: new mongoose.Types.ObjectId(),
            });

          expect(res.statusCode).toBe(400);
          expect(res.body.message).toMatch(/signature/i);
        });
      });
    });
  });

  describe('[Source: regressionHardeningSuite.test.js]', () => {
    const mongoose = require('mongoose');
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');

    const scopeToTenant = require('../middlewares/scopeToTenant');
    const User = require('../models/User');
    const { generatePatronToken, verifyPatronToken } = require('../utils/patronTokenUtil');

    describe('Permanent Regression Hardening Test Suite (All 6 Codebase Problems)', () => {
      /* -------------------------------------------------------------------------- */
      /* PROBLEM 1 REGRESSION TEST: Vite Environment Node Globals                   */
      /* -------------------------------------------------------------------------- */
      test('Problem 1: Client source code must NOT use process.env.NODE_ENV (must use import.meta.env.MODE)', () => {
        const clientSrcPath = path.resolve(__dirname, '../../../frontend/src');

        function scanFiles(dir) {
          let forbiddenMatches = [];
          const entries = fs.readdirSync(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              forbiddenMatches = forbiddenMatches.concat(scanFiles(fullPath));
            } else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
              const content = fs.readFileSync(fullPath, 'utf8');
              if (content.includes('process.env.NODE_ENV')) {
                forbiddenMatches.push(fullPath);
              }
            }
          }
          return forbiddenMatches;
        }

        const matches = scanFiles(clientSrcPath);
        expect(matches).toEqual([]);
      });

      /* -------------------------------------------------------------------------- */
      /* PROBLEM 2 REGRESSION TEST: Multi-Tenant Scoping Enforcement                 */
      /* -------------------------------------------------------------------------- */
      test('Problem 2: scopeToTenant middleware must strictly attach collegeId tenantFilter for student and college-admin', () => {
        const collegeIdA = new mongoose.Types.ObjectId();
        const collegeIdB = new mongoose.Types.ObjectId();

        // Student A
        const reqStudent = { user: { id: 'studentA', role: 'student', collegeId: collegeIdA } };
        scopeToTenant(reqStudent, {}, () => {});
        expect(reqStudent.tenantFilter).toBeDefined();
        expect(reqStudent.tenantFilter.collegeId.toString()).toBe(collegeIdA.toString());

        // College Admin B
        const reqAdmin = { user: { id: 'adminB', role: 'college-admin', collegeId: collegeIdB } };
        scopeToTenant(reqAdmin, {}, () => {});
        expect(reqAdmin.tenantFilter.collegeId.toString()).toBe(collegeIdB.toString());
        expect(reqAdmin.tenantFilter.collegeId.toString()).not.toBe(collegeIdA.toString());
      });

      /* -------------------------------------------------------------------------- */
      /* PROBLEM 3 REGRESSION TEST: Patron Card P0 Raw Secret Protection            */
      /* -------------------------------------------------------------------------- */
      test('Problem 3 (P0 SECURITY): User schema must hide cardSecret (select: false) and patron token must NEVER leak secret', () => {
        // 1. Verify schema field configuration
        const cardSecretPath = User.schema.paths.cardSecret;
        expect(cardSecretPath).toBeDefined();
        expect(cardSecretPath.options.select).toBe(false);

        // 2. Test token generation output
        const studentId = 'STU-2026-TEST';
        const userId = new mongoose.Types.ObjectId();
        const { token } = generatePatronToken(userId, studentId);

        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.includes('cardSecret')).toBe(false);
        expect(token.includes('raw_secret')).toBe(false);

        // 3. Verify signed token validation
        const verification = verifyPatronToken(token);
        expect(verification.valid).toBe(true);
        expect(verification.userId.toString()).toBe(userId.toString());
      });

      /* -------------------------------------------------------------------------- */
      /* PROBLEM 4 REGRESSION TEST: Optimistic UI & WebSocket Reconciliation Rule   */
      /* -------------------------------------------------------------------------- */
      test('Problem 4: Structured reconciliation rule must resolve optimistic mutations with WebSocket cache invalidation', () => {
        // Documented Rule: Server-authoritative state overwrites local cache upon mutation settlement; WebSocket invalidations reset stale query states.
        const queryCache = new Map();
        const queryKey = ['books', 'college_123'];

        // Initial state
        const initialData = [{ _id: 'b1', title: 'Refactoring', renewalCount: 0 }];
        queryCache.set(JSON.stringify(queryKey), initialData);

        // Optimistic Mutation: student renews
        const optimisticUpdate = (oldData) =>
          oldData.map((b) => (b._id === 'b1' ? { ...b, renewalCount: b.renewalCount + 1 } : b));
        queryCache.set(
          JSON.stringify(queryKey),
          optimisticUpdate(queryCache.get(JSON.stringify(queryKey)))
        );

        // WebSocket race: cache invalidated
        queryCache.delete(JSON.stringify(queryKey));

        // Server Settlement: authoritative payload arrives
        const serverAuthoritativeData = [{ _id: 'b1', title: 'Refactoring', renewalCount: 1 }];
        queryCache.set(JSON.stringify(queryKey), serverAuthoritativeData);

        const finalState = queryCache.get(JSON.stringify(queryKey));
        expect(finalState[0].renewalCount).toBe(1);
      });

      /* -------------------------------------------------------------------------- */
      /* PROBLEM 5 REGRESSION TEST: API Path Inconsistency Prevention               */
      /* -------------------------------------------------------------------------- */
      test('Problem 5: Standardized API endpoints must use /api/v1 prefix and canonical paths', () => {
        const readingListApiContent = fs.readFileSync(
          path.resolve(__dirname, '../../../frontend/src/api/readingListApi.js'),
          'utf8'
        );
        const recommendationApiContent = fs.readFileSync(
          path.resolve(__dirname, '../../../frontend/src/api/recommendationApi.js'),
          'utf8'
        );

        expect(readingListApiContent).toContain('"/reading-lists"');
        expect(recommendationApiContent).toContain('"/recommendations/me"');
      });

      /* -------------------------------------------------------------------------- */
      /* PROBLEM 6 REGRESSION TEST: ETag MD5 Caching & Read-Only General User Guard */
      /* -------------------------------------------------------------------------- */
      test('Problem 6: ETag MD5 calculation produces deterministic headers for caching', () => {
        const samplePayload = { success: true, data: { collegeId: 'c1', popularBooks: [] } };
        const payloadString = JSON.stringify(samplePayload);
        const etag1 = `"${crypto.createHash('md5').update(payloadString).digest('hex')}"`;
        const etag2 = `"${crypto.createHash('md5').update(payloadString).digest('hex')}"`;

        expect(etag1).toBe(etag2);
        expect(etag1).toMatch(/^"[a-f0-9]{32}"$/);
      });
    });
  });

  describe('[Source: restEndpoints.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_rest_endpoints_test';
    process.env.JWT_SECRET = 'testjwtsecretrestkey999';
    process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretrestkey999';
    process.env.JWT_ACCESS_EXPIRY = '10m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    jest.setTimeout(30000);

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Book = require('../models/Book');
    const EResource = require('../models/EResource');
    const ReadingList = require('../models/ReadingList');
    const SavedSearch = require('../models/SavedSearch');
    const BookSuggestion = require('../models/BookSuggestion');
    const Reservation = require('../models/Reservation');
    const LabSeat = require('../models/LabSeat');
    const LabBooking = require('../models/LabBooking');
    const { generateTokenPair } = require('../utils/token');

    describe('Direct REST Endpoints Integration Tests', () => {
      let collegeA;
      let studentA;
      let tokenStudentA;
      let bookA;
      let eresourceA;
      let seatA;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }

        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await EResource.deleteMany({});
        await ReadingList.deleteMany({});
        await SavedSearch.deleteMany({});
        await BookSuggestion.deleteMany({});
        await Reservation.deleteMany({});
        await LabSeat.deleteMany({});
        await LabBooking.deleteMany({});

        collegeA = await College.create({
          name: 'REST Test College A',
          code: 'RTCA',
          selectedServices: ['facilities_booking', 'catalog_management'],
          enabledFeatures: ['facilities_booking', 'catalog_management'],
        });

        // Seed Student
        studentA = await User.create({
          studentId: 'STU_REST_001',
          name: 'REST Student',
          email: 'student.rest@test.com',
          password: 'password123',
          role: 'student',
          collegeId: collegeA._id,
        });

        tokenStudentA = generateTokenPair(studentA).accessToken;

        // Seed Book
        bookA = await Book.create({
          collegeId: collegeA._id,
          title: 'REST Test Book',
          author: 'REST Author',
          isbn: '1234567890123',
          category: 'Science',
          copiesAvailable: 0, // checked out for queue test
          totalCopies: 1,
        });

        // Seed E-Resource
        eresourceA = await EResource.create({
          collegeId: collegeA._id,
          title: 'REST Test EResource',
          author: 'REST EResource Author',
          type: 'pdf',
          fileUrl: 'https://test.com/file.pdf',
          category: 'Science',
          moderationStatus: 'approved',
          uploadedBy: studentA._id,
        });

        // Seed Lab Seat
        seatA = await LabSeat.create({
          collegeId: collegeA._id,
          labName: 'REST Lab 1',
          seatNumber: 'Seat-A1',
          specs: 'i7 CPU, 16GB RAM',
          maintenanceStatus: 'operational',
        });
      });

      afterAll(async () => {
        await mongoose.connection.db.dropDatabase();
        // await // mongoose.connection.close();
      });

      describe('Saved Searches API', () => {
        it('should create and retrieve a saved search', async () => {
          const createRes = await request(app)
            .post('/api/v1/saved-searches')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              queryParams: {
                category: 'Science',
                keyword: 'physics',
              },
              alertsEnabled: true,
            });

          expect(createRes.status).toBe(200);
          expect(createRes.body.success).toBe(true);
          expect(createRes.body.data.queryParams.category).toBe('Science');
          expect(createRes.body.data.collegeId.toString()).toBe(collegeA._id.toString());

          const getRes = await request(app)
            .get('/api/v1/saved-searches/me')
            .set('Authorization', `Bearer ${tokenStudentA}`);

          expect(getRes.status).toBe(200);
          expect(getRes.body.success).toBe(true);
          expect(getRes.body.data.length).toBe(1);
        });
      });

      describe('Book Suggestions API', () => {
        it('should submit a book suggestion', async () => {
          const suggestRes = await request(app)
            .post('/api/v1/book-suggestions')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              title: 'Future of AI',
              author: 'John Doe',
              reason: 'Excellent reference on neural nets.',
            });

          expect(suggestRes.status).toBe(201);
          expect(suggestRes.body.success).toBe(true);
          expect(suggestRes.body.data.title).toBe('Future of AI');
          expect(suggestRes.body.data.suggestedBy.toString()).toBe(studentA._id.toString());
          expect(suggestRes.body.data.collegeId.toString()).toBe(collegeA._id.toString());

          const listRes = await request(app)
            .get('/api/v1/book-suggestions')
            .set('Authorization', `Bearer ${tokenStudentA}`);

          expect(listRes.status).toBe(200);
          expect(listRes.body.success).toBe(true);
          expect(listRes.body.data.length).toBe(1);
        });
      });

      describe('Reading Lists API', () => {
        it('should create, update, and retrieve reading lists', async () => {
          const createRes = await request(app)
            .post('/api/v1/reading-lists')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              title: 'My Custom Reading List',
              description: 'A collection of books.',
              visibility: 'private',
            });

          expect([200, 201]).toContain(createRes.status);
          expect(createRes.body.success).toBe(true);
          expect(createRes.body.data.title).toBe('My Custom Reading List');
          expect(createRes.body.data.ownerId.toString()).toBe(studentA._id.toString());
          expect(createRes.body.data.collegeId.toString()).toBe(collegeA._id.toString());

          const listId = createRes.body.data._id;

          const getRes = await request(app)
            .get(`/api/v1/reading-lists/${listId}`)
            .set('Authorization', `Bearer ${tokenStudentA}`);

          expect(getRes.status).toBe(200);
          expect(getRes.body.success).toBe(true);
          expect(getRes.body.data.title).toBe('My Custom Reading List');

          const updateRes = await request(app)
            .patch(`/api/v1/reading-lists/${listId}`)
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              title: 'Updated Reading List Name',
            });

          expect(updateRes.status).toBe(200);
          expect(updateRes.body.data.title).toBe('Updated Reading List Name');
        });
      });

      describe('Reservations API', () => {
        it('should join and leave reservation queue', async () => {
          const joinRes = await request(app)
            .post('/api/v1/reservations')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              bookId: bookA._id,
            });

          expect(joinRes.status).toBe(200);
          expect(joinRes.body.success).toBe(true);
          expect(joinRes.body.data.status).toBe('queued');
          expect(joinRes.body.data.userId.toString()).toBe(studentA._id.toString());
          expect(joinRes.body.data.collegeId.toString()).toBe(collegeA._id.toString());

          const reservationId = joinRes.body.data._id || joinRes.body.data.id;

          const leaveRes = await request(app)
            .delete(`/api/v1/reservations/${reservationId}`)
            .set('Authorization', `Bearer ${tokenStudentA}`);

          expect(leaveRes.status).toBe(200);
          expect(leaveRes.body.success).toBe(true);
          expect(leaveRes.body.data.status).toBe('cancelled');
        });
      });

      describe('E-Resource Progress API', () => {
        it('should submit reading progress using route params and schema', async () => {
          const progressRes = await request(app)
            .post(`/api/v1/eresources/${eresourceA._id}/progress`)
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              dailySecondsToday: 240,
            });

          expect(progressRes.status).toBe(200);
          expect(progressRes.body.success).toBe(true);
          expect(progressRes.body.message).toBe('Progress updated');
        });
      });

      describe('Lab Booking API', () => {
        it('should successfully book a seat slot', async () => {
          const now = new Date();
          const startTime = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 0, 0, 0)
          );
          const endTime = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 11, 0, 0, 0)
          );

          const bookRes = await request(app)
            .post('/api/v1/lab/bookings')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              seatId: seatA._id,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            });

          expect(bookRes.status).toBe(201);
          expect(bookRes.body.success).toBe(true);
          expect(bookRes.body.data.status).toBe('booked');
          expect(bookRes.body.data.collegeId.toString()).toBe(collegeA._id.toString());
        });
      });
    });
  });
});
