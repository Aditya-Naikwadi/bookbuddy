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
