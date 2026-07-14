const mongoose = require('mongoose');
const Streak = require('../models/Streak');
const StreakReward = require('../models/StreakReward');
const Sticker = require('../models/Sticker');
const UserSticker = require('../models/UserSticker');
const notificationService = require('./notificationService');
const { emitStreakUpdate } = require('../sockets');
const AppError = require('../utils/AppError');

// Config-driven list of qualifying action types
const QUALIFYING_ACTIONS = ['checkout', 'return', 'on_time_renewal', 'lab_booking'];

/**
 * Helper to get the local YYYY-MM-DD string for a user's timezone.
 */
const getLocalDateString = (dateObj, timezone) => {
  try {
    return new Date(dateObj).toLocaleDateString('en-CA', { timeZone: timezone });
  } catch (err) {
    // Fallback if timezone is invalid
    return new Date(dateObj).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }
};

/**
 * Records a qualifying user action and updates their daily streak.
 * 
 * CRITICAL: This is the ONLY function permitted to write to the Streak collection.
 */
const recordQualifyingAction = async (userId, collegeId, actionType) => {
  // 1. Verify if the action type is qualifying
  if (!QUALIFYING_ACTIONS.includes(actionType)) {
    // If not qualifying, do nothing
    return null;
  }

  const now = new Date();
  let streak = await Streak.findOne({ userId });

  if (!streak) {
    // First time ever creating a streak for this user
    streak = await Streak.create({
      userId,
      collegeId,
      currentStreak: 1,
      maxStreak: 1,
      freezesAvailable: 2,
      lastQualifyingActionAt: now,
      timezone: 'Asia/Kolkata', // default
    });
  } else {
    const timezone = streak.timezone || 'Asia/Kolkata';
    const todayStr = getLocalDateString(now, timezone);

    // Compute dates for yesterday and two days ago in local user timezone
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getLocalDateString(yesterday, timezone);

    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const twoDaysAgoStr = getLocalDateString(twoDaysAgo, timezone);

    const lastActionDateStr = getLocalDateString(streak.lastQualifyingActionAt, timezone);

    if (lastActionDateStr === todayStr) {
      // Already performed a qualifying action today: no-op for streak count
      streak.lastQualifyingActionAt = now;
      await streak.save();
      emitStreakUpdate(userId, streak);
      return streak;
    }

    if (lastActionDateStr === yesterdayStr) {
      // Continuous streak increment
      streak.currentStreak += 1;
    } else if (lastActionDateStr === twoDaysAgoStr && streak.freezesAvailable > 0) {
      // Missed yesterday but has a freeze: consume freeze and treat as continuous
      streak.freezesAvailable -= 1;
      streak.currentStreak += 1;
    } else {
      // Gap is wider: reset streak to 1
      streak.currentStreak = 1;
    }

    if (streak.currentStreak > streak.maxStreak) {
      streak.maxStreak = streak.currentStreak;
    }

    streak.lastQualifyingActionAt = now;
    await streak.save();
  }

  // 2. Check and process StreakReward milestones crossed by the new currentStreak
  const rewards = await StreakReward.find({ milestoneThreshold: streak.currentStreak });
  for (const reward of rewards) {
    if (reward.rewardType === 'freeze') {
      const addedFreezes = parseInt(reward.rewardValue, 10) || 0;
      streak.freezesAvailable += addedFreezes;
      await streak.save();

      await notificationService.notify(
        userId,
        'streak_milestone',
        `Milestone reached! You earned ${addedFreezes} extra streak freezes.`,
        reward._id,
        'StreakReward'
      );
    } else if (reward.rewardType === 'badge') {
      // Try to find a sticker with name or ID matching the badge value
      let sticker = await Sticker.findOne({ name: reward.rewardValue });
      if (!sticker && mongoose.isValidObjectId(reward.rewardValue)) {
        sticker = await Sticker.findById(reward.rewardValue);
      }

      if (sticker) {
        // Unlock UserSticker if not already earned
        const userStickerExists = await UserSticker.findOne({ userId, stickerId: sticker._id });
        if (!userStickerExists) {
          await UserSticker.create({ userId, stickerId: sticker._id });
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

  // 3. Emit updated streak live via socket
  emitStreakUpdate(userId, streak);

  return streak;
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

module.exports = {
  recordQualifyingAction,
  getLocalDateString,
  getOrCreateStreak,
};
