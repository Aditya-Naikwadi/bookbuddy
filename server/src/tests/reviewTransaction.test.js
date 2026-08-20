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
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_tx_test';
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
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
    const user2ReviewCount = await Review.countDocuments({ bookId: book._id, userId: user2._id });
    expect(user2ReviewCount).toBe(0);

    // Verify Book aggregate fields remain unchanged
    const afterBook = await Book.findById(book._id);
    expect(afterBook.ratingCount).toBe(initialCount);
    expect(afterBook.avgRating).toBe(initialAvg);
  });
});
