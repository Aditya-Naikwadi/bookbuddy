const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/bookbuddy_progress_controller_test';
process.env.JWT_SECRET = 'testjwtsecretreadingprogresstestkey123';
process.env.JWT_REFRESH_SECRET = 'testjwtrefreshreadingprogresstestkey123';
process.env.JWT_ACCESS_EXPIRY = '10m';
process.env.JWT_REFRESH_EXPIRY = '7d';

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const EResource = require('../models/EResource');
const ReadingProgress = require('../models/ReadingProgress');
const { generateTokenPair } = require('../utils/token');

describe('PUT/GET Reading Progress Endpoints Integration Tests', () => {
  let collegeA;
  let collegeB;
  let userA;
  let userB;
  let tokenUserA;
  let borrowedBook;
  let unborrowedBook;
  let collegeEResource;
  let otherCollegeEResource;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
      });
    }

    await College.deleteMany({});
    await User.deleteMany({});
    await Book.deleteMany({});
    await Loan.deleteMany({});
    await EResource.deleteMany({});
    await ReadingProgress.deleteMany({});

    // Seed Colleges
    collegeA = await College.create({ name: 'Progress Test College A', code: 'PTCA' });
    collegeB = await College.create({ name: 'Progress Test College B', code: 'PTCB' });

    // Seed Users
    userA = await User.create({
      studentId: 'PROGRESS_STU_001',
      name: 'User A',
      email: 'usera.progress@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    userB = await User.create({
      studentId: 'PROGRESS_STU_002',
      name: 'User B',
      email: 'userb.progress@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeB._id,
    });

    tokenUserA = generateTokenPair(userA).accessToken;

    // Seed Physical Books
    borrowedBook = await Book.create({
      collegeId: collegeA._id,
      title: 'Borrowed Physics Textbook',
      author: 'Dr. Newton',
      isbn: '978-0000000001',
      category: 'Science',
      copiesTotal: 5,
      copiesAvailable: 4,
    });

    unborrowedBook = await Book.create({
      collegeId: collegeA._id,
      title: 'Unborrowed Chemistry Book',
      author: 'Dr. Curie',
      isbn: '978-0000000002',
      category: 'Science',
      copiesTotal: 5,
      copiesAvailable: 5,
    });

    // Seed active Loan for userA and borrowedBook
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    await Loan.create({
      collegeId: collegeA._id,
      userId: userA._id,
      bookId: borrowedBook._id,
      issueDate: new Date(),
      dueDate,
      maxRenewals: 2,
      status: 'active',
      issuedBy: userA._id,
    });

    // Seed EResources
    collegeEResource = await EResource.create({
      collegeId: collegeA._id,
      title: 'Digital Calculus Guide',
      author: 'Leibniz',
      type: 'pdf',
      fileUrl: 'https://example.com/calculus.pdf',
      uploadedBy: userA._id,
      category: 'Mathematics',
      moderationStatus: 'approved',
      isPublished: true,
    });

    otherCollegeEResource = await EResource.create({
      collegeId: collegeB._id,
      title: 'College B Secret Journal',
      author: 'Anon',
      type: 'pdf',
      fileUrl: 'https://example.com/secret.pdf',
      uploadedBy: userB._id,
      category: 'General',
      moderationStatus: 'approved',
      isPublished: true,
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.connection.close();
    }
  });

  describe('Unauthenticated Requests', () => {
    it('GET /api/v1/reading-progress/:resourceId returns 401 when unauthenticated', async () => {
      const res = await request(app).get(`/api/v1/reading-progress/${borrowedBook._id}`);
      expect(res.status).toBe(401);
    });

    it('PUT /api/v1/reading-progress/:resourceId returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .put(`/api/v1/reading-progress/${borrowedBook._id}`)
        .send({ percentageComplete: 50 });
      expect(res.status).toBe(401);
    });
  });

  describe('Acceptance Criteria: 403 Forbidden for Unborrowed / Unauthorized Resources', () => {
    it('GET /api/v1/reading-progress/:resourceId returns 403 when user has not borrowed the book', async () => {
      const res = await request(app)
        .get(`/api/v1/reading-progress/${unborrowedBook._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access denied');
    });

    it('PUT /api/v1/reading-progress/:resourceId returns 403 when user has not borrowed the book', async () => {
      const res = await request(app)
        .put(`/api/v1/reading-progress/${unborrowedBook._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          percentageComplete: 20,
          position: { page: 5 },
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access denied');
    });

    it('GET /api/v1/reading-progress/:resourceId returns 403 for cross-tenant EResource access', async () => {
      const res = await request(app)
        .get(`/api/v1/reading-progress/${otherCollegeEResource._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(403);
    });

    it('PUT /api/v1/reading-progress/:resourceId returns 403 for non-existent resourceId', async () => {
      const randomId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/v1/reading-progress/${randomId}`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ percentageComplete: 10 });

      expect(res.status).toBe(403);
    });
  });

  describe('Successful PUT and GET for Borrowed Physical Books', () => {
    it('PUT /api/v1/reading-progress/:resourceId updates progress for a borrowed book', async () => {
      const res = await request(app)
        .put(`/api/v1/reading-progress/${borrowedBook._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          resourceType: 'epub',
          position: { cfi: 'epubcfi(/6/2[chap1])', page: 15 },
          percentageComplete: 30,
          deviceId: 'mobile-app-1',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.resourceId.toString()).toBe(borrowedBook._id.toString());
      expect(res.body.data.percentageComplete).toBe(30);
      expect(res.body.data.position.page).toBe(15);
      expect(res.body.data.deviceId).toBe('mobile-app-1');
    });

    it('GET /api/v1/reading-progress/:resourceId retrieves existing progress for a borrowed book', async () => {
      const res = await request(app)
        .get(`/api/v1/reading-progress/${borrowedBook._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).not.toBeNull();
      expect(res.body.data.percentageComplete).toBe(30);
      expect(res.body.data.position.cfi).toBe('epubcfi(/6/2[chap1])');
    });
  });

  describe('Successful PUT and GET for Accessible EResources', () => {
    it('PUT /api/v1/reading-progress/:resourceId creates progress for an EResource', async () => {
      const res = await request(app)
        .put(`/api/v1/reading-progress/${collegeEResource._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          resourceType: 'pdf',
          position: { page: 42, scrollOffset: 120 },
          percentageComplete: 75.5,
          deviceId: 'tablet-pro-9',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.percentageComplete).toBe(75.5);
      expect(res.body.data.position.page).toBe(42);
    });

    it('GET /api/v1/reading-progress/:resourceId retrieves progress for an EResource', async () => {
      const res = await request(app)
        .get(`/api/v1/reading-progress/${collegeEResource._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.percentageComplete).toBe(75.5);
      expect(res.body.data.deviceId).toBe('tablet-pro-9');
    });

    it('Legacy /api/reading-progress/:resourceId route functions identically', async () => {
      const res = await request(app)
        .get(`/api/reading-progress/${collegeEResource._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.percentageComplete).toBe(75.5);
    });
  });

  describe('Socket.io Real-time Progress Emission on Write', () => {
    it('Emits progress:updated to user room on successful PUT', async () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      const mockIo = { to: mockTo };

      app.set('io', mockIo);

      const res = await request(app)
        .put(`/api/v1/reading-progress/${borrowedBook._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          resourceType: 'epub',
          position: { page: 20 },
          percentageComplete: 45,
          deviceId: 'tab-2',
        });

      expect(res.status).toBe(200);
      expect(mockTo).toHaveBeenCalledWith(`user:${userA._id}`);
      expect(mockEmit).toHaveBeenCalledWith('progress:updated', {
        resourceId: borrowedBook._id.toString(),
        position: { page: 20 },
        percentageComplete: 45,
      });
    });
  });
});
