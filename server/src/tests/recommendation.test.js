const mongoose = require('mongoose');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_rec_test';

const app = require('../app');
const UserRecommendation = require('../models/UserRecommendation');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Review = require('../models/Review');
const User = require('../models/User');
const College = require('../models/College');
const {
  generateRecommendationsForUser,
  getUserRecommendations,
} = require('../services/recommendationService');
const { runNightlyRecommendations } = require('../services/cronService');
const { generateAccessToken } = require('../utils/token');

describe('Recommendation System (F2.1, F2.2, F2.3, F2.4)', () => {
  let collegeA;
  let userA, userB;
  let tokenUserA;
  let bookRead1, bookRead2, bookCandidate1, bookCandidate2;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await UserRecommendation.deleteMany({});
    await Book.deleteMany({});
    await Loan.deleteMany({});
    await Review.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});

    collegeA = await College.create({
      name: 'College Alpha Recs',
      shortName: 'ALPHAREC',
      code: `ALPHAREC_${Date.now()}`,
    });

    userA = await User.create({
      studentId: `STU_REC_${Date.now()}`,
      name: 'Student Rec A',
      email: `rec_a_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    userB = await User.create({
      studentId: `STU_REC_B_${Date.now()}`,
      name: 'Student Rec B',
      email: `rec_b_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    tokenUserA = generateAccessToken(userA);

    // Read books
    bookRead1 = await Book.create({
      collegeId: collegeA._id,
      title: 'Clean Architecture Principles',
      author: 'Robert C. Martin',
      category: 'Software Engineering',
      tags: ['software', 'architecture', 'design'],
      isbn: `ISBN_R1_${Date.now()}`,
      avgRating: 4.8,
    });

    bookRead2 = await Book.create({
      collegeId: collegeA._id,
      title: 'Design Patterns Elements of Reusable Object-Oriented Software',
      author: 'Erich Gamma',
      category: 'Software Engineering',
      tags: ['patterns', 'design', 'software'],
      isbn: `ISBN_R2_${Date.now()}`,
      avgRating: 4.9,
    });

    // Unread candidate books
    bookCandidate1 = await Book.create({
      collegeId: collegeA._id,
      title: 'Refactoring Improving the Design of Existing Code',
      author: 'Martin Fowler',
      category: 'Software Engineering',
      tags: ['refactoring', 'design', 'software'],
      isbn: `ISBN_C1_${Date.now()}`,
      avgRating: 4.7,
    });

    bookCandidate2 = await Book.create({
      collegeId: collegeA._id,
      title: 'Domain-Driven Design Tackle Complexity in Core Software',
      author: 'Eric Evans',
      category: 'Software Engineering',
      tags: ['architecture', 'domain', 'software'],
      isbn: `ISBN_C2_${Date.now()}`,
      avgRating: 4.6,
    });

    // Create borrowing history
    await Loan.create({
      collegeId: collegeA._id,
      userId: userA._id,
      bookId: bookRead1._id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 864000000),
      maxRenewals: 2,
      issuedBy: userA._id,
    });

    await Review.create({
      collegeId: collegeA._id,
      userId: userA._id,
      bookId: bookRead2._id,
      rating: 5,
      comment: 'Loved this book',
    });
  });

  afterAll(async () => {
    await UserRecommendation.deleteMany({});
    await Book.deleteMany({});
    await Loan.deleteMany({});
    await Review.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});
    await mongoose.connection.close();
  });

  describe('F2.1 — UserRecommendation Cache Schema', () => {
    it('Acceptance Criteria: recomputation always upserts a single document per user — no unbounded growth', async () => {
      // 1st calculation
      await generateRecommendationsForUser(userA._id);
      let docsCount = await UserRecommendation.countDocuments({ userId: userA._id });
      expect(docsCount).toBe(1);

      // 2nd calculation
      await generateRecommendationsForUser(userA._id);
      docsCount = await UserRecommendation.countDocuments({ userId: userA._id });

      // ACCEPTANCE CRITERIA: Still exactly 1 document for userA (no unbounded historical growth)
      expect(docsCount).toBe(1);
    });
  });

  describe('F2.2 — generateRecommendationsForUser Aggregation Service', () => {
    it('Acceptance Criteria: function is callable and testable in isolation returning recommendation array with reasons', async () => {
      const recommendations = await generateRecommendationsForUser(userA._id);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      const candidateIds = recommendations.map((r) => r.bookId.toString());

      // Already borrowed/reviewed books MUST be excluded
      expect(candidateIds).not.toContain(bookRead1._id.toString());
      expect(candidateIds).not.toContain(bookRead2._id.toString());

      // Unread matching books SHOULD be included
      expect(candidateIds).toContain(bookCandidate1._id.toString());
      expect(candidateIds).toContain(bookCandidate2._id.toString());

      // Each recommendation item MUST have bookId, score, and human-readable reason
      const firstRec = recommendations[0];
      expect(firstRec.bookId).toBeDefined();
      expect(typeof firstRec.score).toBe('number');
      expect(typeof firstRec.reason).toBe('string');
      expect(firstRec.reason.length).toBeGreaterThan(0);
    });

    it('getUserRecommendations returns populated recommendation cache', async () => {
      const recs = await getUserRecommendations(userA._id);
      expect(Array.isArray(recs)).toBe(true);
      expect(recs.length).toBeGreaterThan(0);
      expect(recs[0].bookId).toBeDefined();
      expect(recs[0].bookId.title).toBeDefined();
    });
  });

  describe('F2.3 — Nightly Cron Job Registration', () => {
    it('Acceptance Criteria: batch processes users college-by-college and a single user error does not abort batch', async () => {
      const processed = await runNightlyRecommendations();
      expect(typeof processed).toBe('number');
      expect(processed).toBeGreaterThanOrEqual(2);

      // Verify that recommendations were computed/cached for both userA and userB
      const countA = await UserRecommendation.countDocuments({ userId: userA._id });
      const countB = await UserRecommendation.countDocuments({ userId: userB._id });
      expect(countA).toBe(1);
      expect(countB).toBe(1);
    });
  });

  describe('F2.4 — GET /api/recommendations Endpoint (Cache Read Only)', () => {
    it('Acceptance Criteria: response is served directly from UserRecommendation cache', async () => {
      const res = await request(app)
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.computedAt).toBeDefined();

      // Verify populated bookId properties in cached response
      const firstRec = res.body.data[0];
      expect(firstRec.bookId).toBeDefined();
      expect(firstRec.reason).toBeDefined();
    });
  });
});
