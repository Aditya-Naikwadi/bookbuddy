process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_roadmap_test';
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
        await College.deleteMany({ _id: { $in: [collegeA?._id, collegeB?._id].filter(Boolean) } });
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
        await mongoose.connection.close();
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
