const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_tag_autocomplete_test';
jest.setTimeout(30000);

const app = require('../app');
const Tag = require('../models/Tag');

describe('GET /api/tags/autocomplete Endpoint', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await Tag.deleteMany({});
  });

  afterAll(async () => {
    await Tag.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Tag.deleteMany({});
  });

  it('1. Acceptance Criteria: typing "sci" returns "sci-fi" ranked above a rarely-used tag starting with "sci"', async () => {
    await Tag.create([
      { name: 'Scimitar', slug: 'scimitar', usageCount: 1 },
      { name: 'Sci-Fi', slug: 'sci-fi', usageCount: 150 },
      { name: 'Science', slug: 'science', usageCount: 10 },
      { name: 'History', slug: 'history', usageCount: 50 },
    ]);

    const res = await request(app).get('/api/tags/autocomplete?q=sci');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(3);

    const slugs = res.body.data.map((t) => t.slug);
    expect(slugs).toEqual(['sci-fi', 'science', 'scimitar']);
    expect(slugs).not.toContain('history');
  });

  it('2. should limit returned results to 10 max', async () => {
    const tagsToCreate = [];
    for (let i = 1; i <= 15; i++) {
      tagsToCreate.push({
        name: `Tech Tag ${i}`,
        slug: `tech-tag-${i}`,
        usageCount: i * 5,
      });
    }
    await Tag.create(tagsToCreate);

    const res = await request(app).get('/api/v1/tags/autocomplete?q=tech');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(10);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.data[0].slug).toBe('tech-tag-15'); // Highest usageCount first
  });

  it('3. should handle special regex characters safely without crashing', async () => {
    await Tag.create({ name: 'C++', slug: 'cpp', usageCount: 20 });

    const res = await request(app).get('/api/tags/autocomplete?q=c++(');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('4. should return top overall tags if search query q is empty', async () => {
    await Tag.create([
      { name: 'Popular Tag', slug: 'popular-tag', usageCount: 500 },
      { name: 'Obscure Tag', slug: 'obscure-tag', usageCount: 2 },
    ]);

    const res = await request(app).get('/api/tags/autocomplete');

    expect(res.status).toBe(200);
    expect(res.body.data[0].slug).toBe('popular-tag');
  });
});
