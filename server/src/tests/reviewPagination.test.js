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
    expect(resPage2.body.data.some((r) => r._id === ownFlaggedReview._id.toString())).toBe(false);
  });
});
