const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_phase2_test';

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const { generateTokenPair } = require('../utils/token');
const { gutendexBreaker } = require('../services/gutendexClient');
const BookDTO = require('../dtos/BookDTO');
const ReservationDTO = require('../dtos/ReservationDTO');

describe('Phase 2 Roadmap Remediation Integration Tests', () => {
  let college;
  let admin;
  let tokenAdmin;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await College.deleteMany({});
    await User.deleteMany({});
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await College.deleteMany({});
    await User.deleteMany({});

    college = await College.create({
      name: 'Phase 2 College',
      code: 'P2C',
      domain: 'phase2.edu',
      status: 'active',
      isActive: true,
    });

    admin = await User.create({
      studentId: 'ADMIN_P2',
      name: 'Phase 2 Admin',
      email: 'admin@phase2.edu',
      password: 'password123',
      collegeId: college._id,
      role: 'super-admin',
      isActive: true,
    });

    tokenAdmin = generateTokenPair(admin).accessToken;
  });

  test('1. Circuit Breaker: Gutendex circuit breaker trips to OPEN mode on repeated failures', async () => {
    gutendexBreaker.state = 'CLOSED';
    gutendexBreaker.failureCount = 0;

    // Simulate 3 failures
    gutendexBreaker.onFailure(new Error('500 Internal Server Error'));
    gutendexBreaker.onFailure(new Error('500 Internal Server Error'));
    gutendexBreaker.onFailure(new Error('500 Internal Server Error'));

    expect(gutendexBreaker.state).toBe('OPEN');

    // Fire circuit breaker while OPEN -> Fast fails returning fallback empty list
    const fallbackResult = await gutendexBreaker.fire('physics');
    expect(fallbackResult).toEqual([]);
  });

  test('2. Async Aggregator: POST /api/v1/aggregator/sync returns HTTP 202 Ack with jobId', async () => {
    const res = await request(app)
      .post('/api/v1/aggregator/sync')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ topic: 'quantum physics' });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.jobId).toBeDefined();
    expect(res.body.statusUrl).toContain(res.body.jobId);

    // Query job status endpoint
    const statusRes = await request(app)
      .get(`/api/v1/aggregator/jobs/${res.body.jobId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.topic).toBe('quantum physics');
  });

  test('3. OpenAPI Specification: GET /api/v1/docs/swagger.json returns valid OpenAPI 3.0 schema', async () => {
    const res = await request(app).get('/api/v1/docs/swagger.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.info.title).toBe('BookBuddy Multi-Tenant API');
    expect(res.body.paths['/auth/login']).toBeDefined();
  });

  test('4. DTO Mappers: BookDTO and ReservationDTO format document payloads cleanly', () => {
    const bookDoc = {
      _id: new mongoose.Types.ObjectId('60d21b4667d0d8992e610d86'),
      title: 'Advanced AI Architectures',
      author: 'Dr. Jane Doe',
      category: 'Computer Science',
      copiesTotal: 5,
      copiesAvailable: 3,
    };

    const bookDto = BookDTO.transform(bookDoc);
    expect(bookDto.id).toBe('60d21b4667d0d8992e610d86');
    expect(bookDto.authors).toContain('Dr. Jane Doe');
    expect(bookDto.copiesAvailable).toBe(3);

    const resDoc = {
      _id: new mongoose.Types.ObjectId('60d21b4667d0d8992e610d87'),
      userId: new mongoose.Types.ObjectId('60d21b4667d0d8992e610d88'),
      bookId: bookDoc,
      queuePosition: 2,
      status: 'queued',
    };

    const resDto = ReservationDTO.transform(resDoc);
    expect(resDto.id).toBe('60d21b4667d0d8992e610d87');
    expect(resDto.queuePosition).toBe(2);
    expect(resDto.bookId.title).toBe('Advanced AI Architectures');
  });
});
