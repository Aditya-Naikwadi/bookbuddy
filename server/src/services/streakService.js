const mongoose = require('mongoose');
const Streak = require('../models/Streak');
const StreakReward = require('../models/StreakReward');
const Sticker = require('../models/Sticker');
const UserSticker = require('../models/UserSticker');
const notificationService = require('./notificationService');
const { emitStreakUpdate } = require('../sockets');
const AppError = require('../utils/AppError');

// Config-driven list of qualifying action types
const QUALIFYING_ACTIONS = [
  'checkout',
  'return',
  'on_time_renewal',
  'lab_booking',
  'eresource',
  'eresource_read',
  'check_in',
];

const { runInTransaction } = require('../utils/transactionHelper');
const CheckInLog = require('../models/CheckInLog');
const { DateTime } = require('luxon');

/**
 * Helper to get the local YYYY-MM-DD string for a user's timezone.
 */
const getLocalDateString = (dateObj, timezone) => {
  try {
    return DateTime.fromJSDate(dateObj).setZone(timezone).toFormat('yyyy-MM-dd');
  } catch {
    return DateTime.fromJSDate(dateObj).setZone('Asia/Kolkata').toFormat('yyyy-MM-dd');
  }
};

/**
 * Records a qualifying user action and updates their daily streak.
 *
 * CRITICAL: This is the ONLY function permitted to write to the Streak collection.
 */
const recordQualifyingAction = async (userId, collegeId, actionType) => {
  if (!QUALIFYING_ACTIONS.includes(actionType)) {
    return null;
  }

  return await runInTransaction(async (session) => {
    const now = new Date();
    let streak = await Streak.findOne({ userId }).session(session);

    if (!streak) {
      streak = new Streak({
        userId,
        collegeId,
        currentStreak: 0,
        maxStreak: 0,
        freezesAvailable: 2,
        timezone: 'Asia/Kolkata',
      });
    }

    const timezone = streak.timezone || 'Asia/Kolkata';
    const todayStr = getLocalDateString(now, timezone);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getLocalDateString(yesterday, timezone);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const twoDaysAgoStr = getLocalDateString(twoDaysAgo, timezone);

    // 1. Double check-in check at CheckInLog level
    if (actionType === 'check_in') {
      try {
        await CheckInLog.create(
          [{ collegeId, userId, checkInDate: todayStr, timestamp: now, freezeConsumed: false }],
          { session }
        );
      } catch (err) {
        if (err.code === 11000) {
          const dupErr = new AppError('Already checked in today.', 400);
          dupErr.code = 'ALREADY_CHECKED_IN';
          throw dupErr;
        }
        throw err;
      }
    } else {
      // For other actions, we also log a check-in automatically to track it in history if they haven't checked in yet!
      const existingTodayLog = await CheckInLog.findOne({ userId, checkInDate: todayStr }).session(
        session
      );
      if (!existingTodayLog) {
        await CheckInLog.create(
          [{ collegeId, userId, checkInDate: todayStr, timestamp: now, freezeConsumed: false }],
          { session }
        );
      }
    }

    const lastActionDateStr = streak.lastQualifyingActionAt
      ? getLocalDateString(streak.lastQualifyingActionAt, timezone)
      : null;

    if (lastActionDateStr === todayStr) {
      // Already checked in today
      streak.lastQualifyingActionAt = now;
      await streak.save({ session });
      emitStreakUpdate(userId, streak);
      return streak;
    }

    if (lastActionDateStr === yesterdayStr) {
      // Continuous daily progress
      streak.currentStreak += 1;
    } else if (lastActionDateStr === twoDaysAgoStr && streak.freezesAvailable > 0) {
      // Missed yesterday: consume freeze, log freeze consumed, treat as continuous
      streak.freezesAvailable -= 1;
      await CheckInLog.create(
        [{ collegeId, userId, checkInDate: yesterdayStr, timestamp: now, freezeConsumed: true }],
        { session }
      );
      streak.currentStreak += 1;
    } else {
      // Reset streak to 1
      streak.currentStreak = 1;
    }

    if (streak.currentStreak > streak.maxStreak) {
      streak.maxStreak = streak.currentStreak;
    }

    streak.lastQualifyingActionAt = now;
    await streak.save({ session });

    // 2. Process milestones/rewards
    const newlyUnlocked = [];
    const rewards = await StreakReward.find({ milestoneThreshold: streak.currentStreak }).session(
      session
    );
    for (const reward of rewards) {
      if (reward.rewardType === 'freeze') {
        const addedFreezes = parseInt(reward.rewardValue, 10) || 0;
        streak.freezesAvailable += addedFreezes;
        await streak.save({ session });

        await notificationService.notify(
          userId,
          'streak_milestone',
          `Milestone reached! You earned ${addedFreezes} extra streak freezes.`,
          reward._id,
          'StreakReward'
        );
      } else if (reward.rewardType === 'badge') {
        let sticker = await Sticker.findOne({ name: reward.rewardValue }).session(session);
        if (!sticker && mongoose.isValidObjectId(reward.rewardValue)) {
          sticker = await Sticker.findById(reward.rewardValue).session(session);
        }

        if (sticker) {
          const userStickerExists = await UserSticker.findOne({
            userId,
            stickerId: sticker._id,
          }).session(session);
          if (!userStickerExists) {
            await UserSticker.create([{ userId, stickerId: sticker._id }], { session });
            newlyUnlocked.push(sticker);
            await notificationService.notify(
              userId,
              'streak_milestone',
              `Congratulations! You unlocked the "${sticker.name}" sticker for reaching your ${streak.currentStreak}-day streak milestone!`,
              sticker._id,
              'Sticker'
            );
          }
        }
      } else if (reward.rewardType === 'theme') {
        await notificationService.notify(
          userId,
          'streak_milestone',
          `Milestone reached! You unlocked the visual theme: ${reward.rewardValue}.`,
          reward._id,
          'StreakReward'
        );
      }
    }

    emitStreakUpdate(userId, streak);
    const resultObj = streak.toObject ? streak.toObject() : { ...streak };
    resultObj.newlyUnlocked = newlyUnlocked;
    return resultObj;
  });
};

