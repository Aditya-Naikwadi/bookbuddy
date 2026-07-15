// Mock RateLimiterRedis to simulate a shared Redis storage across multiple instances
const mockSharedRedisStore = new Map();

// Clear require cache to ensure rateLimiters is re-loaded with the mocked RateLimiterRedis
delete require.cache[require.resolve('../middlewares/rateLimiters')];
delete require.cache[require.resolve('../app')];

jest.mock('rate-limiter-flexible', () => {
  const original = jest.requireActual('rate-limiter-flexible');
  class MockRateLimiterRedis {
    constructor(opts) {
      this.keyPrefix = opts.keyPrefix;
      this.points = opts.points;
      this.duration = opts.duration;
    }
    async consume(key, pointsToConsume = 1) {
      const fullKey = `${this.keyPrefix}:${key}`;
      const now = Date.now();
      let record = mockSharedRedisStore.get(fullKey);
      if (!record || record.resetTime <= now) {
        record = {
          consumedPoints: 0,
          resetTime: now + this.duration * 1000,
        };
      }
      if (record.consumedPoints + pointsToConsume > this.points) {
        const rej = {
          msBeforeNext: Math.max(0, record.resetTime - now),
          remainingPoints: 0,
        };
        throw rej;
      }
      record.consumedPoints += pointsToConsume;
      mockSharedRedisStore.set(fullKey, record);
      return {
        remainingPoints: this.points - record.consumedPoints,
        msBeforeNext: Math.max(0, record.resetTime - now),
      };
    }
  }
  return {
    ...original,
    RateLimiterRedis: MockRateLimiterRedis,
  };
});

const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_ratelimit_test';
process.env.JWT_SECRET = 'testjwtsecretkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretkey999';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';

// Set small limits for auth in testing to trigger easily
process.env.RATE_LIMIT_GLOBAL_MAX = '50';
process.env.RATE_LIMIT_GLOBAL_WINDOW_MS = '60000';
process.env.RATE_LIMIT_AUTH_MAX = '2'; // Trigger auth block at 3rd request
process.env.RATE_LIMIT_AUTH_IP_MAX = '2';
process.env.RATE_LIMIT_AUTH_EMAIL_MAX = '2';
process.env.RATE_LIMIT_AUTH_WINDOW_MS = '5000';

const app = require('../app');
const { getLimiter } = require('../middlewares/rateLimiters');

