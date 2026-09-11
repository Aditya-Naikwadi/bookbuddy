/**
 * Consolidated Suite: reviews And Discussions
 * Merged from:
 *  - reviewDuplicateKey.test.js
 *  - reviewPagination.test.js
 *  - reviewTransaction.test.js
 *  - profanityFilter.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('reviews And Discussions Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: reviewDuplicateKey.test.js]', () => {
    const mongoose = require('mongoose');
    const request = require('supertest');
    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Book = require('../models/Book');
    const Review = require('../models/Review');
    const { generateTokenPair } = require('../utils/token');

    describe('Review Schema & Duplicate Key Handling', () => {
      let college;
      let user;
      let book;
      let token;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_review_test';
          await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 2000,
            connectTimeoutMS: 2000,
          });
        }

        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await Review.deleteMany({});

        college = await College.create({ name: 'Review Test College', code: 'RTC' });
        user = await User.create({
          studentId: 'REV_STU_001',
          name: 'Reviewer Student',
          email: 'reviewer@test.com',
          password: 'password123',
          role: 'student',
          collegeId: college._id,
        });
        book = await Book.create({
          collegeId: college._id,
          isbn: '978-0000000001',
          title: 'Reviewable Book',
          author: 'Author Test',
          category: 'Fiction',
        });

        const tokens = generateTokenPair({
          id: user._id,
          _id: user._id,
          email: user.email,
          role: user.role,
          collegeId: college._id,
        });
        token = tokens.accessToken;

        // Ensure database indexes are created for Review model
        await Review.init();
      });

      afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
          await Review.deleteMany({});
          await Book.deleteMany({});
          await User.deleteMany({});
          await College.deleteMany({});
        }
      });

      test('DB Layer: Throws code 11000 duplicate-key error on duplicate (userId, bookId) write', async () => {
        const userId = new mongoose.Types.ObjectId();
        const bookId = new mongoose.Types.ObjectId();

        await Review.create({
          collegeId: college._id,
          userId,
          bookId,
          rating: 5,
          text: 'First review',
        });

        let duplicateErr = null;
        try {
          await Review.create({
            collegeId: college._id,
            userId,
            bookId,
            rating: 4,
            text: 'Second review by same user for same book',
          });
        } catch (err) {
          duplicateErr = err;
        }

        expect(duplicateErr).not.toBeNull();
        expect(duplicateErr.code).toBe(11000);
      });

      test('API Controller Layer: Returns 409 (Conflict) on duplicate review submit attempt', async () => {
        const freshBook = await Book.create({
          collegeId: college._id,
          isbn: '978-0000000002',
          title: 'Second Reviewable Book',
          author: 'Author Test 2',
          category: 'Science',
        });

        // First write request -> 201 Created
        const res1 = await request(app)
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${token}`)
          .send({
            bookId: freshBook._id,
            rating: 5,
            text: 'Great book!',
          });

        expect(res1.status).toBe(201);
        expect(res1.body.success).toBe(true);

        // Second write request by same user for same book -> 409 Conflict (not 500)
        const res2 = await request(app)
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${token}`)
          .send({
            bookId: freshBook._id,
            rating: 3,
            text: 'Trying to review again!',
          });

        expect(res2.status).toBe(409);
        expect(res2.body.success).toBe(false);
      });
    });
  });

  describe('[Source: reviewPagination.test.js]', () => {
    const mongoose = require('mongoose');
    const request = require('supertest');
    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Book = require('../models/Book');
    const Review = require('../models/Review');
    const { generateTokenPair } = require('../utils/token');

    describe('Review List Endpoint - Pagination, Filtering & Pinning Tests', () => {
      let college;
      let authorUser;
      let strangerUser;
      let flaggedAuthorUser;
      let book;
      let tokenAuthor;
      let tokenStranger;
      let tokenFlaggedAuthor;
      let ownFlaggedReview;
      let otherApprovedReviews = [];

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_pag_test';
          await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 2000,
            connectTimeoutMS: 2000,
          });
        }

        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await Review.deleteMany({});

        college = await College.create({ name: 'Pagination Test College', code: 'PAG' });

        authorUser = await User.create({
          studentId: 'PAG_STU_001',
          name: 'Author User',
          email: 'author@test.com',
          password: 'password123',
          role: 'student',
          collegeId: college._id,
        });

        strangerUser = await User.create({
          studentId: 'PAG_STU_002',
          name: 'Stranger User',
          email: 'stranger@test.com',
          password: 'password123',
          role: 'student',
          collegeId: college._id,
        });

        flaggedAuthorUser = await User.create({
          studentId: 'PAG_STU_003',
          name: 'Flagged Author User',
          email: 'flaggedauthor@test.com',
          password: 'password123',
          role: 'student',
          collegeId: college._id,
        });

        book = await Book.create({
          collegeId: college._id,
          isbn: '978-8888888888',
          title: 'Pagination & Pinning Book',
          author: 'Pag Author',
          category: 'General',
        });

        tokenAuthor = generateTokenPair({
          id: authorUser._id,
          _id: authorUser._id,
          email: authorUser.email,
          role: authorUser.role,
          collegeId: college._id,
        }).accessToken;

        tokenStranger = generateTokenPair({
          id: strangerUser._id,
          _id: strangerUser._id,
          email: strangerUser.email,
          role: strangerUser.role,
          collegeId: college._id,
        }).accessToken;

        tokenFlaggedAuthor = generateTokenPair({
          id: flaggedAuthorUser._id,
          _id: flaggedAuthorUser._id,
          email: flaggedAuthorUser.email,
          role: flaggedAuthorUser.role,
          collegeId: college._id,
        }).accessToken;

        // Seed 1 flagged review by flaggedAuthorUser
        ownFlaggedReview = await Review.create({
          collegeId: college._id,
          userId: flaggedAuthorUser._id,
          bookId: book._id,
          rating: 1,
          text: 'Flagged text with bad words',
          status: 'flagged',
        });

        // Seed 5 approved reviews by authorUser & other users
        for (let i = 1; i <= 5; i++) {
          const rev = await Review.create({
            collegeId: college._id,
            userId: i === 1 ? authorUser._id : new mongoose.Types.ObjectId(),
            bookId: book._id,
            rating: 4,
            text: `Approved review number ${i}`,
            status: 'approved',
            createdAt: new Date(Date.now() + i * 1000),
          });
          otherApprovedReviews.push(rev);
        }
      });

      afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
          await Review.deleteMany({});
          await Book.deleteMany({});
          await User.deleteMany({});
          await College.deleteMany({});
        }
      });

      test('Response includes total, page, and hasMore metadata with pagination', async () => {
        const res = await request(app)
          .get(`/api/v1/books/${book._id}/reviews?page=1&limit=2`)
          .set('Authorization', `Bearer ${tokenStranger}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body).toHaveProperty('total');
        expect(res.body).toHaveProperty('page', 1);
        expect(res.body).toHaveProperty('hasMore');
        expect(res.body.data.length).toBe(2);
        expect(res.body.hasMore).toBe(true);
        expect(res.body.total).toBe(5); // Stranger sees only the 5 approved reviews
      });

      test('A flagged review from another user NEVER appears in the list for strangerUser', async () => {
        const res = await request(app)
          .get(`/api/v1/books/${book._id}/reviews?page=1&limit=10`)
          .set('Authorization', `Bearer ${tokenStranger}`);

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(5);
        const hasFlagged = res.body.data.some((r) => r._id === ownFlaggedReview._id.toString());
        expect(hasFlagged).toBe(false);
      });

      test("The requesting user's own review (even if flagged) is included and pinned first", async () => {
        const res = await request(app)
          .get(`/api/v1/books/${book._id}/reviews?page=1&limit=10`)
          .set('Authorization', `Bearer ${tokenFlaggedAuthor}`);

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(6); // 1 own flagged + 5 approved = 6
        expect(res.body.data.length).toBe(6);
        expect(res.body.data[0]._id).toBe(ownFlaggedReview._id.toString()); // PINNED FIRST
        expect(res.body.data[0].status).toBe('flagged');
      });

      test('Pagination page 2 correctly skips the pinned review slot when user has an own review', async () => {
        const resPage1 = await request(app)
          .get(`/api/v1/books/${book._id}/reviews?page=1&limit=3`)
          .set('Authorization', `Bearer ${tokenFlaggedAuthor}`);

        expect(resPage1.body.data.length).toBe(3);
        expect(resPage1.body.data[0]._id).toBe(ownFlaggedReview._id.toString());
        expect(resPage1.body.hasMore).toBe(true);

        const resPage2 = await request(app)
          .get(`/api/v1/books/${book._id}/reviews?page=2&limit=3`)
          .set('Authorization', `Bearer ${tokenFlaggedAuthor}`);

        expect(resPage2.body.data.length).toBe(3);
        expect(resPage2.body.hasMore).toBe(false);
        expect(resPage2.body.data.some((r) => r._id === ownFlaggedReview._id.toString())).toBe(
          false
        );
      });
    });
  });

  describe('[Source: reviewTransaction.test.js]', () => {
    const mongoose = require('mongoose');
    const request = require('supertest');
    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Book = require('../models/Book');
    const Review = require('../models/Review');
    const { generateTokenPair } = require('../utils/token');

    describe('Review Transactional Aggregate Update & Rollback Tests', () => {
      let college;
      let user1;
      let user2;
      let book;
      let token1;
      let token2;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          const uri = 'mongodb://127.0.0.1:27017/bookbuddy_tx_test';
          await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
          });
        }

        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await Review.deleteMany({});

        college = await College.create({ name: 'TX Test College', code: 'TXC' });
        user1 = await User.create({
          studentId: 'TX_STU_001',
          name: 'TX User 1',
          email: 'tx1@test.com',
          password: 'password123',
          role: 'student',
          collegeId: college._id,
        });
        user2 = await User.create({
          studentId: 'TX_STU_002',
          name: 'TX User 2',
          email: 'tx2@test.com',
          password: 'password123',
          role: 'student',
          collegeId: college._id,
        });

        book = await Book.create({
          collegeId: college._id,
          isbn: '978-9999999999',
          title: 'Transactional Book',
          author: 'TX Author',
          category: 'Science',
          avgRating: 0,
          ratingCount: 0,
        });

        token1 = generateTokenPair({
          id: user1._id,
          _id: user1._id,
          email: user1.email,
          role: user1.role,
          collegeId: college._id,
        }).accessToken;

        token2 = generateTokenPair({
          id: user2._id,
          _id: user2._id,
          email: user2.email,
          role: user2.role,
          collegeId: college._id,
        }).accessToken;

        await Review.init();
      });

      afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
          await Review.deleteMany({});
          await Book.deleteMany({});
          await User.deleteMany({});
          await College.deleteMany({});
        }
      });

      test('Successful review submission transactionally updates Book avgRating and ratingCount', async () => {
        const res = await request(app)
          .post(`/api/v1/books/${book._id}/reviews`)
          .set('Authorization', `Bearer ${token1}`)
          .send({
            rating: 4,
            text: 'Solid 4 star book!',
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);

        const updatedBook = await Book.findById(book._id);
        expect(updatedBook.ratingCount).toBe(1);
        expect(updatedBook.avgRating).toBe(4);

        const reviewCount = await Review.countDocuments({ bookId: book._id, userId: user1._id });
        expect(reviewCount).toBe(1);
      });

      test('Acceptance Criteria: Simulated mid-transaction failure rolls back Review doc and leaves Book aggregate unchanged', async () => {
        const initialBook = await Book.findById(book._id);
        const initialAvg = initialBook.avgRating;
        const initialCount = initialBook.ratingCount;

        // Send request with simulated mid-transaction failure header
        const res = await request(app)
          .post(`/api/v1/books/${book._id}/reviews`)
          .set('Authorization', `Bearer ${token2}`)
          .set('x-simulate-failure', 'mid-transaction')
          .send({
            rating: 5,
            text: 'This review should be rolled back completely!',
          });

        // Should return 500 error due to simulated failure
        expect(res.status).toBe(500);

        // Verify Review document was NOT created/persisted
        const user2ReviewCount = await Review.countDocuments({
          bookId: book._id,
          userId: user2._id,
        });
        expect(user2ReviewCount).toBe(0);

        // Verify Book aggregate fields remain unchanged
        const afterBook = await Book.findById(book._id);
        expect(afterBook.ratingCount).toBe(initialCount);
        expect(afterBook.avgRating).toBe(initialAvg);
      });
    });
  });

  describe('[Source: profanityFilter.test.js]', () => {
    const mongoose = require('mongoose');
    const request = require('supertest');
    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Book = require('../models/Book');
    const Review = require('../models/Review');
    const { generateTokenPair } = require('../utils/token');

    describe('Profanity Filter Integration & Acceptance Tests', () => {
      let college;
      let user1;
      let user2;
      let book;
      let token1;
      let token2;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_profanity_test';
          await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 2000,
            connectTimeoutMS: 2000,
          });
        }

        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await Review.deleteMany({});

        college = await College.create({ name: 'Profanity Test College', code: 'PTC' });
        user1 = await User.create({
          studentId: 'PROF_STU_001',
          name: 'Clean Reviewer',
          email: 'clean@test.com',
          password: 'password123',
          role: 'student',
          collegeId: college._id,
        });
        user2 = await User.create({
          studentId: 'PROF_STU_002',
          name: 'Profane Reviewer',
          email: 'profane@test.com',
          password: 'password123',
          role: 'student',
          collegeId: college._id,
        });

        book = await Book.create({
          collegeId: college._id,
          isbn: '978-7777777777',
          title: 'Filter Testing Book',
          author: 'Filter Author',
          category: 'General',
        });

        token1 = generateTokenPair({
          id: user1._id,
          _id: user1._id,
          email: user1.email,
          role: user1.role,
          collegeId: college._id,
        }).accessToken;

        token2 = generateTokenPair({
          id: user2._id,
          _id: user2._id,
          email: user2.email,
          role: user2.role,
          collegeId: college._id,
        }).accessToken;

        await Review.init();
      });

      afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
          await Review.deleteMany({});
          await Book.deleteMany({});
          await User.deleteMany({});
          await College.deleteMany({});
        }
      });

      test('Clean review saves successfully with status "approved" and appears in public list', async () => {
        const res = await request(app)
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${token1}`)
          .send({
            bookId: book._id,
            rating: 5,
            text: 'This is an insightful and wonderful book!',
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('approved');

        const publicRes = await request(app)
          .get(`/api/v1/reviews/book/${book._id}`)
          .set('Authorization', `Bearer ${token1}`);

        expect(publicRes.status).toBe(200);
        expect(publicRes.body.data.length).toBe(1);
        expect(publicRes.body.data[0]._id).toBe(res.body.data._id);
      });

      test('Profane review saves successfully with status "flagged" and does NOT appear in approved public list', async () => {
        const res = await request(app)
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${token2}`)
          .send({
            bookId: book._id,
            rating: 1,
            text: 'This book is absolute hell and terrible bloody garbage!',
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('flagged');

        // Public list should still contain ONLY the 1 approved review
        const publicRes = await request(app)
          .get(`/api/v1/reviews/book/${book._id}`)
          .set('Authorization', `Bearer ${token1}`);

        expect(publicRes.status).toBe(200);
        expect(publicRes.body.data.length).toBe(1);
        expect(publicRes.body.data.some((r) => r._id === res.body.data._id)).toBe(false);
      });
    });
  });
});