const getOrCreateStreak = async (userId, collegeId) => {
  let streak = await Streak.findOne({ userId });
  if (!streak) {
    streak = await Streak.create({
      userId,
      collegeId,
      currentStreak: 0,
      maxStreak: 0,
      freezesAvailable: 2,
      timezone: 'Asia/Kolkata',
    });
  }
  return streak;
};

const useStreakRepair = async (userId) => {
  let streak = await Streak.findOne({ userId });
  if (!streak) {
    throw new AppError('No streak record found to repair.', 404);
  }
  if (streak.freezesAvailable <= 0) {
    throw new AppError('No freezes available.', 400);
  }

  // Repair streak: deduct freeze, increment streak, and set action timestamp
  streak.freezesAvailable -= 1;

  // If their streak reset to 0 or 1, restore to maxStreak
  if (streak.currentStreak <= 1) {
    streak.currentStreak = Math.max(1, streak.maxStreak);
  } else {
    streak.currentStreak += 1;
  }

  streak.lastQualifyingActionAt = new Date();
  await streak.save();

  emitStreakUpdate(userId, streak);
  return streak;
};

const recalculateStreakFromLog = async (userId) => {
  const logs = await CheckInLog.find({ userId }).sort({ checkInDate: 1 });
  let currentStreak = 0;
  let maxStreak = 0;

  if (logs.length === 0) {
    const streak = await Streak.findOneAndUpdate(
      { userId },
      { currentStreak: 0, maxStreak: 0 },
      { returnDocument: 'after' }
    );
    if (streak) emitStreakUpdate(userId, streak);
    return { currentStreak: 0, maxStreak: 0 };
  }

  let lastDate = null;
  for (const log of logs) {
    const curDate = DateTime.fromISO(log.checkInDate);
    if (!lastDate) {
      currentStreak = 1;
    } else {
      const diff = curDate.diff(lastDate, 'days').days;
      if (diff === 1) {
        currentStreak += 1;
      } else if (diff > 1) {
        currentStreak = 1;
      }
    }
    if (currentStreak > maxStreak) {
      maxStreak = currentStreak;
    }
    lastDate = curDate;
  }

  const streak = await Streak.findOneAndUpdate(
    { userId },
    { currentStreak, maxStreak },
    { returnDocument: 'after' }
  );
  if (streak) emitStreakUpdate(userId, streak);

  return { currentStreak, maxStreak };
};

module.exports = {
  recordQualifyingAction,
  getLocalDateString,
  getOrCreateStreak,
  useStreakRepair,
  recalculateStreakFromLog,
};
