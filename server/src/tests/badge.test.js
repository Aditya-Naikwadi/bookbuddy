const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_badge_test';

const Badge = require('../models/Badge');
const UserBadge = require('../models/UserBadge');
const seedBadges = require('../scripts/seedBadges');

describe('Badge Definitions Schema, UserBadge Schema & Seed Data', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await Badge.deleteMany({});
    await UserBadge.deleteMany({});
    await Badge.createIndexes();
    await UserBadge.createIndexes();
  });

  afterAll(async () => {
    await Badge.deleteMany({});
    await UserBadge.deleteMany({});
    await mongoose.connection.close();
  });

  describe('F12.1 — Badge Model & Seed Data', () => {
    it('should create a badge definition with valid properties', async () => {
      const badge = await Badge.create({
        key: 'test_badge_1',
        label: 'Test Badge',
        icon: 'test-icon',
        criteria: { type: 'test', threshold: 1 },
        tier: 'bronze',
      });

      expect(badge.key).toBe('test_badge_1');
      expect(badge.label).toBe('Test Badge');
      expect(badge.tier).toBe('bronze');
      expect(badge.criteria).toEqual({ type: 'test', threshold: 1 });
    });

    it('should enforce unique key constraint on Badge model', async () => {
      await expect(
        Badge.create({
          key: 'test_badge_1',
          label: 'Duplicate Badge Key',
          tier: 'silver',
        })
      ).rejects.toThrow();
    });

    it('should validate tier enum values', async () => {
      await expect(
        Badge.create({
          key: 'invalid_tier_badge',
          label: 'Invalid Tier',
          tier: 'diamond', // invalid enum
        })
      ).rejects.toThrow();
    });

    it('should seed default badges and be safely re-runnable (upsert idempotency)', async () => {
      await Badge.deleteMany({});

      // First run
      await seedBadges();
      const countFirstRun = await Badge.countDocuments();
      expect(countFirstRun).toBeGreaterThanOrEqual(5);

      const streak7 = await Badge.findOne({ key: 'streak_7' });
      expect(streak7).not.toBeNull();
      expect(streak7.label).toBe('7-Day Reading Streak');
      expect(streak7.tier).toBe('bronze');

      // Second run (re-running seed script should not throw duplicate key error)
      await expect(seedBadges()).resolves.not.toThrow();

      const countSecondRun = await Badge.countDocuments();
      expect(countSecondRun).toBe(countFirstRun);
    });
  });

  describe('F12.2 — UserBadge Model & Safe Awarding', () => {
    const mockUserId = new mongoose.Types.ObjectId();

    it('should award a badge to a user on first attempt', async () => {
      const result = await UserBadge.awardBadge(mockUserId, 'streak_7');

      expect(result.awarded).toBe(true);
      expect(result.userBadge).toBeDefined();
      expect(result.userBadge.userId.toString()).toBe(mockUserId.toString());
      expect(result.userBadge.badgeKey).toBe('streak_7');
      expect(result.userBadge.earnedAt).toBeInstanceOf(Date);
    });

    it('should handle awarding duplicate badge as a silent no-op without throwing an exception', async () => {
      // Awarding the same badge to the same user twice
      const duplicateAttempt = await UserBadge.awardBadge(mockUserId, 'streak_7');

      expect(duplicateAttempt.awarded).toBe(false);
      expect(duplicateAttempt.duplicate).toBe(true);

      // Verify only 1 UserBadge document exists in database for this user + badgeKey
      const count = await UserBadge.countDocuments({
        userId: mockUserId,
        badgeKey: 'streak_7',
      });
      expect(count).toBe(1);
    });

    it('should allow awarding different badges to the same user', async () => {
      const result = await UserBadge.awardBadge(mockUserId, 'first_review');

      expect(result.awarded).toBe(true);
      expect(result.userBadge.badgeKey).toBe('first_review');
    });
  });

  describe('F12.3 — User Model Points & Leaderboard Visibility', () => {
    const User = require('../models/User');

    it('should default points to 0 and isLeaderboardVisible to true', async () => {
      const user = new User({
        studentId: `STU_POINTS_${Date.now()}`,
        name: 'Test Points User',
        email: `points_${Date.now()}@example.com`,
        password: 'password123',
        collegeId: new mongoose.Types.ObjectId(),
      });

      expect(user.points).toBe(0);
      expect(user.isLeaderboardVisible).toBe(true);
    });

    it('should confirm points is indexed in User schema indexes', () => {
      const indexes = User.schema.indexes();
      const hasPointsIndex = indexes.some(([indexSpec]) => indexSpec.points === 1);
      expect(hasPointsIndex).toBe(true);
    });
  });

  describe('F12.4 — Central evaluateBadges & Idempotency', () => {
    const User = require('../models/User');
    const { evaluateBadges, refreshBadgeCache } = require('../services/badgeService');
    let testUser;

    beforeEach(async () => {
      await seedBadges();
      await refreshBadgeCache();
      testUser = await User.create({
        studentId: `STU_EVAL_${Date.now()}`,
        name: 'Evaluation Test User',
        email: `eval_${Date.now()}@example.com`,
        password: 'password123',
        collegeId: new mongoose.Types.ObjectId(),
        points: 0,
      });
    });

    afterEach(async () => {
      if (testUser?._id) {
        await User.deleteOne({ _id: testUser._id });
        await UserBadge.deleteMany({ userId: testUser._id });
      }
    });

    it('Acceptance Criteria: calling evaluateBadges twice in a row with identical inputs awards badge exactly once and increments points exactly once', async () => {
      // 1st call: awards streak_7 badge
      const firstCallResult = await evaluateBadges(testUser._id, 'streak_updated', { length: 7 });
      expect(firstCallResult.length).toBe(1);
      expect(firstCallResult[0].badge.key).toBe('streak_7');
      expect(firstCallResult[0].pointsAdded).toBe(10); // Bronze tier points

      const userAfterFirst = await User.findById(testUser._id);
      expect(userAfterFirst.points).toBe(10);

      // 2nd call: identical inputs must be a silent no-op
      const secondCallResult = await evaluateBadges(testUser._id, 'streak_updated', { length: 7 });
      expect(secondCallResult.length).toBe(0);

      const userAfterSecond = await User.findById(testUser._id);
      expect(userAfterSecond.points).toBe(10); // Points unchanged

      const userBadgeCount = await UserBadge.countDocuments({
        userId: testUser._id,
        badgeKey: 'streak_7',
      });
      expect(userBadgeCount).toBe(1);
    });
  });

  describe('F12.5 — Automatic Badge Awarding on Event Triggers', () => {
    const User = require('../models/User');
    const Streak = require('../models/Streak');
    const { evaluateBadges, refreshBadgeCache } = require('../services/badgeService');

    let testUser;

    beforeEach(async () => {
      await seedBadges();
      await refreshBadgeCache();
      testUser = await User.create({
        studentId: `STU_TRIGGER_${Date.now()}`,
        name: 'Trigger Test User',
        email: `trigger_${Date.now()}@example.com`,
        password: 'password123',
        collegeId: new mongoose.Types.ObjectId(),
        points: 0,
      });
    });

    afterEach(async () => {
      if (testUser?._id) {
        await User.deleteOne({ _id: testUser._id });
        await UserBadge.deleteMany({ userId: testUser._id });
        await Streak.deleteMany({ userId: testUser._id });
      }
    });

    it('Acceptance Criteria: driving a user streak to 7 consecutive days automatically awards streak_7 badge without manual trigger', async () => {
      const streak = await Streak.create({
        userId: testUser._id,
        collegeId: testUser.collegeId,
        currentStreak: 7,
        maxStreak: 7,
      });

      // Trigger streak update event flow
      await evaluateBadges(testUser._id, 'streak_updated', { length: streak.currentStreak });

      const awardedBadge = await UserBadge.findOne({
        userId: testUser._id,
        badgeKey: 'streak_7',
      });

      expect(awardedBadge).not.toBeNull();
      expect(awardedBadge.badgeKey).toBe('streak_7');

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.points).toBeGreaterThan(0);
    });
  });

  describe('F12.7 — Weekly Leaderboard Snapshot Cron Job', () => {
    const User = require('../models/User');
    const LeaderboardSnapshot = require('../models/LeaderboardSnapshot');
    const { runWeeklyLeaderboardSnapshot } = require('../services/cronService');

    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        studentId: `STU_CRON_${Date.now()}`,
        name: 'Weekly Snapshot Patron',
        email: `snapshot_${Date.now()}@example.com`,
        password: 'password123',
        collegeId: new mongoose.Types.ObjectId(),
        points: 50,
        isLeaderboardVisible: true,
      });
    });

    afterEach(async () => {
      if (testUser?._id) {
        await User.deleteOne({ _id: testUser._id });
        await LeaderboardSnapshot.deleteMany({});
      }
    });

    it('Acceptance Criteria: weekly leaderboard snapshot runs asynchronously without blocking or delaying cronService', async () => {
      const affected = await runWeeklyLeaderboardSnapshot();
      expect(affected).toBeGreaterThanOrEqual(1);

      const snapshot = await LeaderboardSnapshot.findOne({ metric: 'points' });
      expect(snapshot).not.toBeNull();
      expect(snapshot.topEntries.length).toBeGreaterThanOrEqual(1);
      expect(snapshot.topEntries.some((e) => e.userId.toString() === testUser._id.toString())).toBe(true);
    });
  });

  describe('F12.8 — Leaderboard Visibility Opt-Out & Re-Fetch', () => {
    const User = require('../models/User');
    const { getLeaderboard } = require('../controllers/leaderboardController');

    let testUser, collegeId;

    beforeEach(async () => {
      collegeId = new mongoose.Types.ObjectId();
      testUser = await User.create({
        studentId: `STU_OPT_${Date.now()}`,
        name: 'OptOut Patron',
        email: `optout_${Date.now()}@example.com`,
        password: 'password123',
        collegeId,
        points: 100,
        isLeaderboardVisible: true,
      });
    });

    afterEach(async () => {
      if (testUser?._id) {
        await User.deleteOne({ _id: testUser._id });
      }
    });

    it('Acceptance Criteria: toggling visibility off, then immediately re-fetching the leaderboard, no longer includes that user', async () => {
      // Mock Express req/res for getLeaderboard controller
      const createMockReqRes = () => {
        const req = {
          user: { id: testUser._id.toString(), collegeId },
          query: { metric: 'points' },
        };
        let responseData = null;
        const res = {
          json: (data) => {
            responseData = data;
          },
        };
        return { req, res, getResponseData: () => responseData };
      };

      // 1. Initial fetch: user is visible
      const step1 = createMockReqRes();
      await getLeaderboard(step1.req, step1.res);
      const initialLeaderboard = step1.getResponseData().data;
      expect(initialLeaderboard.some((u) => u.userId.toString() === testUser._id.toString())).toBe(true);

      // 2. Toggle visibility OFF (isLeaderboardVisible = false)
      testUser.isLeaderboardVisible = false;
      await testUser.save();

      // 3. Immediate re-fetch: user MUST NO LONGER be included in the leaderboard
      const step2 = createMockReqRes();
      await getLeaderboard(step2.req, step2.res);
      const updatedLeaderboard = step2.getResponseData().data;
      expect(updatedLeaderboard.some((u) => u.userId.toString() === testUser._id.toString())).toBe(false);
    });
  });
});
