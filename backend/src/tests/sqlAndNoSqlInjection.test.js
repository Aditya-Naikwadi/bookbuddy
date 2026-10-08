process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');

const { createTestCollege, createTestUser } = require('./helpers/testFactories');
const { generateAccessToken } = require('../utils/token');

describe('SQL & NoSQL Injection Hardening Test Suite', () => {
  let testCollege;
  let testUser;
  let testBook;
  let authToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test');
    }

    testCollege = await createTestCollege({
      name: 'SQL Injection Test College',
      slug: 'sqlinject-college',
      code: 'SITC',
    });

    testUser = await createTestUser({
      collegeId: testCollege._id,
      email: 'sqlinject@example.com',
      password: 'SecurePassword123!',
      role: 'student',
    });

    authToken = generateAccessToken(testUser);

    testBook = await Book.create({
      title: 'SQL Injection Test Book',
      author: 'Security Researcher',
      isbn: '9780123456789',
      category: 'Computer Science',
      copiesTotal: 3,
      copiesAvailable: 3,
      collegeId: testCollege._id,
      isShareableAcrossColleges: true,
    });
  });

  afterAll(async () => {
    try {
      await College.deleteMany({ slug: 'sqlinject-college' });
      await User.deleteMany({ email: 'sqlinject@example.com' });
      await Book.deleteMany({ title: 'SQL Injection Test Book' });
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('1. NoSQL Operator Injection ({"$ne": null}, {"$gt": ""})', () => {
    it('1.1 Rejects {"$ne": null} in login payload at validation layer', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: { $ne: null },
          password: 'wrongpassword',
        });

      // Zod rejects non-string email with 400 Validation Error
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Validation Error|string/i);
    });

    it('1.2 Rejects {"$gt": ""} in password field at validation layer', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: { $gt: '' },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Validation Error|string|password/i);
    });

    it('1.3 Strips {"$ne": null} at root of body or query without crashing', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        $ne: null,
        password: 'somepassword',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('1.4 Strips $where clause from query parameters', async () => {
      const res = await request(app).get('/api/v1/dashboards/general/home-data').query({
        collegeId: testCollege._id.toString(),
        $where: 'this.collegeId != null',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('1.5 Strips prototype pollution keys (__proto__, constructor)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          __proto__: { isAdmin: true },
          email: 'notfound@example.com',
          password: 'Password123!',
        });

      expect(Object.prototype.isAdmin).toBeUndefined();
      expect([400, 401]).toContain(res.status);
    });
  });

  describe("2. SQL Injection Payloads (' OR '1'='1, '; DROP TABLE x;--)", () => {
    it("2.1 Treats ' OR '1'='1 in search query as plain literal string", async () => {
      const res = await request(app)
        .get('/api/v1/catalog/cross-college')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: "' OR '1'='1" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Treated as literal string; does NOT match "SQL Injection Test Book"
      const matched = (res.body.data?.books || []).some(
        (b) => b.title === 'SQL Injection Test Book'
      );
      expect(matched).toBe(false);
    });

    it("2.2 Treats '; DROP TABLE x;-- in search query as plain literal string", async () => {
      const res = await request(app)
        .get('/api/v1/catalog/cross-college')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: "'; DROP TABLE books;--" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Database collection still exists and is untouched
      const count = await Book.countDocuments({ _id: testBook._id });
      expect(count).toBe(1);
    });

    it('2.3 Treats SQL injection in auth login email as plain literal string', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: "admin' OR '1'='1'--",
        password: 'Password123!',
      });

      // Zod or auth layer treats as plain string and rejects credentials
      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Regex Injection & Special Character Safety (ReDoS Protection)', () => {
    it('3.1 Handles unclosed parenthesis and brackets without 500 MongoServerError', async () => {
      const res = await request(app)
        .get('/api/v1/catalog/cross-college')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: '([*+?^$' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3.2 Handles nested quantifiers (C++) safely without regex compile failure', async () => {
      const res = await request(app)
        .get('/api/v1/catalog/cross-college')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'C++' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('3.3 Handles wildcard (.*) safely without matching everything', async () => {
      const res = await request(app)
        .get('/api/v1/catalog/cross-college')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: '.*' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Should treat '.*' as literal characters, not regex match-all
      const found = (res.body.data?.books || []).some((b) => b.title === 'SQL Injection Test Book');
      expect(found).toBe(false);
    });
  });

  describe('4. Error Sanitization (No Raw DB Errors Leaked)', () => {
    it('4.1 CastError returns 400 with sanitized message and no internal stack in prod', async () => {
      const res = await request(app).get('/api/v1/help/articles/invalid-object-id-123');

      expect([400, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(res.body.message).not.toContain('MongoServerError');
    });
  });
});
