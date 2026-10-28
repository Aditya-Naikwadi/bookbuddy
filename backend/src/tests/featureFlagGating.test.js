process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const CollegeFeatureConfig = require('../models/CollegeFeatureConfig');
const { generateTokenPair } = require('../utils/token');
const { deleteCache } = require('../utils/redisCache');
const { FEATURE_FLAGS, PHASED_FEATURE_KEYS } = require('@bookbuddy/shared');

describe('Phased Feature Flags Gateway & Multi-Tenant Enforcement', () => {
  let college;
  let studentUser;
  let studentToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    // 1. Create a tenant college
    college = await College.create({
      name: 'Flag Test College',
      code: `FLG_${Date.now()}`,
      slug: `flg-${Date.now()}`,
      status: 'active',
      isActive: true,
      enabledFeatures: ['catalog', 'loans', 'patron-card'],
    });

    // 2. Explicitly ensure CollegeFeatureConfig does NOT have phased features enabled
    await CollegeFeatureConfig.findOneAndUpdate(
      { collegeId: college._id },
      {
        collegeId: college._id,
        enabledFeatures: ['catalog', 'loans', 'patron-card'],
      },
      { upsert: true, new: true }
    );

    // 3. Create student affiliated with this college
    studentUser = await User.create({
      collegeId: college._id,
      studentId: `STU_${Date.now()}`,
      name: 'Flag Tester',
      email: `flagtester_${Date.now()}@testcollege.edu`,
      role: 'student',
      status: 'active',
      isActive: true,
      password: 'HashedPassword123!',
    });

    studentToken = generateTokenPair(studentUser).accessToken;
  });

  afterAll(async () => {
    await CollegeFeatureConfig.deleteMany({ collegeId: college._id });
    await User.deleteMany({ _id: studentUser._id });
    await College.deleteMany({ _id: college._id });
  });

  it('blocks access (HTTP 403) to all 10 phased feature endpoints by default', async () => {
    for (const flagKey of PHASED_FEATURE_KEYS) {
      const res = await request(app)
        .get(`/api/v1/features/phased/${flagKey}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Feature is not licensed or enabled for institution/i);
    }
  });

  it('permits access (HTTP 200) once a feature flag is explicitly enabled for the tenant', async () => {
    // Enable offline-sync and predictive-alerts for this tenant
    await CollegeFeatureConfig.findOneAndUpdate(
      { collegeId: college._id },
      {
        enabledFeatures: [
          'catalog',
          'loans',
          'patron-card',
          FEATURE_FLAGS.OFFLINE_SYNC,
          FEATURE_FLAGS.PREDICTIVE_ALERTS,
        ],
      }
    );
    await deleteCache(`college:features:${college._id}`);

    // Test offline-sync: Should now succeed
    const resOffline = await request(app)
      .get(`/api/v1/features/phased/${FEATURE_FLAGS.OFFLINE_SYNC}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(resOffline.status).toBe(200);
    expect(resOffline.body.success).toBe(true);
    expect(resOffline.body.feature).toBe(FEATURE_FLAGS.OFFLINE_SYNC);

    // Test predictive-alerts: Should now succeed
    const resPredictive = await request(app)
      .get(`/api/v1/features/phased/${FEATURE_FLAGS.PREDICTIVE_ALERTS}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(resPredictive.status).toBe(200);
    expect(resPredictive.body.success).toBe(true);
    expect(resPredictive.body.feature).toBe(FEATURE_FLAGS.PREDICTIVE_ALERTS);

    // Test a remaining unenabled feature (anomaly-detection): Still 403
    const resAnomaly = await request(app)
      .get(`/api/v1/features/phased/${FEATURE_FLAGS.ANOMALY_DETECTION}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(resAnomaly.status).toBe(403);
  });
});