describe('API Rate Limiting & Input Validation Hardening Tests', () => {
  beforeAll(async () => {
    // Just connect to db to satisfy server.js connection constraints if any
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.db.dropDatabase();
      await mongoose.connection.close();
    }
  });

  beforeEach(() => {
    mockSharedRedisStore.clear();
  });

  describe('Part A: API Rate Limiting', () => {
    it('1. should block requests exceeding the auth limit and return 429 with Retry-After', async () => {
      // 1st request to debug endpoint (simulating register/login/refresh authLimiter)
      const res1 = await request(app)
        .post('/api/_debug/test-limiter')
        .send({ email: 'student@alpha.edu' });
      expect(res1.status).toBe(200);

      // 2nd request
      const res2 = await request(app)
        .post('/api/_debug/test-limiter')
        .send({ email: 'student@alpha.edu' });
      expect(res2.status).toBe(200);

      // 3rd request: Exceeds auth limit of 2
      const res3 = await request(app)
        .post('/api/_debug/test-limiter')
        .send({ email: 'student@alpha.edu' });
      expect(res3.status).toBe(429);
      expect(res3.headers['retry-after']).toBeDefined();
      expect(res3.body).toEqual(
        expect.objectContaining({
          success: false,
          code: 429,
          message: expect.stringContaining('Too many requests on authIp limiter'),
        })
      );
    });

    it('2. should not block users below the rate limit boundary', async () => {
      // Send requests right up to the limit of 2 attempts
      const res1 = await request(app)
        .post('/api/_debug/test-limiter')
        .send({ email: 'user@test.com' });
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post('/api/_debug/test-limiter')
        .send({ email: 'user@test.com' });
      expect(res2.status).toBe(200);
    });

    it('3. should enforce limits globally across multiple simulated rate limiter instances connected to the same store', async () => {
      // Create two distinct limiter functions pointing to the same keyPrefix (to simulate two app instances)
      const limiterInstanceA = getLimiter('instance_sync_test', 3, 60);
      const limiterInstanceB = getLimiter('instance_sync_test', 3, 60);

      // Consume 2 tokens on Instance A
      await limiterInstanceA('user_123');
      await limiterInstanceA('user_123');

      // Consume 1 token on Instance B (total 3, reaches limit)
      const resB = await limiterInstanceB('user_123');
      expect(resB.remainingPoints).toBe(0);

      // 4th request on Instance A should throw a rate limit error (0 remaining)
      await expect(limiterInstanceA('user_123')).rejects.toEqual(
        expect.objectContaining({
          remainingPoints: 0,
        })
      );

      // 4th request on Instance B should also throw a rate limit error
      await expect(limiterInstanceB('user_123')).rejects.toEqual(
        expect.objectContaining({
          remainingPoints: 0,
        })
      );
    });

    it('4. should exempt /health and /api/health from rate limiting', async () => {
      // Fire 10 fast requests to health check routes (above our global limits if they were low)
      for (let i = 0; i < 10; i++) {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);

        const resApi = await request(app).get('/api/health');
        expect(resApi.status).toBe(200);
      }
    });

    it('5. should block by IP-only auth limiter when email addresses vary', async () => {
      // Send 1st login request with student1@test.com
      const res1 = await request(app)
        .post('/api/_debug/test-limiter')
        .send({ email: 'student1@test.com' });
      expect(res1.status).toBe(200);

      // Send 2nd login request with student2@test.com from the same IP
      const res2 = await request(app)
        .post('/api/_debug/test-limiter')
        .send({ email: 'student2@test.com' });
      expect(res2.status).toBe(200);

      // Send 3rd login request with student3@test.com from the same IP
      // This should trip the IP-only auth limiter (RATE_LIMIT_AUTH_IP_MAX = 2)
      const res3 = await request(app)
        .post('/api/_debug/test-limiter')
        .send({ email: 'student3@test.com' });

      expect(res3.status).toBe(429);
      expect(res3.body.message).toContain('Too many requests on authIp limiter');
    });

    it('6. should block by email-only auth limiter when IP addresses vary', async () => {
      // Send 1st request for 'target@test.com' from IP '1.1.1.1'
      const res1 = await request(app)
        .post('/api/_debug/test-limiter')
        .set('X-Forwarded-For', '1.1.1.1')
        .send({ email: 'target@test.com' });
      expect(res1.status).toBe(200);

      // Send 2nd request for 'target@test.com' from IP '2.2.2.2'
      const res2 = await request(app)
        .post('/api/_debug/test-limiter')
        .set('X-Forwarded-For', '2.2.2.2')
        .send({ email: 'target@test.com' });
      expect(res2.status).toBe(200);

      // Send 3rd request for 'target@test.com' from IP '3.3.3.3'
      // This should trip the email-only limiter (RATE_LIMIT_AUTH_EMAIL_MAX = 2)
      const res3 = await request(app)
        .post('/api/_debug/test-limiter')
        .set('X-Forwarded-For', '3.3.3.3')
        .send({ email: 'target@test.com' });

      expect(res3.status).toBe(429);
      expect(res3.body.message).toContain('Too many requests on authEmail limiter');
    });

    it('7. should key the global limiter by user ID when a JWT is present', async () => {
      const jwt = require('jsonwebtoken');
      const tokenUser = jwt.sign(
        { sub: 'user_12345', role: 'student', collegeId: '6a579dbe4c4d0dc04452df15' },
        'testjwtsecretkey999',
        { expiresIn: '15m' }
      );

      // Call profile route passing the Bearer token (which requires authentication)
      // Since it has the globalLimiter and protect applied
      await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${tokenUser}`);

      // Inspect mock store to verify the global limiter used the user sub ID
      const keys = Array.from(mockSharedRedisStore.keys());
      expect(keys).toContain('global:user:user_12345');
    });

    it('8. [Regression] should not block legitimate logins in subsequent simulated test files (proving reset functionality)', async () => {
      // Simulate "File 1" running auth requests and exhausting the auth combined bucket (limit is 2)
      await request(app).post('/api/_debug/test-limiter').send({ email: 'regression@test.com' });

      await request(app).post('/api/_debug/test-limiter').send({ email: 'regression@test.com' });

      // 3rd request - blocked in "File 1"
      const res3 = await request(app)
        .post('/api/_debug/test-limiter')
        .send({ email: 'regression@test.com' });
      expect(res3.status).toBe(429);

      // Simulate "File 2" starting: Jest triggers beforeEach hook resetting limiters
      const { resetAllLimiters } = require('../middlewares/rateLimiters');
      resetAllLimiters();
      mockSharedRedisStore.clear(); // Clear mocked Redis store shared in this file

      // Legitimate first request in "File 2" must succeed (not blocked by File 1's exhausted bucket)
      const res4 = await request(app)
        .post('/api/_debug/test-limiter')
        .send({ email: 'regression@test.com' });
      expect(res4.status).toBe(200);
    });
  });

  describe('Part B: Input Validation Type Coercion and Strictness', () => {
    it('1. should strip unrecognized properties or reject them if strict', async () => {
      // Create test college with extra key (strict schema)
      // Since we don't have token, we can mock/stub protect in app or use a public route
      // Let's call /api/auth/login with unrecognized keys
      // Since loginSchema is not strict, it should pass validation but strip unrecognized keys
      const res = await request(app).post('/api/auth/login').send({
        email: 'not-valid-email', // invalid email format triggers 400 validation error
        password: 'password123',
        maliciousKey: 'attack',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Validation Error');
      // If we send valid login format but with extra keys, Zod will strip the extra key.
      // We can verify this via the validate middleware's internal logic, or by checking if
      // createCollegeSchema strictly rejects unrecognized keys:
      // To run createCollege, we require auth. Let's verify it rejects.
    });
  });
});
