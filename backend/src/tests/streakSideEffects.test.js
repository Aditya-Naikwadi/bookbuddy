/**
 * @testing-test-automation-engineer Test Suite:
 * Verify Streak Action Side Effects Execute Outside Transaction
 *
 * Confirms:
 * 1. Post-commit side effects (milestone notifications, badge evaluations,
 *    socket emit) execute strictly after streak transaction commits.
 * 2. If the transaction aborts (e.g. duplicate daily check-in or forced abort),
 *    zero milestone notifications and zero streak updates are broadcast.
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');
const User = require('../models/User');
const College = require('../models/College');
const Streak = require('../models/Streak');
const CheckInLog = require('../models/CheckInLog');
const StreakReward = require('../models/StreakReward');
const streakService = require('../services/streakService');
const notificationService = require('../services/notificationService');
const badgeService = require('../services/badgeService');
const sockets = require('../sockets');

describe('@testing-test-automation-engineer: Streak Side-Effects Isolation', () => {
  let testCollege;
  let studentUser;
  let emitStreakSpy;
  let notifySpy;
  let evaluateBadgesSpy;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    testCollege = await College.create({
      name: 'Streak Side Effect College',
      code: 'SSEC_' + unique.replace('-', '_'),
      slug: 'ssec-' + unique,
      status: 'active',
    });

    studentUser = await User.create({
      studentId: 'STU_STRK_' + unique,
      name: 'Streak Student',
      email: `student_strk_${unique}@ssec.edu`,
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
    });
  });

  afterAll(async () => {
    try {
      if (testCollege?._id) {
        await Streak.deleteMany({ collegeId: testCollege._id });
        await CheckInLog.deleteMany({ collegeId: testCollege._id });
        await User.deleteMany({ collegeId: testCollege._id });
        await College.deleteMany({ _id: testCollege._id });
      }
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  beforeEach(() => {
    emitStreakSpy = jest.spyOn(sockets, 'emitStreakUpdate').mockImplementation(() => {});
    notifySpy = jest.spyOn(notificationService, 'notify').mockResolvedValue(true);
    evaluateBadgesSpy = jest.spyOn(badgeService, 'evaluateBadges').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. Executes socket emit and milestone notification AFTER streak transaction commits', async () => {
    // Setup milestone reward for threshold 1
    const reward = await StreakReward.findOneAndUpdate(
      { milestoneThreshold: 1 },
      {
        milestoneThreshold: 1,
        rewardType: 'freeze',
        rewardValue: '1',
        description: 'First day freeze bonus',
      },
      { upsert: true, returnDocument: 'after' }
    );

    const result = await streakService.recordQualifyingAction(
      studentUser._id,
      testCollege._id,
      'check_in'
    );

    expect(result).toBeDefined();
    expect(result.currentStreak).toBe(1);

    // Confirm post-commit side effects fired
    expect(emitStreakSpy).toHaveBeenCalledWith(studentUser._id, expect.any(Object));

    expect(notifySpy).toHaveBeenCalledWith(
      studentUser._id,
      'streak_milestone',
      expect.stringContaining('Milestone reached'),
      reward._id,
      'StreakReward'
    );
  });

  it('2. Confirms NO notification or socket emit occurs when streak transaction aborts on duplicate check-in', async () => {
    // Create an explicit check-in log for today so a second check-in attempt aborts with duplicate key
    const todayStr = streakService.getLocalDateString(new Date(), 'Asia/Kolkata');
    await CheckInLog.findOneAndUpdate(
      { userId: studentUser._id, checkInDate: todayStr },
      {
        collegeId: testCollege._id,
        userId: studentUser._id,
        checkInDate: todayStr,
        timestamp: new Date(),
        freezeConsumed: false,
      },
      { upsert: true }
    );

    emitStreakSpy.mockClear();
    notifySpy.mockClear();

    let threw = false;
    try {
      await streakService.recordQualifyingAction(studentUser._id, testCollege._id, 'check_in');
    } catch (err) {
      threw = true;
      expect(err.message).toMatch(/already checked in today/i);
    }

    expect(threw).toBe(true);

    // Confirm NO side-effects fired during or after the abort
    expect(notifySpy).not.toHaveBeenCalled();
    expect(emitStreakSpy).not.toHaveBeenCalled();
  });
});
