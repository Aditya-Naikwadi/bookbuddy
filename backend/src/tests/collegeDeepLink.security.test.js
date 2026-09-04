const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_test';

jest.setTimeout(30000);

const app = require('../app');
const College = require('../models/College');
const User = require('../models/User');

describe('F13 Security Suite — Public By-Slug Endpoint & College Deep Links', () => {
  let collegeA;
  let collegeB;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await College.deleteMany({ code: { $in: ['SPRING-01', 'SHELBY-01'] } });

    collegeA = await College.create({
      name: 'Springfield College',
      code: 'SPRING-01',
      slug: 'springfield-college',
      status: 'active',
      enabledFeatures: ['catalog', 'readingLists', 'bulletinBoard'],
    });

    collegeB = await College.create({
      name: 'Shelbyville Institute',
      code: 'SHELBY-01',
      slug: 'shelbyville-institute',
      status: 'active',
      enabledFeatures: ['catalog', 'loans'],
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await College.deleteMany({ code: { $in: ['SPRING-01', 'SHELBY-01'] } });
      await mongoose.connection.close();
    }
  });

  describe('F13.4 — Public GET /api/v1/colleges/by-slug/:slug payload over-fetching protection', () => {
    it('returns 200 with strictly ONLY name, slug, and enabledFeatures in data', async () => {
      const res = await request(app).get('/api/v1/colleges/by-slug/springfield-college');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const keys = Object.keys(res.body.data);
      expect(keys.sort()).toEqual(['enabledFeatures', 'name', 'slug']);

      expect(res.body.data.name).toBe('Springfield College');
      expect(res.body.data.slug).toBe('springfield-college');
      expect(Array.isArray(res.body.data.enabledFeatures)).toBe(true);

      // Verify ZERO over-fetching of sensitive fields
      expect(res.body.data._id).toBeUndefined();
      expect(res.body.data.collegeId).toBeUndefined();
      expect(res.body.data.adminUserId).toBeUndefined();
      expect(res.body.data.contactEmail).toBeUndefined();
      expect(res.body.data.creationPath).toBeUndefined();
    });

    it('returns 404 for non-existent college slug', async () => {
      const res = await request(app).get('/api/v1/colleges/by-slug/non-existent-slug');
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('F13.1 — College Slug Generation & Deduplication', () => {
    it('automatically generates unique slugs on college creation', async () => {
      const col1 = await College.create({
        name: 'Metropolis State University',
        code: 'METRO-01',
      });
      const col2 = await College.create({
        name: 'Metropolis State University',
        code: 'METRO-02',
      });

      expect(col1.slug).toBe('metropolis-state-university');
      expect(col2.slug).toBe('metropolis-state-university-1');
    });
  });
});
