const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_tenant_test';
process.env.JWT_SECRET = 'testjwtlibrarysecretkey999';

jest.setTimeout(30000);

const app = require('../app');
const Book = require('../models/Book');
const User = require('../models/User');
const College = require('../models/College');
const { generateTokenPair } = require('../utils/token');

describe('Book API & Tenant Isolation Tests', () => {
  let collegeAId, collegeBId;
  let userAToken, userBToken;
  let bookA, bookB;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    collegeAId = new mongoose.Types.ObjectId().toString();
    collegeBId = new mongoose.Types.ObjectId().toString();

    // Create test colleges
    await College.create([
      { _id: collegeAId, name: 'College Alpha', code: 'ALPHA', status: 'active' },
      { _id: collegeBId, name: 'College Beta', code: 'BETA', status: 'active' },
    ]);

    // Create test users
    const userA = await User.create({
      name: 'Alice Student',
      email: 'alice@alpha.edu',
      studentId: 'STU_ALPHA_001',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeAId,
      isActive: true,
    });

    const userB = await User.create({
      name: 'Bob Student',
      email: 'bob@beta.edu',
      studentId: 'STU_BETA_002',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeBId,
      isActive: true,
    });

    userAToken = generateTokenPair(userA).accessToken;
    userBToken = generateTokenPair(userB).accessToken;

    // Create test books for each college
    bookA = await Book.create({
      collegeId: collegeAId,
      title: 'Alpha Quantum Physics',
      author: 'Dr. Alpha',
      isbn: '978-1111111111',
      category: 'Physics',
      copiesTotal: 5,
      copiesAvailable: 3,
      format: 'physical',
    });

    bookB = await Book.create({
      collegeId: collegeBId,
      title: 'Beta Machine Learning',
      author: 'Dr. Beta',
      isbn: '978-2222222222',
      category: 'Computer Science',
      copiesTotal: 4,
      copiesAvailable: 0,
      format: 'digital',
    });
  });

  afterAll(async () => {
    if (bookA && bookB) {
      await Book.deleteMany({ _id: { $in: [bookA._id, bookB._id] } });
    }
    await User.deleteMany({ email: { $in: ['alice@alpha.edu', 'bob@beta.edu'] } });
    await College.deleteMany({ _id: { $in: [collegeAId, collegeBId] } });
    await mongoose.connection.close();
  });

  describe('1. Canonical Book Shape & Endpoint Contract', () => {
    it('GET /api/v1/college/:id/books returns canonical book shape', async () => {
      const res = await request(app)
        .get(`/api/v1/college/${collegeAId}/books`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const firstBook = res.body.data[0];
      expect(firstBook).toHaveProperty('_id');
      expect(firstBook).toHaveProperty('title');
      expect(firstBook).toHaveProperty('author');
      expect(firstBook).toHaveProperty('isbn');
      expect(firstBook).toHaveProperty('category');
      expect(firstBook).toHaveProperty('coverUrl');
      expect(firstBook).toHaveProperty('collegeId', collegeAId);
      expect(firstBook).toHaveProperty('totalCopies');
      expect(firstBook).toHaveProperty('availableCopies');
      expect(firstBook).toHaveProperty('availabilityStatus');
      expect(firstBook).toHaveProperty('addedAt');
    });

    it('GET /api/v1/college/:id/books/stats returns catalog statistics', async () => {
      const res = await request(app)
        .get(`/api/v1/college/${collegeAId}/books/stats`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalCatalogBooks).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/college/:id/books/new-arrivals returns latest additions', async () => {
      const res = await request(app)
        .get(`/api/v1/college/${collegeAId}/books/new-arrivals`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/v1/college/:id/books/batch resolves books by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/college/${collegeAId}/books/batch?ids=${bookA._id}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Alpha Quantum Physics');
    });
  });

  describe('2. Strict Cross-College Tenant Isolation', () => {
    it('User from College A CANNOT fetch College B books (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/college/${collegeBId}/books`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(403);
    });

    it('User from College B CANNOT fetch College A book detail (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/college/${collegeAId}/books/${bookA._id}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
    });

    it('User from College A only sees College A books in list', async () => {
      const res = await request(app)
        .get(`/api/v1/college/${collegeAId}/books`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      const titles = res.body.data.map((b) => b.title);
      expect(titles).toContain('Alpha Quantum Physics');
      expect(titles).not.toContain('Beta Machine Learning');
    });
  });
});
