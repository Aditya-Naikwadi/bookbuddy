/**
 * Consolidated Suite: social Feed And Inventory Watch
 * Merged from:
 *  - feedPost.test.js
 *  - feed.security.test.js
 *  - watchRequest.test.js
 *  - watchController.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('social Feed And Inventory Watch Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: feedPost.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_feed_test';

    const FeedPost = require('../models/FeedPost');
    const User = require('../models/User');
    const College = require('../models/College');
    const { createFeedPost, getFeedPosts, rsvpEvent } = require('../controllers/feedController');

    describe('FeedPost Schema & Endpoints (F5.1, F5.2, F5.3, F5.4)', () => {
      let collegeA, collegeB;
      let adminUser, studentUser;

      const mockRes = () => {
        let responseData = null;
        let statusCode = 200;
        const res = {
          status: (code) => {
            statusCode = code;
            return res;
          },
          json: (data) => {
            responseData = data;
            return res;
          },
        };
        return { res, getStatus: () => statusCode, getData: () => responseData };
      };

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
        await FeedPost.deleteMany({});
        await User.deleteMany({});
        await College.deleteMany({});

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

        adminUser = await User.create({
          studentId: `ADM_${Date.now()}`,
          name: 'Admin User',
          email: `admin_${Date.now()}@alpha.edu`,
          password: 'password123',
          role: 'college-admin',
          collegeId: collegeA._id,
        });

        studentUser = await User.create({
          studentId: `STU_${Date.now()}`,
          name: 'Student User',
          email: `student_${Date.now()}@alpha.edu`,
          password: 'password123',
          role: 'student',
          collegeId: collegeA._id,
        });
      });

      afterAll(async () => {
        await FeedPost.deleteMany({});
        await User.deleteMany({});
        await College.deleteMany({});
        // await // mongoose.connection.close();
      });

      describe('F5.1 — FeedPost Schema Single Discriminator', () => {
        it('Acceptance Criteria: announcement-type posts validate correctly against FeedPost schema', async () => {
          const post = await FeedPost.create({
            collegeId: collegeA._id,
            type: 'announcement',
            title: 'Library Renovation Update',
            body: 'The 2nd floor study wing will open tomorrow.',
            authorId: adminUser._id,
            audience: ['student', 'college-admin'],
          });

          expect(post._id).toBeDefined();
          expect(post.type).toBe('announcement');
          expect(post.title).toBe('Library Renovation Update');
          expect(post.collegeId.toString()).toBe(collegeA._id.toString());
        });

        it('Acceptance Criteria: event-type posts validate correctly against FeedPost schema', async () => {
          const eventDate = new Date(Date.now() + 86400000);
          const post = await FeedPost.create({
            collegeId: collegeA._id,
            type: 'event',
            title: 'Book Club Monthly Meetup',
            body: 'Join us for a discussion on Clean Code.',
            authorId: adminUser._id,
            eventDate,
            audience: ['student'],
          });

          expect(post._id).toBeDefined();
          expect(post.type).toBe('event');
          expect(post.eventDate).toEqual(eventDate);
        });

        it('should reject invalid post type values', async () => {
          await expect(
            FeedPost.create({
              collegeId: collegeA._id,
              type: 'invalid_type',
              title: 'Invalid',
              body: 'Invalid',
              authorId: adminUser._id,
            })
          ).rejects.toThrow();
        });
      });

      describe('F5.2 — Admin-Only Post Creation & Tenant Security', () => {
        it('Acceptance Criteria: a student-role request to post creation endpoint returns 403', async () => {
          const req = {
            user: { id: studentUser._id.toString(), role: 'student', collegeId: collegeA._id },
            body: {
              type: 'announcement',
              title: 'Student Attempt',
              body: 'Should be rejected',
            },
          };

          const { res } = mockRes();
          await expect(createFeedPost(req, res)).rejects.toHaveProperty('statusCode', 403);
        });

        it('Acceptance Criteria: a request with a spoofed collegeId in body is ignored (uses req.user.collegeId)', async () => {
          const req = {
            user: { id: adminUser._id.toString(), role: 'college-admin', collegeId: collegeA._id },
            body: {
              type: 'announcement',
              title: 'Admin Post with Spoofed College',
              body: 'Testing collegeId isolation',
              collegeId: collegeB._id.toString(), // Spoofed collegeId in body
            },
          };

          const { res, getStatus, getData } = mockRes();
          await createFeedPost(req, res);

          expect(getStatus()).toBe(201);
          const createdPost = getData().data;
          expect(createdPost).toBeDefined();
          expect(createdPost.collegeId.toString()).toBe(collegeA._id.toString());
          expect(createdPost.collegeId.toString()).not.toBe(collegeB._id.toString());
        });
      });

      describe('F5.3 — Student Feed Read Endpoint (Tenant + Audience + Expiry Filtered)', () => {
        beforeAll(async () => {
          // Past expired post
          await FeedPost.create({
            collegeId: collegeA._id,
            type: 'announcement',
            title: 'Expired Announcement',
            body: 'This event passed yesterday',
            authorId: adminUser._id,
            expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
            audience: ['student'],
          });

          // Active student post
          await FeedPost.create({
            collegeId: collegeA._id,
            type: 'announcement',
            title: 'Active Student Announcement',
            body: 'Welcome to campus',
            authorId: adminUser._id,
            expiresAt: new Date(Date.now() + 86400000), // 1 day in future
            audience: ['student'],
          });

          // Admin-only post
          await FeedPost.create({
            collegeId: collegeA._id,
            type: 'announcement',
            title: 'Admin Policy Change',
            body: 'Confidential admin note',
            authorId: adminUser._id,
            expiresAt: new Date(Date.now() + 86400000),
            audience: ['admin', 'college-admin'],
          });
        });

        it('Acceptance Criteria: a post whose expiresAt has passed never appears in response, and admin-only post never appears for a student requester', async () => {
          const req = {
            user: { id: studentUser._id.toString(), role: 'student', collegeId: collegeA._id },
            query: {},
          };

          const { res, getData } = mockRes();
          await getFeedPosts(req, res);

          const returnedPosts = getData().data;
          const titles = returnedPosts.map((p) => p.title);

          // Acceptance Criterion 1: Expired post MUST NOT appear
          expect(titles).not.toContain('Expired Announcement');

          // Acceptance Criterion 2: Admin-only post MUST NOT appear for student
          expect(titles).not.toContain('Admin Policy Change');

          // Active student post SHOULD appear
          expect(titles).toContain('Active Student Announcement');
        });
      });

      describe('F5.4 — RSVP Endpoint', () => {
        let eventPost, announcementPost;

        beforeAll(async () => {
          eventPost = await FeedPost.create({
            collegeId: collegeA._id,
            type: 'event',
            title: 'Hackathon 2026',
            body: 'Coding competition',
            authorId: adminUser._id,
            eventDate: new Date(Date.now() + 86400000),
            audience: ['student'],
            rsvps: [],
          });

          announcementPost = await FeedPost.create({
            collegeId: collegeA._id,
            type: 'announcement',
            title: 'General News',
            body: 'No RSVP allowed here',
            authorId: adminUser._id,
            audience: ['student'],
          });
        });

        it('Acceptance Criteria: returns a 400 if the target post type is not event', async () => {
          const req = {
            user: { id: studentUser._id.toString(), role: 'student', collegeId: collegeA._id },
            params: { id: announcementPost._id.toString() },
          };

          const { res } = mockRes();
          await expect(rsvpEvent(req, res)).rejects.toHaveProperty('statusCode', 400);
        });

        it('Acceptance Criteria: RSVP-ing twice by the same user toggles the entry off, rather than creating a duplicate entry', async () => {
          const req = {
            user: { id: studentUser._id.toString(), role: 'student', collegeId: collegeA._id },
            params: { id: eventPost._id.toString() },
          };

          // 1st RSVP call: Should toggle ON
          const { res: res1, getData: getData1 } = mockRes();
          await rsvpEvent(req, res1);

          expect(getData1().isRsvped).toBe(true);
          let updatedPost = await FeedPost.findById(eventPost._id);
          expect(updatedPost.rsvps).toHaveLength(1);
          expect(updatedPost.rsvps[0].userId.toString()).toBe(studentUser._id.toString());

          // 2nd RSVP call: Should toggle OFF
          const { res: res2, getData: getData2 } = mockRes();
          await rsvpEvent(req, res2);

          expect(getData2().isRsvped).toBe(false);
          updatedPost = await FeedPost.findById(eventPost._id);
          // Verified: Toggled off, rsvps length is 0 (no duplicate entries)
          expect(updatedPost.rsvps).toHaveLength(0);
        });
      });
    });
  });

  describe('[Source: feed.security.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_feed_sec_test';

    const app = require('../app');
    const FeedPost = require('../models/FeedPost');
    const User = require('../models/User');
    const College = require('../models/College');
    const { generateAccessToken } = require('../utils/token');

    describe('F5.6 & F5.5 — Cross-College Feed Security Isolation & Socket Broadcasting', () => {
      let collegeA, collegeB;
      let adminA, studentA, studentB;
      let tokenStudentA, tokenAdminA;
      let postA1, postA2, postB1_event;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }
        await FeedPost.deleteMany({});
        await User.deleteMany({});
        await College.deleteMany({});

        // Create College A and College B
        collegeA = await College.create({
          name: 'College Alpha',
          shortName: 'ALPHA',
          code: `ALPHA_SEC_${Date.now()}`,
        });

        collegeB = await College.create({
          name: 'College Beta',
          shortName: 'BETA',
          code: `BETA_SEC_${Date.now()}`,
        });

        // Create Users for College A and College B
        adminA = await User.create({
          studentId: `ADM_A_${Date.now()}`,
          name: 'Admin Alpha',
          email: `admin_${Date.now()}@alpha.edu`,
          password: 'password123',
          role: 'college-admin',
          collegeId: collegeA._id,
        });

        studentA = await User.create({
          studentId: `STU_A_${Date.now()}`,
          name: 'Student Alpha',
          email: `student_${Date.now()}@alpha.edu`,
          password: 'password123',
          role: 'student',
          collegeId: collegeA._id,
        });

        studentB = await User.create({
          studentId: `STU_B_${Date.now()}`,
          name: 'Student Beta',
          email: `student_${Date.now()}@beta.edu`,
          password: 'password123',
          role: 'student',
          collegeId: collegeB._id,
        });

        tokenAdminA = generateAccessToken(adminA);
        tokenStudentA = generateAccessToken(studentA);

        // Populate posts for College A and College B
        postA1 = await FeedPost.create({
          collegeId: collegeA._id,
          type: 'announcement',
          title: 'College A Official Announcement',
          body: 'Welcome students of College Alpha',
          authorId: adminA._id,
          audience: ['student'],
        });

        postA2 = await FeedPost.create({
          collegeId: collegeA._id,
          type: 'event',
          title: 'College A Hackathon',
          body: 'Coding event for Alpha students',
          authorId: adminA._id,
          eventDate: new Date(Date.now() + 86400000),
          audience: ['student'],
        });

        postB1_event = await FeedPost.create({
          collegeId: collegeB._id,
          type: 'event',
          title: 'College B Secret Event',
          body: 'Private event for Beta students only',
          authorId: new mongoose.Types.ObjectId(),
          eventDate: new Date(Date.now() + 86400000),
          audience: ['student'],
        });
      });

      afterAll(async () => {
        await FeedPost.deleteMany({});
        await User.deleteMany({});
        await College.deleteMany({});
        // await // mongoose.connection.close();
      });

      describe('F5.6 — Cross-College Feed Isolation Attack Vectors', () => {
        it('Attack Vector 1: Query-param manipulation — Student A attempting to fetch College B feed via ?collegeId= returns empty / College A posts only', async () => {
          const res = await request(app)
            .get(`/api/v1/feed?collegeId=${collegeB._id}`)
            .set('Authorization', `Bearer ${tokenStudentA}`);

          expect(res.statusCode).toBe(200);
          expect(res.body.success).toBe(true);

          const returnedPostIds = res.body.data.map((p) => p._id.toString());

          // STRICT ISOLATION ACCEPTANCE CRITERIA:
          // Must NOT leak College B's post
          expect(returnedPostIds).not.toContain(postB1_event._id.toString());
          // Must contain College A's post
          expect(returnedPostIds).toContain(postA1._id.toString());
        });

        it('Attack Vector 2: Header spoofing — Student A passing spoofed x-college-id / x-tenant-id headers receives ZERO College B data', async () => {
          const res = await request(app)
            .get('/api/v1/feed')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .set('x-college-id', collegeB._id.toString())
            .set('x-tenant-id', collegeB._id.toString())
            .set('x-requested-college', collegeB._id.toString());

          expect(res.statusCode).toBe(200);
          expect(res.body.success).toBe(true);

          const returnedPostIds = res.body.data.map((p) => p._id.toString());

          // STRICT ISOLATION ACCEPTANCE CRITERIA:
          // Spoofed headers MUST be ignored, zero College B records returned
          expect(returnedPostIds).not.toContain(postB1_event._id.toString());
          expect(returnedPostIds).toContain(postA1._id.toString());
        });

        it('Attack Vector 3: Direct post-ID guessing — Student A RSVPing to College B post returns 404 / 403 and does not modify College B post', async () => {
          const res = await request(app)
            .post(`/api/v1/feed/${postB1_event._id}/rsvp`)
            .set('Authorization', `Bearer ${tokenStudentA}`);

          // STRICT ISOLATION ACCEPTANCE CRITERIA: Returns 404/403, never modifies College B data
          expect([403, 404]).toContain(res.statusCode);

          // Verify DB state: College B post rsvps remains empty
          const freshPostB = await FeedPost.findById(postB1_event._id);
          expect(freshPostB.rsvps).toHaveLength(0);
        });

        it('Attack Vector 3b: Admin A attempting to create post for College B via spoofed body collegeId forces College A binding', async () => {
          const res = await request(app)
            .post('/api/v1/feed')
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .send({
              type: 'announcement',
              title: 'Spoofed Tenant Post',
              body: 'Attempting to inject post into College B',
              collegeId: collegeB._id.toString(),
            });

          expect(res.statusCode).toBe(201);
          expect(res.body.data.collegeId.toString()).toBe(collegeA._id.toString());
          expect(res.body.data.collegeId.toString()).not.toBe(collegeB._id.toString());
        });
      });

      describe('F5.5 — Socket.io College Room Broadcast Isolation', () => {
        it('Acceptance Criteria: broadcasting feed:new sends only to matching college room', async () => {
          const emittedEvents = [];
          const mockIo = {
            to: (room) => ({
              emit: (event, payload) => {
                emittedEvents.push({ room, event, payload });
              },
            }),
          };

          app.set('io', mockIo);

          const res = await request(app)
            .post('/api/v1/feed')
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .send({
              type: 'event',
              title: 'Live College A Hackathon Announcement',
              body: 'Broadcast test for Alpha room',
              eventDate: new Date(Date.now() + 86400000),
              audience: ['student'],
            });

          expect(res.statusCode).toBe(201);
          expect(emittedEvents).toHaveLength(1);

          // ACCEPTANCE CRITERIA: Live event emitted strictly to college:collegeA._id room
          expect(emittedEvents[0].room).toBe(`college:${collegeA._id}`);
          expect(emittedEvents[0].event).toBe('feed:new');
          expect(emittedEvents[0].payload.title).toBe('Live College A Hackathon Announcement');

          // Verified: No message emitted to collegeB room
          expect(emittedEvents[0].room).not.toBe(`college:${collegeB._id}`);
        });
      });
    });
  });

  describe('[Source: watchRequest.test.js]', () => {
    const mongoose = require('mongoose');
    const WatchRequest = require('../models/WatchRequest');

    describe('WatchRequest Schema & Duplicate Handling', () => {
      const userId = new mongoose.Types.ObjectId();
      const bookId = new mongoose.Types.ObjectId();

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_watch_test';
          await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 2000,
            connectTimeoutMS: 2000,
          });
        }
        await WatchRequest.deleteMany({});
        await WatchRequest.init();
      });

      afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
          await WatchRequest.deleteMany({});
        }
      });

      test('DB Layer: Throws code 11000 duplicate key error on duplicate (userId, bookId)', async () => {
        await WatchRequest.create({ userId, bookId });

        let duplicateErr = null;
        try {
          await WatchRequest.create({ userId, bookId });
        } catch (err) {
          duplicateErr = err;
        }

        expect(duplicateErr).not.toBeNull();
        expect(duplicateErr.code).toBe(11000);
      });

      test('Acceptance Criteria: Duplicate watch attempt by same user for same book is a no-op (caught duplicate-key error, no new document)', async () => {
        await WatchRequest.deleteMany({});

        // First watch attempt -> creates document
        const doc1 = await WatchRequest.createWatch({ userId, bookId });
        expect(doc1).not.toBeNull();
        expect(doc1.userId.toString()).toBe(userId.toString());
        expect(doc1.bookId.toString()).toBe(bookId.toString());

        const countAfterFirst = await WatchRequest.countDocuments({ userId, bookId });
        expect(countAfterFirst).toBe(1);

        // Second watch attempt -> caught duplicate-key error, no-op (no new document)
        const doc2 = await WatchRequest.createWatch({ userId, bookId });
        expect(doc2).not.toBeNull();

        const countAfterSecond = await WatchRequest.countDocuments({ userId, bookId });
        expect(countAfterSecond).toBe(1); // Document count remains 1
      });
    });
  });

  describe('[Source: watchController.test.js]', () => {
    const mongoose = require('mongoose');
    const request = require('supertest');
    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Book = require('../models/Book');
    const WatchRequest = require('../models/WatchRequest');
    const { generateTokenPair } = require('../utils/token');

    describe('Watch & Unwatch Book API Endpoints', () => {
      let college;
      let user;
      let token;
      let availableBook;
      let outOfStockBook;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_watch_api_test';
          try {
            await mongoose.connect(uri);
          } catch {
            // Fallback for isolated unit test runs
          }
        }

        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await WatchRequest.deleteMany({});

        college = await College.create({ name: 'Watch Test College', code: 'WTC' });
        user = await User.create({
          studentId: 'WATCH_STU_001',
          name: 'Watch Student',
          email: 'watcher@test.com',
          password: 'password123',
          role: 'student',
          collegeId: college._id,
        });

        token = generateTokenPair({
          id: user._id,
          _id: user._id,
          email: user.email,
          role: user.role,
          collegeId: college._id,
        }).accessToken;

        // Book with copies available (copiesAvailable = 2)
        availableBook = await Book.create({
          collegeId: college._id,
          isbn: '978-1000000001',
          title: 'In Stock Book',
          author: 'In Stock Author',
          category: 'Science',
          copiesTotal: 2,
          copiesAvailable: 2,
        });

        // Book with 0 copies available (out of stock)
        outOfStockBook = await Book.create({
          collegeId: college._id,
          isbn: '978-1000000002',
          title: 'Out of Stock Book',
          author: 'Out of Stock Author',
          category: 'Science',
          copiesTotal: 2,
          copiesAvailable: 0,
        });

        await WatchRequest.init();
      });

      afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
          await WatchRequest.deleteMany({});
          await Book.deleteMany({});
          await User.deleteMany({});
          await College.deleteMany({});
        }
      });

      test('Acceptance Criteria: Watching a book with >= 1 available copy returns 400 Bad Request and creates no WatchRequest', async () => {
        const res = await request(app)
          .post(`/api/v1/books/${availableBook._id}/watch`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/available copies/i);

        const watchCount = await WatchRequest.countDocuments({
          userId: user._id,
          bookId: availableBook._id,
        });
        expect(watchCount).toBe(0);
      });

      test('Watching an out-of-stock book (copiesAvailable === 0) creates a WatchRequest', async () => {
        const res = await request(app)
          .post(`/api/v1/books/${outOfStockBook._id}/watch`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.bookId).toBe(outOfStockBook._id.toString());

        const watchCount = await WatchRequest.countDocuments({
          userId: user._id,
          bookId: outOfStockBook._id,
        });
        expect(watchCount).toBe(1);
      });

      test('DELETE /api/books/:id/watch removes the WatchRequest document', async () => {
        const res = await request(app)
          .delete(`/api/v1/books/${outOfStockBook._id}/watch`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const watchCount = await WatchRequest.countDocuments({
          userId: user._id,
          bookId: outOfStockBook._id,
        });
        expect(watchCount).toBe(0);
      });
    });
  });
});
