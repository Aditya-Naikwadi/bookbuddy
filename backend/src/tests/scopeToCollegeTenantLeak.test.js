process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_scopetocollege_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testjwtlibrarysecretkey999';

jest.setTimeout(30000);

const request = require('supertest');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const app = require('../app');

const Book = require('../models/Book');
const EResource = require('../models/EResource');
const Feedback = require('../models/Feedback');
const Complaint = require('../models/Complaint');
const College = require('../models/College');
const User = require('../models/User');
const { scopeToCollege } = require('../middlewares/scopeToCollege');

describe('F0.1 Tenant-Scoping Helper & Plugin Acceptance Tests', () => {
  let collegeA, collegeB;
  let userA, userB;
  let tokenA, tokenB;
  let bookA, bookB;
  let eResourceA, eResourceB;
  let feedbackA, feedbackB;
  let complaintA, complaintB;

  beforeAll(async () => {
    await connectDB();

    collegeA = await College.create({
      name: 'College Alpha F01',
      code: `C_ALPHA_${Date.now()}`,
      status: 'active',
    });

    collegeB = await College.create({
      name: 'College Beta F01',
      code: `C_BETA_${Date.now()}`,
      status: 'active',
    });

    userA = await User.create({
      studentId: `STU_A_${Date.now()}`,
      name: 'Alice Alpha',
      email: `alice_${Date.now()}@alphaf01.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    userB = await User.create({
      studentId: `STU_B_${Date.now()}`,
      name: 'Bob Beta',
      email: `bob_${Date.now()}@betaf01.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeB._id,
    });

    const { generateAccessToken } = require('../utils/token');
    tokenA = generateAccessToken(userA);
    tokenB = generateAccessToken(userB);

    bookA = await Book.create({
      collegeId: collegeA._id,
      title: 'Alpha Internal Textbook',
      author: 'Author A',
      isbn: `978-${Date.now().toString().slice(-10)}`,
      category: 'Science',
    });

    bookB = await Book.create({
      collegeId: collegeB._id,
      title: 'Beta Internal Textbook',
      author: 'Author B',
      isbn: `978-${(Date.now() + 1).toString().slice(-10)}`,
      category: 'Science',
    });

    eResourceA = await EResource.create({
      collegeId: collegeA._id,
      title: 'Alpha Private E-Resource',
      author: 'Author A',
      type: 'pdf',
      fileUrl: '/uploads/ebooks/testA.pdf',
      category: 'Computer Science',
      source: 'internal',
      moderationStatus: 'approved',
      uploadedBy: userA._id,
    });

    eResourceB = await EResource.create({
      collegeId: collegeB._id,
      title: 'Beta Private E-Resource',
      author: 'Author B',
      type: 'pdf',
      fileUrl: '/uploads/ebooks/testB.pdf',
      category: 'Computer Science',
      source: 'internal',
      moderationStatus: 'approved',
      uploadedBy: userB._id,
    });

    feedbackA = await Feedback.create({
      collegeId: collegeA._id,
      submittedBy: userA._id,
      category: 'general',
      message: 'Alpha feedback content',
      rating: 5,
    });

    feedbackB = await Feedback.create({
      collegeId: collegeB._id,
      submittedBy: userB._id,
      category: 'general',
      message: 'Beta feedback content',
      rating: 4,
    });

    complaintA = await Complaint.create({
      collegeId: collegeA._id,
      submittedBy: userA._id,
      subject: 'Alpha noise complaint',
      description: 'Quiet study area noise level high',
    });

    complaintB = await Complaint.create({
      collegeId: collegeB._id,
      submittedBy: userB._id,
      subject: 'Beta printer complaint',
      description: '3rd floor printer out of paper',
    });
  });

  afterAll(async () => {
    try {
      await Book.deleteMany({ _id: { $in: [bookA._id, bookB._id] } });
      await EResource.deleteMany({ _id: { $in: [eResourceA._id, eResourceB._id] } });
      await Feedback.deleteMany({ _id: { $in: [feedbackA._id, feedbackB._id] } });
      await Complaint.deleteMany({ _id: { $in: [complaintA._id, complaintB._id] } });
      await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
      await College.deleteMany({ _id: { $in: [collegeA._id, collegeB._id] } });
    } catch {
      // Ignore cleanup
    } finally {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    }
  });

  describe('Unit Test: scopeToCollege Helper function', () => {
    test('Should auto-inject collegeId into blank filter', () => {
      const scoped = scopeToCollege({}, collegeA._id);
      expect(scoped.collegeId.toString()).toBe(collegeA._id.toString());
    });

    test('Should preserve original filter properties while attaching collegeId', () => {
      const scoped = scopeToCollege({ category: 'Science' }, collegeA._id);
      expect(scoped.category).toBe('Science');
      expect(scoped.collegeId.toString()).toBe(collegeA._id.toString());
    });
  });

  describe('Model Query Scoping via Plugin', () => {
    test('Model method with query option tenantId returns only same-tenant documents', async () => {
      const booksA = await Book.find({}, null, { tenantId: collegeA._id });
      const bookIds = booksA.map((b) => b._id.toString());
      expect(bookIds).toContain(bookA._id.toString());
      expect(bookIds).not.toContain(bookB._id.toString());
    });

    test('Saving new tenant model document without collegeId throws CRITICAL TENANT ERROR', async () => {
      const invalidBook = new Book({
        title: 'Unassigned College Book',
        author: 'No One',
        isbn: '12345',
        category: 'General',
      });

      await expect(invalidBook.save()).rejects.toThrow(/CRITICAL TENANT ERROR/i);
    });
  });

  describe('Controller API Scoping Regression Tests (Book, EResource, Feedback, Complaint)', () => {
    test('GET /api/v1/books - Should return ONLY College A books for User A', async () => {
      const res = await request(app).get('/api/v1/books').set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      const bookIds = res.body.books.map((b) => b.id || b._id);
      expect(bookIds).toContain(bookA._id.toString());
      expect(bookIds).not.toContain(bookB._id.toString());
    });

    test('GET /api/v1/eresources - Should return ONLY College A e-resources for User A', async () => {
      const res = await request(app)
        .get('/api/v1/eresources')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      const ids = res.body.data.map((r) => r._id.toString());
      expect(ids).toContain(eResourceA._id.toString());
      expect(ids).not.toContain(eResourceB._id.toString());
    });

    test('GET /api/v1/feedback - Should return ONLY College A feedback for User A', async () => {
      const res = await request(app)
        .get('/api/v1/feedback')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      const ids = res.body.data.map((f) => f._id.toString());
      expect(ids).toContain(feedbackA._id.toString());
      expect(ids).not.toContain(feedbackB._id.toString());
    });

    test('GET /api/v1/complaints - Should return ONLY User A complaints for User A', async () => {
      const res = await request(app)
        .get('/api/v1/complaints')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      const ids = res.body.data.map((c) => c._id.toString());
      expect(ids).toContain(complaintA._id.toString());
      expect(ids).not.toContain(complaintB._id.toString());
    });
  });
});
