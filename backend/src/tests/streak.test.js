const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_streak_test';
process.env.JWT_SECRET = 'testjwtsecretstreakkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretstreakkey999';
process.env.JWT_ACCESS_EXPIRY = '10m';
process.env.JWT_REFRESH_EXPIRY = '7d';
jest.setTimeout(30000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Streak = require('../models/Streak');
const CheckInLog = require('../models/CheckInLog');
const Sticker = require('../models/Sticker');
const UserSticker = require('../models/UserSticker');
const StreakReward = require('../models/StreakReward');
const { generateTokenPair } = require('../utils/token');
const { runStreakExpirySweep } = require('../services/cronService');

describe('Feature 5: Gamification & Engagement Integration Tests', () => {
  let collegeA;
  let studentA;
  let adminA;
  let tokenStudentA;
  let tokenAdminA;
  let stickerA;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await College.deleteMany({});
    await User.deleteMany({});
    await Streak.deleteMany({});
    await CheckInLog.deleteMany({});
    await Sticker.deleteMany({});
    await UserSticker.deleteMany({});
    await StreakReward.deleteMany({});

    // 1. Create College
    collegeA = await College.create({
      name: 'Gamification University',
      code: 'GU',
      domain: 'gu.edu',
      status: 'active',
      subscriptionTier: 'premium',
    });

    // 2. Create Student
    studentA = await User.create({
      studentId: 'STU_STREAK_001',
      collegeId: collegeA._id,
      name: 'Gamer Student',
      email: 'gamer@gu.edu',
      password: 'password123',
      role: 'student',
      status: 'active',
    });
    tokenStudentA = generateTokenPair(studentA).accessToken;

    // 3. Create Admin
    adminA = await User.create({
      studentId: 'ADM_STREAK_001',
      collegeId: collegeA._id,
      name: 'System Admin',
      email: 'admin@gu.edu',
      password: 'password123',
      role: 'college-admin',
      status: 'active',
    });
    tokenAdminA = generateTokenPair(adminA).accessToken;

    // 4. Create Badge definitions
    stickerA = await Sticker.create({
      name: 'First Check-in Badge',
      rarity: 'common',
      criteria: 'Check in for the first time',
      iconUrl: 'http://test.com/badge1.png',
    });
    expect(stickerA.name).toBe('First Check-in Badge');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/checkin (Daily Check-in Idempotency)', () => {
    it('should successfully check in for the first time today', async () => {
      const res = await request(app)
        .post('/api/v1/checkin')
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentStreak).toBe(1);
      expect(res.body.data.todayComplete).toBe(true);
    });

    it('should handle duplicate concurrent check-ins gracefully (fail-safe 200 OK)', async () => {
      const res = await request(app)
        .post('/api/v1/checkin')
        .set('Authorization', `Bearer ${tokenStudentA}`);

      // Graceful duplicate check-in handling: must return 200 and not error
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentStreak).toBe(1);
    });
  });

  describe('GET /api/streak and GET /api/streak/history', () => {
    it('should return current streak counts and check-in status', async () => {
      const res = await request(app)
        .get('/api/v1/streak')
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.currentStreak).toBe(1);
      expect(res.body.data.todayComplete).toBe(true);
    });

    it('should return recent check-in logs for calendar view', async () => {
      const res = await request(app)
        .get('/api/v1/streak/history')
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].freezeConsumed).toBe(false);
    });
  });

  describe('Badges GET / POST /api/badges', () => {
    it('should return the full badge list with unlocked statuses', async () => {
      const res = await request(app)
        .get('/api/v1/badges')
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].name).toBe('First Check-in Badge');
      expect(res.body.data[0].unlocked).toBe(false);
    });

    it('should prevent non-admin/staff students from creating badges', async () => {
      const res = await request(app)
        .post('/api/v1/badges')
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .send({
          name: 'Hacker Sticker',
          rarity: 'rare',
          criteria: 'Attempt XSS',
        });

      expect(res.status).toBe(403);
    });

    it('should allow admin users to define new badges', async () => {
      const res = await request(app)
        .post('/api/v1/badges')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          name: 'Milestone 7 Sticker',
          rarity: 'epic',
          criteria: 'Reach a 7-day check-in streak',
          iconUrl: 'http://test.com/badge7.png',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Milestone 7 Sticker');
    });
  });

  describe('Streak Recalculation Audit Tool', () => {
    it('should replay check-in logs to rebuild streak metrics and correct drifts', async () => {
      // 1. Manually simulate drift in the DB
      await Streak.findOneAndUpdate({ userId: studentA._id }, { currentStreak: 99 });

      // 2. Trigger recalculate
      const res = await request(app)
        .post('/api/v1/streak/recalculate')
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(res.status).toBe(200);
      // Replaying logs should restore the correct value (which is 1 check-in)
      expect(res.body.data.currentStreak).toBe(1);

      // Verify DB matches corrected state
      const updated = await Streak.findOne({ userId: studentA._id });
      expect(updated.currentStreak).toBe(1);
    });
  });

  describe('Idempotent Scheduled Expiry Sweep', () => {
    it('should preserve streak using a freeze coupon when daily check-in is missed', async () => {
      const trStreak = await Streak.findOne({ userId: studentA._id });
      // Reset lastQualifyingAction to 2 days ago
      trStreak.lastQualifyingActionAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
      trStreak.freezesAvailable = 2;
      trStreak.currentStreak = 5;
      await trStreak.save();

      // Trigger daily midnight expiry sweep simulating midnight timezone trigger
      const mockNow = new Date();
      // Mock isMidnight to always return true to run the sweep in test env
      const timezoneHelper = require('../utils/timezoneHelper');
      jest.spyOn(timezoneHelper, 'isMidnight').mockReturnValue(true);

      const affected = await runStreakExpirySweep(mockNow);
      expect(affected).toBe(1);

      const updated = await Streak.findOne({ userId: studentA._id });
      expect(updated.freezesAvailable).toBe(1);
      expect(updated.currentStreak).toBe(5); // Saved by freeze!

      // Rerunning the sweep should be a safe, idempotent no-op (freeze not consumed twice)
      const affectedSecond = await runStreakExpirySweep(mockNow);
      expect(affectedSecond).toBe(0);

      const updatedSecond = await Streak.findOne({ userId: studentA._id });
      expect(updatedSecond.freezesAvailable).toBe(1); // Still 1! Idempotency verified!

      timezoneHelper.isMidnight.mockRestore();
    });
  });
});
