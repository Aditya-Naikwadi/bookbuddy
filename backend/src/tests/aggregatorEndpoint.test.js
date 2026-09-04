const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_aggregator_endpoint_test';
process.env.JWT_SECRET = 'testjwtlibrarysecretkey999';

jest.setTimeout(30000);

const app = require('../app');
const UnifiedBook = require('../models/UnifiedBook');
const Book = require('../models/Book');
const College = require('../models/College');
const User = require('../models/User');
const { generateTokenPair } = require('../utils/token');

describe('Aggregator Endpoint & Global Access Regression Tests', () => {
  let college1, college2;
  let userCollege1Token, userCollege2Token;
  let sampleUnifiedBook1, sampleUnifiedBook2;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // 1. Create test colleges
    college1 = await College.create({
      name: 'Test Aggregator College 1',
      code: 'TAC1',
      domain: 'tac1.edu',
      status: 'active',
    });

    college2 = await College.create({
      name: 'Test Aggregator College 2',
      code: 'TAC2',
      domain: 'tac2.edu',
      status: 'active',
    });

    // 2. Create users & tokens for College 1 and College 2
    const user1 = await User.create({
      name: 'Student College 1',
      email: 'student1@tac1.edu',
      password: 'Password123!',
      role: 'student',
      studentId: 'STU-TAC1-001',
      collegeId: college1._id,
      college: college1._id,
      isVerified: true,
      isActive: true,
    });

    const user2 = await User.create({
      name: 'Student College 2',
      email: 'student2@tac2.edu',
      password: 'Password123!',
      role: 'student',
      studentId: 'STU-TAC2-002',
      collegeId: college2._id,
      college: college2._id,
      isVerified: true,
      isActive: true,
    });

    userCollege1Token = generateTokenPair(user1).accessToken;
    userCollege2Token = generateTokenPair(user2).accessToken;

    // 3. Create global UnifiedBook records (aggregated from external sources)
    sampleUnifiedBook1 = await UnifiedBook.create({
      title: 'Introduction to Algorithms (Aggregated)',
      authors: ['Thomas H. Cormen'],
      description: 'Comprehensive computer science textbook.',
      publishYear: 2009,
      isbns: ['9780262033848'],
      coverImageUrl: 'https://example.com/algo.jpg',
      sources: ['google_books', 'open_library'],
      normalizedTitleAuthor: 'introduction to algorithms thomas h cormen',
    });

    sampleUnifiedBook2 = await UnifiedBook.create({
      title: 'Frankenstein (Public Domain Aggregated)',
      authors: ['Mary Wollstonecraft Shelley'],
      description: 'Classic Gothic horror novel.',
      publishYear: 1818,
      isbns: ['9780141439471'],
      coverImageUrl: 'https://example.com/frankenstein.jpg',
      sources: ['gutendex'],
      normalizedTitleAuthor: 'frankenstein mary wollstonecraft shelley',
    });

    // 4. Create physical tenant-scoped books to verify physical catalog isolation is intact
    await Book.create({
      title: 'College 1 Physical Manual',
      author: 'Professor Alpha',
      category: 'Computer Science',
      isbn: '1111111111111',
      collegeId: college1._id,
      college: college1._id,
      copiesTotal: 5,
      copiesAvailable: 5,
      status: 'available',
    });
  });

  afterAll(async () => {
    if (sampleUnifiedBook1 && sampleUnifiedBook2) {
      await UnifiedBook.deleteMany({
        _id: { $in: [sampleUnifiedBook1._id, sampleUnifiedBook2._id] },
      }).catch(() => {});
    }
    if (college1 && college2) {
      await Book.deleteMany({ collegeId: { $in: [college1._id, college2._id] } }).catch(() => {});
      await User.deleteMany({ email: { $in: ['student1@tac1.edu', 'student2@tac2.edu'] } }).catch(
        () => {}
      );
      await College.deleteMany({ _id: { $in: [college1._id, college2._id] } }).catch(() => {});
    }
    await mongoose.disconnect().catch(() => {});
  });

  test('GET /api/v1/aggregator returns global aggregated books to User from College 1', async () => {
    const res = await request(app)
      .get('/api/v1/aggregator')
      .set('Authorization', `Bearer ${userCollege1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  test('GET /api/v1/aggregator returns identical global aggregated books to User from College 2', async () => {
    const res = await request(app)
      .get('/api/v1/aggregator')
      .set('Authorization', `Bearer ${userCollege2Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  test('GET /api/v1/aggregator supports searching by title/author/description query', async () => {
    const res = await request(app).get('/api/v1/aggregator?q=Algorithms');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title).toContain('Introduction to Algorithms');
  });

  test('Physical catalog tenant-isolation remains strictly enforced and unchanged', async () => {
    // User from College 2 should be Forbidden when attempting to access College 1 physical books endpoint
    const res = await request(app)
      .get(`/api/v1/college/${college1._id}/books`)
      .set('Authorization', `Bearer ${userCollege2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Forbidden');
  });
});
