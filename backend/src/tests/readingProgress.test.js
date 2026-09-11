/**
 * Consolidated Suite: reading Progress
 * Merged from:
 *  - progressController.test.js
 *  - progressService.test.js
 *  - progressClockSkew.test.js
 *  - readingProgress.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('reading Progress Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: readingProgress.test.js]', () => {
    /**
     * Consolidated Suite: reading Progress
     * Merged from:
     *  - progressController.test.js
     *  - progressService.test.js
     *  - progressClockSkew.test.js
     *  - readingProgress.test.js
     */

    process.env.NODE_ENV = 'test';
    jest.setTimeout(30000);

    const mongoose = require('mongoose');

    describe('reading Progress Consolidated Suite', () => {
      afterAll(async () => {
        try {
          if (mongoose.connection && mongoose.connection.readyState !== 0) {
            // await // mongoose.connection.close();
          }
        } catch {
          // ignore
        }
      });

      describe('[Source: progressController.test.js]', () => {
        const request = require('supertest');
        const mongoose = require('mongoose');

        process.env.NODE_ENV = 'test';
        process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/bookbuddy_progress_controller_test';
        process.env.JWT_SECRET = 'testjwtsecretreadingprogresstestkey123';
        process.env.JWT_REFRESH_SECRET = 'testjwtrefreshreadingprogresstestkey123';
        process.env.JWT_ACCESS_EXPIRY = '10m';
        process.env.JWT_REFRESH_EXPIRY = '7d';

        const app = require('../app');
        const User = require('../models/User');
        const College = require('../models/College');
        const Book = require('../models/Book');
        const Loan = require('../models/Loan');
        const EResource = require('../models/EResource');
        const ReadingProgress = require('../models/ReadingProgress');
        const { generateTokenPair } = require('../utils/token');

        describe('PUT/GET Reading Progress Endpoints Integration Tests', () => {
          let collegeA;
          let collegeB;
          let userA;
          let userB;
          let tokenUserA;
          let borrowedBook;
          let unborrowedBook;
          let collegeEResource;
          let otherCollegeEResource;

          beforeAll(async () => {
            if (mongoose.connection.readyState === 0) {
              await mongoose.connect(process.env.MONGO_URI, {
                serverSelectionTimeoutMS: 2000,
                connectTimeoutMS: 2000,
              });
            }

            await College.deleteMany({});
            await User.deleteMany({});
            await Book.deleteMany({});
            await Loan.deleteMany({});
            await EResource.deleteMany({});
            await ReadingProgress.deleteMany({});

            // Seed Colleges
            collegeA = await College.create({ name: 'Progress Test College A', code: 'PTCA' });
            collegeB = await College.create({ name: 'Progress Test College B', code: 'PTCB' });

            // Seed Users
            userA = await User.create({
              studentId: 'PROGRESS_STU_001',
              name: 'User A',
              email: 'usera.progress@test.com',
              password: 'password123',
              role: 'student',
              collegeId: collegeA._id,
            });

            userB = await User.create({
              studentId: 'PROGRESS_STU_002',
              name: 'User B',
              email: 'userb.progress@test.com',
              password: 'password123',
              role: 'student',
              collegeId: collegeB._id,
            });

            tokenUserA = generateTokenPair(userA).accessToken;

            // Seed Physical Books
            borrowedBook = await Book.create({
              collegeId: collegeA._id,
              title: 'Borrowed Physics Textbook',
              author: 'Dr. Newton',
              isbn: '978-0000000001',
              category: 'Science',
              copiesTotal: 5,
              copiesAvailable: 4,
            });

            unborrowedBook = await Book.create({
              collegeId: collegeA._id,
              title: 'Unborrowed Chemistry Book',
              author: 'Dr. Curie',
              isbn: '978-0000000002',
              category: 'Science',
              copiesTotal: 5,
              copiesAvailable: 5,
            });

            // Seed active Loan for userA and borrowedBook
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 14);
            await Loan.create({
              collegeId: collegeA._id,
              userId: userA._id,
              bookId: borrowedBook._id,
              issueDate: new Date(),
              dueDate,
              maxRenewals: 2,
              status: 'active',
              issuedBy: userA._id,
            });

            // Seed EResources
            collegeEResource = await EResource.create({
              collegeId: collegeA._id,
              title: 'Digital Calculus Guide',
              author: 'Leibniz',
              type: 'pdf',
              fileUrl: 'https://example.com/calculus.pdf',
              uploadedBy: userA._id,
              category: 'Mathematics',
              moderationStatus: 'approved',
              isPublished: true,
            });

            otherCollegeEResource = await EResource.create({
              collegeId: collegeB._id,
              title: 'College B Secret Journal',
              author: 'Anon',
              type: 'pdf',
              fileUrl: 'https://example.com/secret.pdf',
              uploadedBy: userB._id,
              category: 'General',
              moderationStatus: 'approved',
              isPublished: true,
            });
          });

          afterAll(async () => {
            if (mongoose.connection.readyState !== 0) {
              await mongoose.connection.db.dropDatabase();
              // await // // mongoose.connection.close();
            }
          });

          describe('Unauthenticated Requests', () => {
            it('GET /api/v1/reading-progress/:resourceId returns 401 when unauthenticated', async () => {
              const res = await request(app).get(`/api/v1/reading-progress/${borrowedBook._id}`);
              expect(res.status).toBe(401);
            });

            it('PUT /api/v1/reading-progress/:resourceId returns 401 when unauthenticated', async () => {
              const res = await request(app)
                .put(`/api/v1/reading-progress/${borrowedBook._id}`)
                .send({ percentageComplete: 50 });
              expect(res.status).toBe(401);
            });
          });

          describe('Acceptance Criteria: 403 Forbidden for Unborrowed / Unauthorized Resources', () => {
            it('GET /api/v1/reading-progress/:resourceId returns 403 when user has not borrowed the book', async () => {
              const res = await request(app)
                .get(`/api/v1/reading-progress/${unborrowedBook._id}`)
                .set('Authorization', `Bearer ${tokenUserA}`);

              expect(res.status).toBe(403);
              expect(res.body.message).toContain('Access denied');
            });

            it('PUT /api/v1/reading-progress/:resourceId returns 403 when user has not borrowed the book', async () => {
              const res = await request(app)
                .put(`/api/v1/reading-progress/${unborrowedBook._id}`)
                .set('Authorization', `Bearer ${tokenUserA}`)
                .send({
                  percentageComplete: 20,
                  position: { page: 5 },
                });

              expect(res.status).toBe(403);
              expect(res.body.message).toContain('Access denied');
            });

            it('GET /api/v1/reading-progress/:resourceId returns 403 for cross-tenant EResource access', async () => {
              const res = await request(app)
                .get(`/api/v1/reading-progress/${otherCollegeEResource._id}`)
                .set('Authorization', `Bearer ${tokenUserA}`);

              expect(res.status).toBe(403);
            });

            it('PUT /api/v1/reading-progress/:resourceId returns 403 for non-existent resourceId', async () => {
              const randomId = new mongoose.Types.ObjectId();
              const res = await request(app)
                .put(`/api/v1/reading-progress/${randomId}`)
                .set('Authorization', `Bearer ${tokenUserA}`)
                .send({ percentageComplete: 10 });

              expect(res.status).toBe(403);
            });
          });

          describe('Successful PUT and GET for Borrowed Physical Books', () => {
            it('PUT /api/v1/reading-progress/:resourceId updates progress for a borrowed book', async () => {
              const res = await request(app)
                .put(`/api/v1/reading-progress/${borrowedBook._id}`)
                .set('Authorization', `Bearer ${tokenUserA}`)
                .send({
                  resourceType: 'epub',
                  position: { cfi: 'epubcfi(/6/2[chap1])', page: 15 },
                  percentageComplete: 30,
                  deviceId: 'mobile-app-1',
                });

              expect(res.status).toBe(200);
              expect(res.body.success).toBe(true);
              expect(res.body.data.resourceId.toString()).toBe(borrowedBook._id.toString());
              expect(res.body.data.percentageComplete).toBe(30);
              expect(res.body.data.position.page).toBe(15);
              expect(res.body.data.deviceId).toBe('mobile-app-1');
            });

            it('GET /api/v1/reading-progress/:resourceId retrieves existing progress for a borrowed book', async () => {
              const res = await request(app)
                .get(`/api/v1/reading-progress/${borrowedBook._id}`)
                .set('Authorization', `Bearer ${tokenUserA}`);

              expect(res.status).toBe(200);
              expect(res.body.success).toBe(true);
              expect(res.body.data).not.toBeNull();
              expect(res.body.data.percentageComplete).toBe(30);
              expect(res.body.data.position.cfi).toBe('epubcfi(/6/2[chap1])');
            });
          });

          describe('Successful PUT and GET for Accessible EResources', () => {
            it('PUT /api/v1/reading-progress/:resourceId creates progress for an EResource', async () => {
              const res = await request(app)
                .put(`/api/v1/reading-progress/${collegeEResource._id}`)
                .set('Authorization', `Bearer ${tokenUserA}`)
                .send({
                  resourceType: 'pdf',
                  position: { page: 42, scrollOffset: 120 },
                  percentageComplete: 75.5,
                  deviceId: 'tablet-pro-9',
                });

              expect(res.status).toBe(200);
              expect(res.body.success).toBe(true);
              expect(res.body.data.percentageComplete).toBe(75.5);
              expect(res.body.data.position.page).toBe(42);
            });

            it('GET /api/v1/reading-progress/:resourceId retrieves progress for an EResource', async () => {
              const res = await request(app)
                .get(`/api/v1/reading-progress/${collegeEResource._id}`)
                .set('Authorization', `Bearer ${tokenUserA}`);

              expect(res.status).toBe(200);
              expect(res.body.success).toBe(true);
              expect(res.body.data.percentageComplete).toBe(75.5);
              expect(res.body.data.deviceId).toBe('tablet-pro-9');
            });

            it('Legacy /api/reading-progress/:resourceId route functions identically', async () => {
              const res = await request(app)
                .get(`/api/reading-progress/${collegeEResource._id}`)
                .set('Authorization', `Bearer ${tokenUserA}`);

              expect(res.status).toBe(200);
              expect(res.body.success).toBe(true);
              expect(res.body.data.percentageComplete).toBe(75.5);
            });
          });

          describe('Socket.io Real-time Progress Emission on Write', () => {
            it('Emits progress:updated to user room on successful PUT', async () => {
              const mockEmit = jest.fn();
              const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
              const mockIo = { to: mockTo };

              app.set('io', mockIo);

              const res = await request(app)
                .put(`/api/v1/reading-progress/${borrowedBook._id}`)
                .set('Authorization', `Bearer ${tokenUserA}`)
                .send({
                  resourceType: 'epub',
                  position: { page: 20 },
                  percentageComplete: 45,
                  deviceId: 'tab-2',
                });

              expect(res.status).toBe(200);
              expect(mockTo).toHaveBeenCalledWith(`user:${userA._id}`);
              expect(mockEmit).toHaveBeenCalledWith('progress:updated', {
                resourceId: borrowedBook._id.toString(),
                position: { page: 20 },
                percentageComplete: 45,
              });
            });
          });
        });
      });

      describe('[Source: progressService.test.js]', () => {
        const mongoose = require('mongoose');
        const ReadingProgress = require('../models/ReadingProgress');
        const { upsertProgress, getProgress } = require('../services/progressService');

        describe('progressService - Upsert & Fetch Reading Progress', () => {
          const userId = new mongoose.Types.ObjectId();
          const resourceId = new mongoose.Types.ObjectId();

          beforeAll(async () => {
            if (mongoose.connection.readyState === 0) {
              const uri =
                process.env.MONGO_URI ||
                'mongodb://127.0.0.1:27017/bookbuddy_progress_service_test';
              await mongoose.connect(uri, {
                serverSelectionTimeoutMS: 2000,
                connectTimeoutMS: 2000,
              });
            }
            await ReadingProgress.deleteMany({});
            await ReadingProgress.deleteMany({});
            await ReadingProgress.syncIndexes();
          });

          afterAll(async () => {
            if (mongoose.connection.readyState !== 0) {
              await ReadingProgress.deleteMany({});
            }
          });

          beforeEach(async () => {
            await ReadingProgress.deleteMany({});
          });

          test('upsertProgress & getProgress correctly store and retrieve progress', async () => {
            const saved = await upsertProgress({
              userId,
              resourceId,
              resourceType: 'epub',
              position: { cfi: 'epubcfi(/6/2)', page: 15 },
              percentageComplete: 30,
              deviceId: 'device-mobile',
            });

            expect(saved.percentageComplete).toBe(30);

            const fetched = await getProgress(userId, resourceId);
            expect(fetched).not.toBeNull();
            expect(fetched.percentageComplete).toBe(30);
            expect(fetched.deviceId).toBe('device-mobile');
          });

          test('Acceptance Criteria: Two near-simultaneous upserts for the same user+resource from different deviceIds resolve deterministically to whichever has the later updatedAt', async () => {
            const time1 = new Date('2026-08-20T10:00:00.000Z');
            const time2 = new Date('2026-08-20T10:05:00.000Z'); // Later timestamp

            // Fire near-simultaneous updates where Device B has a LATER timestamp (time2) than Device A (time1)
            const updateDeviceA = upsertProgress({
              userId,
              resourceId,
              resourceType: 'pdf',
              position: { page: 5 },
              percentageComplete: 10,
              deviceId: 'device-A',
              updatedAt: time1,
            });

            const updateDeviceB = upsertProgress({
              userId,
              resourceId,
              resourceType: 'pdf',
              position: { page: 25 },
              percentageComplete: 50,
              deviceId: 'device-B',
              updatedAt: time2,
            });

            await Promise.all([updateDeviceA, updateDeviceB]);

            // Check final state -> must resolve deterministically to device-B (time2)
            const finalProgress = await getProgress(userId, resourceId);
            expect(finalProgress.deviceId).toBe('device-B');
            expect(finalProgress.percentageComplete).toBe(50);
            expect(finalProgress.position.page).toBe(25);
            expect(new Date(finalProgress.updatedAt).getTime()).toBe(time2.getTime());
          });

          test('Out-of-order update with an EARLIER timestamp does not overwrite a NEWER existing progress record', async () => {
            const earlierTime = new Date('2026-08-20T10:00:00.000Z');
            const laterTime = new Date('2026-08-20T10:10:00.000Z');

            // First write with laterTime (e.g. from desktop)
            await upsertProgress({
              userId,
              resourceId,
              resourceType: 'epub',
              position: { cfi: 'epubcfi(/6/10)', page: 40 },
              percentageComplete: 80,
              deviceId: 'desktop-device',
              updatedAt: laterTime,
            });

            // Delayed write arriving later with earlierTime (e.g. offline phone sync)
            const result = await upsertProgress({
              userId,
              resourceId,
              resourceType: 'epub',
              position: { cfi: 'epubcfi(/6/2)', page: 10 },
              percentageComplete: 20,
              deviceId: 'delayed-mobile-device',
              updatedAt: earlierTime,
            });

            // Verify it resolved to the newer record
            expect(result.deviceId).toBe('desktop-device');
            expect(result.percentageComplete).toBe(80);

            const current = await getProgress(userId, resourceId);
            expect(current.deviceId).toBe('desktop-device');
            expect(current.percentageComplete).toBe(80);
          });

          test('Three near-simultaneous writes from different devices resolve deterministically to whichever had the latest timestamp', async () => {
            const t1 = new Date('2026-08-20T12:00:00.000Z');
            const t2 = new Date('2026-08-20T12:10:00.000Z');
            const t3 = new Date('2026-08-20T12:05:00.000Z'); // t2 is latest!

            const req1 = upsertProgress({
              userId,
              resourceId,
              resourceType: 'epub',
              position: { page: 10 },
              percentageComplete: 10,
              deviceId: 'device-1',
              updatedAt: t1,
            });

            const req2 = upsertProgress({
              userId,
              resourceId,
              resourceType: 'epub',
              position: { page: 90 },
              percentageComplete: 90,
              deviceId: 'device-2-latest',
              updatedAt: t2,
            });

            const req3 = upsertProgress({
              userId,
              resourceId,
              resourceType: 'epub',
              position: { page: 50 },
              percentageComplete: 50,
              deviceId: 'device-3',
              updatedAt: t3,
            });

            await Promise.all([req1, req2, req3]);

            const finalState = await getProgress(userId, resourceId);
            expect(finalState.deviceId).toBe('device-2-latest');
            expect(finalState.percentageComplete).toBe(90);
            expect(new Date(finalState.updatedAt).getTime()).toBe(t2.getTime());
          });
        });
      });

      describe('[Source: progressClockSkew.test.js]', () => {
        const mongoose = require('mongoose');
        const ReadingProgress = require('../models/ReadingProgress');
        const { upsertProgress, getProgress } = require('../services/progressService');

        describe('Phase 8: progressService Clock Skew Fix-Forward Test', () => {
          const userId = new mongoose.Types.ObjectId();
          const resourceId = new mongoose.Types.ObjectId();

          beforeAll(async () => {
            if (mongoose.connection.readyState === 0) {
              const uri =
                process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_clock_skew_test';
              await mongoose.connect(uri, {
                serverSelectionTimeoutMS: 2000,
                connectTimeoutMS: 2000,
              });
            }
            await ReadingProgress.deleteMany({});
          });

          afterAll(async () => {
            if (mongoose.connection.readyState !== 0) {
              await ReadingProgress.deleteMany({});
              // await // // mongoose.connection.close();
            }
          });

          beforeEach(async () => {
            await ReadingProgress.deleteMany({});
          });

          test('Future-skewed client timestamp is clamped to current server time', async () => {
            const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours in future

            const result = await upsertProgress({
              userId,
              resourceId,
              resourceType: 'pdf',
              position: { page: 50 },
              percentageComplete: 50,
              deviceId: 'future-skewed-device',
              updatedAt: futureTime,
            });

            expect(result).not.toBeNull();
            const storedTime = new Date(result.updatedAt).getTime();
            expect(storedTime).toBeLessThanOrEqual(Date.now() + 1000);

            // Subsequent normal write at current time can successfully update the progress
            const normalUpdate = await upsertProgress({
              userId,
              resourceId,
              resourceType: 'pdf',
              position: { page: 55 },
              percentageComplete: 55,
              deviceId: 'normal-device',
            });

            expect(normalUpdate.percentageComplete).toBe(55);
            expect(normalUpdate.deviceId).toBe('normal-device');
          });
        });
      });

      describe('[Source: readingProgress.test.js]', () => {
        const mongoose = require('mongoose');
        const ReadingProgress = require('../models/ReadingProgress');

        describe('ReadingProgress Schema & Upsert Integrity', () => {
          const userId = new mongoose.Types.ObjectId();
          const resourceId = new mongoose.Types.ObjectId();

          beforeAll(async () => {
            if (mongoose.connection.readyState === 0) {
              const uri = 'mongodb://127.0.0.1:27017/bookbuddy_progress_test';
              await mongoose.connect(uri, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000,
              });
            }

            await ReadingProgress.deleteMany({});
            await ReadingProgress.deleteMany({});
            await ReadingProgress.syncIndexes();
          });

          afterAll(async () => {
            if (mongoose.connection.readyState !== 0) {
              await ReadingProgress.deleteMany({});
            }
          });

          test('Creates ReadingProgress document with position, percentageComplete, and deviceId', async () => {
            const doc = await ReadingProgress.create({
              userId,
              resourceId,
              resourceType: 'epub',
              position: { cfi: 'epubcfi(/6/4[chapter1]!/4/2/1:0)', page: 12, scrollOffset: 450 },
              percentageComplete: 25.5,
              deviceId: 'device-mobile-xyz',
            });

            expect(doc.userId.toString()).toBe(userId.toString());
            expect(doc.resourceId.toString()).toBe(resourceId.toString());
            expect(doc.resourceType).toBe('epub');
            expect(doc.position.cfi).toBe('epubcfi(/6/4[chapter1]!/4/2/1:0)');
            expect(doc.position.page).toBe(12);
            expect(doc.position.scrollOffset).toBe(450);
            expect(doc.percentageComplete).toBe(25.5);
            expect(doc.deviceId).toBe('device-mobile-xyz');
          });

          test('Acceptance Criteria: Repeated upserts for the same user+resource always update the single existing document, never create duplicates', async () => {
            await ReadingProgress.deleteMany({});

            // First upsert -> creates initial document
            const doc1 = await ReadingProgress.upsertProgress(
              { userId, resourceId },
              {
                resourceType: 'pdf',
                position: { page: 5, scrollOffset: 120 },
                percentageComplete: 10,
                deviceId: 'reader-tablet-1',
              }
            );

            expect(doc1.position.page).toBe(5);
            expect(doc1.percentageComplete).toBe(10);

            const countAfterFirst = await ReadingProgress.countDocuments({ userId, resourceId });
            expect(countAfterFirst).toBe(1);

            // Second upsert -> updates the existing document
            const doc2 = await ReadingProgress.upsertProgress(
              { userId, resourceId },
              {
                resourceType: 'pdf',
                position: { page: 28, scrollOffset: 340 },
                percentageComplete: 55,
                deviceId: 'reader-laptop-2',
              }
            );

            expect(doc2._id.toString()).toBe(doc1._id.toString()); // Same document ID
            expect(doc2.position.page).toBe(28);
            expect(doc2.percentageComplete).toBe(55);
            expect(doc2.deviceId).toBe('reader-laptop-2');

            // Document count MUST still be 1 (no duplicates created)
            const countAfterSecond = await ReadingProgress.countDocuments({ userId, resourceId });
            expect(countAfterSecond).toBe(1);
          });

          test('Enforces compound unique index { userId: 1, resourceId: 1 } at DB layer', async () => {
            await ReadingProgress.deleteMany({});
            await ReadingProgress.create({
              userId,
              resourceId,
              resourceType: 'epub',
              position: { page: 1 },
              percentageComplete: 5,
            });

            let error = null;
            try {
              await ReadingProgress.create({
                userId,
                resourceId,
                resourceType: 'epub',
                position: { page: 2 },
                percentageComplete: 10,
              });
            } catch (err) {
              error = err;
            }

            expect(error).not.toBeNull();
            expect(error.code).toBe(11000);
          });
        });
      });
    });
  });
});
