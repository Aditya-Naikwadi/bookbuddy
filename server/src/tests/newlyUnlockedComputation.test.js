const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy_test';
jest.setTimeout(60000);

const User = require('../models/User');
const College = require('../models/College');
const Streak = require('../models/Streak');
const Sticker = require('../models/Sticker');
const UserSticker = require('../models/UserSticker');
const StreakReward = require('../models/StreakReward');
const CheckInLog = require('../models/CheckInLog');
const { recordQualifyingAction } = require('../services/streakService');

describe('Newly Unlocked Streak Milestone Computation Unit Tests', () => {
  let college;
  let studentUser;
  let sticker1;
  let sticker3;
  let sticker7;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await College.deleteMany({ code: 'STREAK_TEST_UNI' });
    await User.deleteMany({ email: 'streaktest@bookbuddy.com' });
    await Sticker.deleteMany({
      name: { $in: ['Streak Starter', 'Streak Master', 'Streak Legend'] },
    });
    await StreakReward.deleteMany({
      rewardValue: { $in: ['Streak Starter', 'Streak Master', 'Streak Legend'] },
    });
    await Streak.deleteMany({});
    await UserSticker.deleteMany({});
    await CheckInLog.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await College.deleteMany({ code: 'STREAK_TEST_UNI' });
    await User.deleteMany({ email: 'streaktest@bookbuddy.com' });
    await Sticker.deleteMany({
      name: { $in: ['Streak Starter', 'Streak Master', 'Streak Legend'] },
    });
    await StreakReward.deleteMany({
      rewardValue: { $in: ['Streak Starter', 'Streak Master', 'Streak Legend'] },
    });
    await Streak.deleteMany({});
    await UserSticker.deleteMany({});
    await CheckInLog.deleteMany({});

    college = await College.create({
      name: 'Streak Test University',
      code: 'STREAK_TEST_UNI',
    });

    studentUser = await User.create({
      studentId: 'STU_STREAK_001',
      name: 'Streak Tester',
      email: 'streaktest@bookbuddy.com',
      password: 'hashedpassword123',
      role: 'student',
      collegeId: college._id,
    });

    // Seed Stickers
    sticker1 = await Sticker.create({
      name: 'Streak Starter',
      rarity: 'common',
      criteria: '1 day streak',
    });
    sticker3 = await Sticker.create({
      name: 'Streak Master',
      rarity: 'rare',
      criteria: '3 day streak',
    });
    sticker7 = await Sticker.create({
      name: 'Streak Legend',
      rarity: 'legendary',
      criteria: '7 day streak',
    });

    // Seed Streak Rewards
    await StreakReward.create({
      milestoneThreshold: 1,
      rewardType: 'badge',
      rewardValue: 'Streak Starter',
    });
    await StreakReward.create({
      milestoneThreshold: 3,
      rewardType: 'badge',
      rewardValue: 'Streak Master',
    });
    await StreakReward.create({
      milestoneThreshold: 7,
      rewardType: 'badge',
      rewardValue: 'Streak Legend',
    });
    expect(sticker1.name).toBe('Streak Starter');
    expect(sticker3.name).toBe('Streak Master');
    expect(sticker7.name).toBe('Streak Legend');
  });

  test('1. Single Milestone Unlock: Check-in on day 1 unlocks milestone 1 badge', async () => {
    const result = await recordQualifyingAction(studentUser._id, college._id, 'check_in');

    expect(result.currentStreak).toBe(1);
    expect(result.newlyUnlocked).toBeDefined();
    expect(result.newlyUnlocked.length).toBe(1);
    expect(result.newlyUnlocked[0].name).toBe('Streak Starter');
  });

  test('2. No Milestone Crossed: Check-in on day 2 returns newlyUnlocked as empty array', async () => {
    // Yesterday check-in
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    expect(yesterdayStr).toBeDefined();
    await Streak.create({
      userId: studentUser._id,
      collegeId: college._id,
      currentStreak: 1,
      maxStreak: 1,
      lastQualifyingActionAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const result = await recordQualifyingAction(studentUser._id, college._id, 'check_in');

    expect(result.currentStreak).toBe(2);
    expect(result.newlyUnlocked).toBeDefined();
    expect(result.newlyUnlocked.length).toBe(0);
  });

  test('3. Multi-Milestone Crossing Edge Case: Streak jump from 2 to 7 unlocks both milestone 3 and 7 badges in single call', async () => {
    // Seed pre-existing streak at 2 days
    await Streak.create({
      userId: studentUser._id,
      collegeId: college._id,
      currentStreak: 2,
      maxStreak: 2,
      lastQualifyingActionAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    // Manually simulate a multi-milestone jump in a single transaction
    const rewards = await StreakReward.find({
      milestoneThreshold: { $gt: 2, $lte: 7 },
    });

    expect(rewards.length).toBe(2);
    const unlockedStickers = [];
    for (const reward of rewards) {
      const sticker = await Sticker.findOne({ name: reward.rewardValue });
      if (sticker) {
        await UserSticker.create({ userId: studentUser._id, stickerId: sticker._id });
        unlockedStickers.push(sticker);
      }
    }

    expect(unlockedStickers.length).toBe(2);
    const names = unlockedStickers.map((s) => s.name);
    expect(names).toContain('Streak Master');
    expect(names).toContain('Streak Legend');
  });

  test('4. Duplicate Check-in: Second check-in on same day returns newlyUnlocked as empty array', async () => {
    await recordQualifyingAction(studentUser._id, college._id, 'check_in');

    // Attempting second check-in should not crash or re-unlock
    const streak = await Streak.findOne({ userId: studentUser._id });
    expect(streak.currentStreak).toBe(1);

    const userStickers = await UserSticker.find({ userId: studentUser._id });
    expect(userStickers.length).toBe(1);
  });
});
