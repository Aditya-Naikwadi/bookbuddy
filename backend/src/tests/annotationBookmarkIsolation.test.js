process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Annotation = require('../models/Annotation');
const Bookmark = require('../models/Bookmark');
const ReadingProgress = require('../models/ReadingProgress');
const ReadingPosition = require('../models/ReadingPosition');
const { generateTokenPair } = require('../utils/token');

describe('Security & Multi-Role Isolation: Bookmarks, Notes, and Highlights', () => {
  let collegeA, collegeB;
  let generalPatronA, tokenPatronA;
  let generalPatronB, tokenPatronB;
  let studentA, tokenStudentA;
  let studentB, tokenStudentB;
  let studentC, tokenStudentC;
  let collegeAdmin, tokenCollegeAdmin;

  beforeAll(async () => {
    // Ensure DB connection is established
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    // Clean test collections
    await User.deleteMany({ email: { $regex: /@isolation-test\.com$/ } });
    await College.deleteMany({ code: { $regex: /^ISO-/ } });
    await Annotation.deleteMany({});
    await Bookmark.deleteMany({});
    await ReadingProgress.deleteMany({});
    await ReadingPosition.deleteMany({});

    try {
      await User.collection.dropIndex('collegeId_1_studentId_1');
    } catch {
      // ignore
    }

    // 1. Create test colleges
    collegeA = await College.create({
      name: 'Isolation Test College Alpha',
      code: 'ISO-ALPHA',
      slug: 'iso-alpha',
      status: 'active',
      subscriptionTier: 'enterprise',
      features: { digital_annotations: true },
    });

    collegeB = await College.create({
      name: 'Isolation Test College Beta',
      code: 'ISO-BETA',
      slug: 'iso-beta',
      status: 'active',
      subscriptionTier: 'enterprise',
      features: { digital_annotations: true },
    });

    // 2. Create General Patrons (collegeId: null)
    generalPatronA = await User.create({
      name: 'Patron Alice',
      email: 'patron-alice@isolation-test.com',
      password: 'Password123!',
      role: 'general',
      collegeId: null,
      status: 'active',
    });
    tokenPatronA = generateTokenPair(generalPatronA).accessToken;

    generalPatronB = await User.create({
      name: 'Patron Bob',
      email: 'patron-bob@isolation-test.com',
      password: 'Password123!',
      role: 'general',
      collegeId: null,
      status: 'active',
    });
    tokenPatronB = generateTokenPair(generalPatronB).accessToken;

    // 3. Create Students in College Alpha (Same College)
    studentA = await User.create({
      studentId: 'STU-ALPHA-001',
      name: 'Student Alice Alpha',
      email: 'student-alice@isolation-test.com',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeA._id,
      status: 'active',
    });
    tokenStudentA = generateTokenPair(studentA).accessToken;

    studentB = await User.create({
      studentId: 'STU-ALPHA-002',
      name: 'Student Bob Alpha',
      email: 'student-bob@isolation-test.com',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeA._id,
      status: 'active',
    });
    tokenStudentB = generateTokenPair(studentB).accessToken;

    // 4. Create Student in College Beta (Different College)
    studentC = await User.create({
      studentId: 'STU-BETA-001',
      name: 'Student Charlie Beta',
      email: 'student-charlie@isolation-test.com',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeB._id,
      status: 'active',
    });
    tokenStudentC = generateTokenPair(studentC).accessToken;

    // 5. Create College Admin
    collegeAdmin = await User.create({
      name: 'Admin Alpha',
      email: 'admin-alpha@isolation-test.com',
      password: 'Password123!',
      role: 'college-admin',
      collegeId: collegeA._id,
      status: 'active',
    });
    tokenCollegeAdmin = generateTokenPair(collegeAdmin).accessToken;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $regex: /@isolation-test\.com$/ } });
    await College.deleteMany({ code: { $regex: /^ISO-/ } });
    await Annotation.deleteMany({});
    await Bookmark.deleteMany({});
    await ReadingProgress.deleteMany({});
    await ReadingPosition.deleteMany({});
  });

  describe('1. General Patron A vs. General Patron B Isolation (Both collegeId: null)', () => {
    let annotationIdA;

    it('allows General Patron A to create a highlight and note on a book without collegeId errors', async () => {
      const res = await request(app)
        .post('/api/v1/annotations')
        .set('Authorization', `Bearer ${tokenPatronA}`)
        .send({
          bookId: 'book-general-101',
          type: 'highlight',
          page: 12,
          highlightText: 'Important concept on operating systems',
          noteText: 'Review this before exam',
          color: 'yellow',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId.toString()).toBe(generalPatronA._id.toString());
      expect(res.body.data.collegeId).toBeNull();
      annotationIdA = res.body.data._id;
    });

    it('strictly isolates queries: General Patron B gets 0 annotations for the same book', async () => {
      const res = await request(app)
        .get('/api/v1/annotations')
        .set('Authorization', `Bearer ${tokenPatronB}`)
        .query({ bookId: 'book-general-101' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it('allows General Patron A to retrieve their own annotation for the book', async () => {
      const res = await request(app)
        .get('/api/v1/annotations')
        .set('Authorization', `Bearer ${tokenPatronA}`)
        .query({ bookId: 'book-general-101' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]._id.toString()).toBe(annotationIdA.toString());
      expect(res.body.data[0].highlightText).toBe('Important concept on operating systems');
    });
  });

  describe('2. Student A vs. Student B Isolation (Same College Tenant)', () => {
    let studentBookmarkA;

    it('allows Student A to create bookmark & study notes via student dashboard endpoint', async () => {
      const res = await request(app)
        .post('/api/v1/dashboards/student/bookmarks')
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .send({
          resourceId: 'eresource-alpha-202',
          bookTitle: 'Distributed Systems Principles',
          page: 45,
          highlightText: 'Raft consensus algorithm overview',
          noteText: 'Prepare slide deck',
          color: 'blue',
          tags: ['exam-prep'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      studentBookmarkA = res.body.data._id;
    });

    it('strictly isolates student bookmarks: Student B in same college sees 0 bookmarks', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/student/bookmarks')
        .set('Authorization', `Bearer ${tokenStudentB}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it('Student A sees their own bookmarks and annotations', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/student/bookmarks')
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.find(
        (b) =>
          b._id.toString() === studentBookmarkA.toString() || b.id === studentBookmarkA.toString()
      );
      expect(found).toBeDefined();
      expect(found.highlightText).toBe('Raft consensus algorithm overview');
    });
  });

  describe('3. Student A vs. Student C Isolation (Cross-College Tenants)', () => {
    it('Student C in College Beta cannot access Student A bookmarks or annotations', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/student/bookmarks')
        .set('Authorization', `Bearer ${tokenStudentC}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('4. IDOR Security Checks (Ownership Enforcement)', () => {
    let victimAnnotation;

    beforeAll(async () => {
      const doc = await Annotation.create({
        userId: generalPatronA._id,
        collegeId: null,
        bookId: 'book-idor-test',
        type: 'highlight',
        page: 3,
        highlightText: 'Victim secret note',
        noteText: 'Confidential diary',
        color: 'pink',
      });
      victimAnnotation = doc;
    });

    it('blocks User B from modifying User A annotation with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/v1/annotations/${victimAnnotation._id}`)
        .set('Authorization', `Bearer ${tokenPatronB}`)
        .send({
          noteText: 'Attacker tampered this note',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/permission/i);

      // Verify un-tampered in database
      const unchanged = await Annotation.findById(victimAnnotation._id);
      expect(unchanged.noteText).toBe('Confidential diary');
    });

    it('blocks User B from deleting User A annotation with 403 Forbidden', async () => {
      const res = await request(app)
        .delete(`/api/v1/annotations/${victimAnnotation._id}`)
        .set('Authorization', `Bearer ${tokenPatronB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);

      // Verify still exists in database
      const stillExists = await Annotation.findById(victimAnnotation._id);
      expect(stillExists).not.toBeNull();
    });

    it('allows owner User A to delete their own annotation', async () => {
      const res = await request(app)
        .delete(`/api/v1/annotations/${victimAnnotation._id}`)
        .set('Authorization', `Bearer ${tokenPatronA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await Annotation.findById(victimAnnotation._id);
      expect(deleted).toBeNull();
    });
  });

  describe('5. HTTP Cache-Control and Vary Header Verification', () => {
    it('sets private no-store headers on /api/v1/annotations', async () => {
      const res = await request(app)
        .get('/api/v1/annotations')
        .set('Authorization', `Bearer ${tokenPatronA}`)
        .query({ bookId: 'book-general-101' });

      expect(res.status).toBe(200);
      const cacheControl = res.headers['cache-control'] || '';
      expect(cacheControl).toContain('private');
      expect(cacheControl).toContain('no-store');
      expect(cacheControl).toContain('must-revalidate');

      const vary = res.headers['vary'] || '';
      expect(vary).toContain('Authorization');
    });

    it('sets private no-store headers on /api/v1/bookmarks/me', async () => {
      const res = await request(app)
        .get('/api/v1/bookmarks/me')
        .set('Authorization', `Bearer ${tokenPatronA}`);

      expect(res.status).toBe(200);
      const cacheControl = res.headers['cache-control'] || '';
      expect(cacheControl).toContain('private');
      expect(cacheControl).toContain('no-store');
      expect(res.headers['vary']).toContain('Authorization');
    });

    it('sets private no-store headers on /api/v1/dashboards/student/bookmarks', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/student/bookmarks')
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(res.status).toBe(200);
      const cacheControl = res.headers['cache-control'] || '';
      expect(cacheControl).toContain('private');
      expect(cacheControl).toContain('no-store');
      expect(res.headers['vary']).toContain('Authorization');
    });

    it('sets private no-store headers on /api/v1/reader/:resourceId/position', async () => {
      const res = await request(app)
        .get('/api/v1/reader/res-sample-pos-1/position')
        .set('Authorization', `Bearer ${tokenStudentA}`);

      const cacheControl = res.headers['cache-control'] || '';
      expect(cacheControl).toContain('private');
      expect(cacheControl).toContain('no-store');
      expect(res.headers['vary']).toContain('Authorization');
    });
  });

  describe('6. Reading Progress Cross-User Isolation', () => {
    it('persists distinct reading progress for User A and User B on the same book', async () => {
      const resourceId = 'gutenberg_1342';

      // User A reads to page 25 (25%)
      const putA = await request(app)
        .put(`/api/v1/reading-progress/${resourceId}`)
        .set('Authorization', `Bearer ${tokenPatronA}`)
        .send({
          percentageComplete: 25,
          position: { page: 25 },
        });
      expect(putA.status).toBe(200);

      // User B reads to page 90 (90%)
      const putB = await request(app)
        .put(`/api/v1/reading-progress/${resourceId}`)
        .set('Authorization', `Bearer ${tokenPatronB}`)
        .send({
          percentageComplete: 90,
          position: { page: 90 },
        });
      expect(putB.status).toBe(200);

      // User A reads their position
      const getA = await request(app)
        .get(`/api/v1/reading-progress/${resourceId}`)
        .set('Authorization', `Bearer ${tokenPatronA}`);
      expect(getA.status).toBe(200);
      expect(getA.body.data.percentageComplete).toBe(25);
      expect(getA.body.data.position.page).toBe(25);

      // User B reads their position
      const getB = await request(app)
        .get(`/api/v1/reading-progress/${resourceId}`)
        .set('Authorization', `Bearer ${tokenPatronB}`);
      expect(getB.status).toBe(200);
      expect(getB.body.data.percentageComplete).toBe(90);
      expect(getB.body.data.position.page).toBe(90);
    });
  });

  describe('7. Reload / Logout / Login Persistence Lifecycle', () => {
    it('User A bookmarks persist across logout and re-authentication, while User B sees none', async () => {
      // 1. User A creates a unique bookmark
      const createRes = await request(app)
        .post('/api/v1/annotations')
        .set('Authorization', `Bearer ${tokenPatronA}`)
        .send({
          bookId: 'book-lifecycle-test',
          type: 'bookmark',
          page: 99,
          label: 'Chapter 9 Final Review',
        });
      expect(createRes.status).toBe(201);

      // 2. User A "logs out" - User B logs in
      const queryUserB = await request(app)
        .get('/api/v1/annotations')
        .set('Authorization', `Bearer ${tokenPatronB}`)
        .query({ bookId: 'book-lifecycle-test' });
      expect(queryUserB.status).toBe(200);
      expect(queryUserB.body.data).toHaveLength(0);

      // 3. User A re-authenticates with fresh token
      const freshTokenA = generateTokenPair(generalPatronA).accessToken;
      const queryUserA = await request(app)
        .get('/api/v1/annotations')
        .set('Authorization', `Bearer ${freshTokenA}`)
        .query({ bookId: 'book-lifecycle-test' });

      expect(queryUserA.status).toBe(200);
      expect(queryUserA.body.data).toHaveLength(1);
      expect(queryUserA.body.data[0].label).toBe('Chapter 9 Final Review');
      expect(queryUserA.body.data[0].page).toBe(99);
    });
  });
});
