const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testjwtsecretkey999';

const app = require('../app');
const User = require('../models/User');
const Loan = require('../models/Loan');
const Fine = require('../models/Fine');
const PlatformMetricSnapshot = require('../models/PlatformMetricSnapshot');
const { generateAccessToken } = require('../utils/token');
const { redisClient } = require('../middlewares/rateLimiters');

describe('STAGE 4: Overview Metrics Caching & Redis Fallback Test', () => {
  let superAdminUser;
  let superAdminToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
    }

    await User.deleteMany({ email: 'redis.test.sa@bookbuddy.internal' });
    await PlatformMetricSnapshot.deleteMany({ collegeId: null });
    await Loan.deleteMany({});
    await Fine.deleteMany({});

    superAdminUser = await User.create({
      studentId: 'SA-REDIS-001',
      name: 'Redis Test Admin',
      email: 'redis.test.sa@bookbuddy.internal',
      password: 'SuperAdminPass123!',
      role: 'super-admin',
      status: 'active',
    });
    superAdminToken = generateAccessToken(superAdminUser);

    // Seed a PlatformMetricSnapshot for DB fallback test
    await PlatformMetricSnapshot.create({
      collegeId: null,
      snapshotDate: new Date(),
      activeStudents: 500,
      activeAdmins: 10,
      activeLoans: 42,
      overdueLoans: 5,
      totalFinesPending: 250,
      eResourcesCount: 120,
      pendingModerationCount: 3,
      storageUsageBytes: 104857600,
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: 'redis.test.sa@bookbuddy.internal' });
    await PlatformMetricSnapshot.deleteMany({ collegeId: null });
  });

  it('1. should serve cached data from Redis when key metrics:global:latest is present', async () => {
    const isRedisReady =
      redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect');
    if (isRedisReady) {
      const cachedPayload = {
        totalColleges: 15,
        activeLoans: 99,
        unpaidFinesCount: 7,
        totalUnpaidFineAmount: 350,
        userCountsByRole: { student: 800, 'college-admin': 15, 'super-admin': 1 },
        storageUsageBytes: 209715200,
        eResourcesCount: 250,
        pendingModerationCount: 1,
      };
      await redisClient.set('metrics:global:latest', JSON.stringify(cachedPayload), 'EX', 300);

      const res = await request(app)
        .get('/api/v1/dashboards/admin-portal/overview')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activeLoans).toBe(99);
      expect(res.body.data.totalColleges).toBe(15);
    }
  });

  it('2. should calculate live overview metrics when Redis cache is cleared / missing', async () => {
    const isRedisReady =
      redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect');
    if (isRedisReady) {
      await redisClient.del('metrics:global:latest');
    }

    const res = await request(app)
      .get('/api/v1/dashboards/admin-portal/overview')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activeLoans).toBe(42);
    expect(res.body.data.totalUnpaidFineAmount).toBe(250);
  });
});
