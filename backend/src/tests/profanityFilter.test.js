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
