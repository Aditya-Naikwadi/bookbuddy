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
