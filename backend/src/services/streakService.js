const mongoose = require('mongoose');
const Streak = require('../models/Streak');
const StreakReward = require('../models/StreakReward');
const Sticker = require('../models/Sticker');
const UserSticker = require('../models/UserSticker');
const notificationService = require('./notificationService');
const badgeService = require('./badgeService');
const sockets = require('../sockets');
const emitStreakUpdate = (userId, streak) => sockets.emitStreakUpdate(userId, streak);
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

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
const { atomicConditionalUpdate } = require('../utils/atomicUpdateHelper');
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

  return await runInTransaction(
    async (session) => {
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
        const existingTodayLog = await CheckInLog.findOne({
          userId,
          checkInDate: todayStr,
        }).session(session);
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

      const notificationsToDispatch = [];

      if (lastActionDateStr === todayStr) {
        // Already checked in today
        streak.lastQualifyingActionAt = now;
        await streak.save({ session });
        return { streak, newlyUnlocked: [], notificationsToDispatch, isSameDay: true };
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

      // Process milestones/rewards
      const newlyUnlocked = [];
      const rewards = await StreakReward.find({ milestoneThreshold: streak.currentStreak }).session(
        session
      );
      for (const reward of rewards) {
        if (reward.rewardType === 'freeze') {
          const addedFreezes = parseInt(reward.rewardValue, 10) || 0;
          streak.freezesAvailable += addedFreezes;
          await streak.save({ session });

          notificationsToDispatch.push({
            userId,
            type: 'streak_milestone',
            message: `Milestone reached! You earned ${addedFreezes} extra streak freezes.`,
            targetId: reward._id,
            targetType: 'StreakReward',
          });
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
              notificationsToDispatch.push({
                userId,
                type: 'streak_milestone',
                message: `Congratulations! You unlocked the "${sticker.name}" sticker for reaching your ${streak.currentStreak}-day streak milestone!`,
                targetId: sticker._id,
                targetType: 'Sticker',
              });
            }
          }
        } else if (reward.rewardType === 'theme') {
          notificationsToDispatch.push({
            userId,
            type: 'streak_milestone',
            message: `Milestone reached! You unlocked the visual theme: ${reward.rewardValue}.`,
            targetId: reward._id,
            targetType: 'StreakReward',
          });
        }
      }

      return { streak, newlyUnlocked, notificationsToDispatch, isSameDay: false };
    },
    async (result) => {
      if (!result || !result.streak) return;
      const { streak, notificationsToDispatch, isSameDay } = result;

      // 1. Real-time socket broadcast post-commit
      sockets.emitStreakUpdate(userId, streak);

      // 2. Badge evaluation post-commit
      if (!isSameDay) {
        badgeService
          .evaluateBadges(userId, 'streak_updated', { length: streak.currentStreak })
          .catch((err) => logger.error(`Error evaluating badges on streak update: ${err.message}`));
      }

      // 3. Milestone notifications post-commit
      for (const notif of notificationsToDispatch) {
        try {
          await notificationService.notify(
            notif.userId,
            notif.type,
            notif.message,
            notif.targetId,
            notif.targetType
          );
        } catch (notifErr) {
          logger.error(`Error sending streak milestone notification: ${notifErr.message}`);
        }
      }
    }
  ).then((res) => {
    if (!res || !res.streak) return res;
    const resultObj = res.streak.toObject ? res.streak.toObject() : { ...res.streak };
    resultObj.newlyUnlocked = res.newlyUnlocked || [];
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
  // Atomic check-and-decrement freeze
  const { matched, doc: streak } = await atomicConditionalUpdate(
    Streak,
    { userId, freezesAvailable: { $gt: 0 } },
    null,
    {
      $inc: { freezesAvailable: -1 },
      $set: { lastQualifyingActionAt: new Date() },
    }
  );

  if (!matched || !streak) {
    const existing = await Streak.findOne({ userId });
    if (!existing) {
      throw new AppError('No streak record found to repair.', 404);
    }
    throw new AppError('No freezes available.', 400);
  }

  // If their streak reset to 0 or 1, restore to maxStreak
  if (streak.currentStreak <= 1) {
    streak.currentStreak = Math.max(1, streak.maxStreak);
  } else {
    streak.currentStreak += 1;
  }

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
