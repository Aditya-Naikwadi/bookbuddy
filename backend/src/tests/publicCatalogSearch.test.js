const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_public_search_test';

const app = require('../app');
const Book = require('../models/Book');
const College = require('../models/College');
const User = require('../models/User');
const { generateAccessToken } = require('../utils/token');
const { searchCatalogBooks } = require('../services/catalogSearchService');

describe('Public Resources & Advanced Search Integration (P2)', () => {
  let collegeA, collegeB;
  let studentA;
  let tokenStudentA;
  let publicBookA, restrictedBookA, publicBookB, restrictedBookB;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await Book.deleteMany({});
    await College.deleteMany({});
    await User.deleteMany({});

    collegeA = await College.create({
      name: 'Alpha Institute',
      shortName: 'ALPHA',
      code: `ALPHA_${Date.now()}`,
    });

    collegeB = await College.create({
      name: 'Beta University',
      shortName: 'BETA',
      code: `BETA_${Date.now()}`,
    });

    studentA = await User.create({
      studentId: `STU_A_${Date.now()}`,
      name: 'Alice Student',
      email: `alice_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });
    tokenStudentA = generateAccessToken(studentA);

    // Seed Books
    // 1. Public-eligible book in College A
    publicBookA = await Book.create({
      collegeId: collegeA._id,
      title: 'Shared Algorithms Manual',
      author: 'Donald Knuth',
      isbn: '978-0201896831',
      category: 'Computer Science',
      format: 'physical',
      copiesTotal: 5,
      copiesAvailable: 3,
      isShareableAcrossColleges: true,
    });

    // 2. College-restricted book in College A (NOT shareable / private)
    restrictedBookA = await Book.create({
      collegeId: collegeA._id,
      title: 'Alpha Private Exam Prep',
      author: 'Alpha Faculty',
      isbn: '978-1111111111',
      category: 'Exam Prep',
      format: 'physical',
      copiesTotal: 2,
      copiesAvailable: 2,
      isShareableAcrossColleges: false,
    });

    // 3. Public-eligible book in College B
    publicBookB = await Book.create({
      collegeId: collegeB._id,
      title: 'Open Chemistry Handbook',
      author: 'Marie Curie',
      isbn: '978-0486603445',
      category: 'Chemistry',
      format: 'digital',
      copiesTotal: 10,
      copiesAvailable: 10,
      isShareableAcrossColleges: true,
    });

    // 4. College-restricted book in College B
    restrictedBookB = await Book.create({
      collegeId: collegeB._id,
      title: 'Beta Secret Research Notes',
      author: 'Beta Lab',
      isbn: '978-2222222222',
      category: 'Chemistry',
      format: 'digital',
      copiesTotal: 1,
      copiesAvailable: 1,
      isShareableAcrossColleges: false,
    });
  });

  afterAll(async () => {
    await Book.deleteMany({});
    await College.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Shared catalogSearchService unit behavior', () => {
    it('1. should only return public-eligible books when scope is public', async () => {
      const result = await searchCatalogBooks({ scope: 'public' });
      const titles = result.books.map((b) => b.title);

      expect(titles).toContain('Shared Algorithms Manual');
      expect(titles).toContain('Open Chemistry Handbook');
      expect(titles).not.toContain('Alpha Private Exam Prep');
      expect(titles).not.toContain('Beta Secret Research Notes');
    });

    it('2. should return both shared and restricted books when scope is college', async () => {
      const result = await searchCatalogBooks({ scope: 'college', collegeId: collegeA._id });
      const titles = result.books.map((b) => b.title);

      expect(titles).toContain('Shared Algorithms Manual');
      expect(titles).toContain('Alpha Private Exam Prep');
      expect(titles).not.toContain('Open Chemistry Handbook');
      expect(titles).not.toContain('Beta Secret Research Notes');
    });

    it('3. should correctly filter by search term in public scope', async () => {
      const result = await searchCatalogBooks({ scope: 'public', q: 'Algorithms' });
      expect(result.books.length).toBe(1);
      expect(result.books[0].title).toBe('Shared Algorithms Manual');
    });
  });

  describe('HTTP endpoint behavior: /api/v1/college/:id/books/search', () => {
    it('4. should allow public unauthenticated search via scope=public without leaking restricted items', async () => {
      const res = await request(app).get('/api/v1/college/public/books/search?scope=public');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const titles = res.body.data.map((b) => b.title);
      expect(titles).toContain('Shared Algorithms Manual');
      expect(titles).toContain('Open Chemistry Handbook');
      expect(titles).not.toContain('Alpha Private Exam Prep');
      expect(titles).not.toContain('Beta Secret Research Notes');
    });

    it('5. should allow authenticated student to search college-scoped catalog', async () => {
      const res = await request(app)
        .get(`/api/v1/college/${collegeA._id}/books/search`)
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const titles = res.body.data.map((b) => b.title);
      expect(titles).toContain('Shared Algorithms Manual');
      expect(titles).toContain('Alpha Private Exam Prep');
      expect(titles).not.toContain('Beta Secret Research Notes');
    });

    it('6. should allow filtering by category in public search', async () => {
      const res = await request(app).get(
        '/api/v1/college/public/books/search?scope=public&category=Chemistry'
      );

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Open Chemistry Handbook');
    });
  });
});
