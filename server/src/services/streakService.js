const Streak = require('../models/Streak');
const User = require('../models/User');
const Sticker = require('../models/Sticker');
const UserSticker = require('../models/UserSticker');
const StreakReward = require('../models/StreakReward');
const Loan = require('../models/Loan');

/**
 * Helper to get the local YYYY-MM-DD string for a user's timezone.
 */
const getLocalDateString = (dateObj, timezone) => {
  try {
    return dateObj.toLocaleDateString('en-CA', { timeZone: timezone });
  } catch (err) {
    // Fallback if timezone is invalid
    return dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }
};

/**
 * Returns a new Date object shifted by N days.
 */
const addDays = (dateObj, days) => {
  const newDate = new Date(dateObj.valueOf());
  newDate.setDate(newDate.getDate() + days);
  return newDate;
};

const checkAndAwardStickers = async (userId) => {
  const newStickers = [];
  const streak = await Streak.findOne({ userId });
  if (!streak) return newStickers;

  const allStickers = await Sticker.find();
  const earnedStickers = await UserSticker.find({ userId });
  const earnedCodes = new Set(earnedStickers.map(s => s.stickerCode));

  // Determine current stats
  const currentDays = streak.currentStreak;
  
  // Example: genres, lab counts, etc. In a real system, you'd aggregate these.
  // For demo purposes, we will mostly evaluate 'streak_days' criteria here.
  for (const sticker of allStickers) {
    if (earnedCodes.has(sticker.code)) continue;

    let qualified = false;
    if (sticker.criteriaType === 'streak_days') {
      if (currentDays >= sticker.criteriaValue) qualified = true;
    }
    // Implement other criteria aggregations as needed (e.g. genre_count)...

    if (qualified) {
      await UserSticker.create({ userId, stickerCode: sticker.code });
      newStickers.push(sticker);
    }
  }

  return newStickers;
};

const recordQualifyingAction = async (userId, actionType) => {
  const user = await User.findById(userId);
  if (!user) return;

  const timezone = user.timezone || 'Asia/Kolkata';
  const now = new Date();
  const todayStr = getLocalDateString(now, timezone);
  const yesterdayStr = getLocalDateString(addDays(now, -1), timezone);

  let streak = await Streak.findOne({ userId });

  if (!streak) {
    // First time ever
    streak = await Streak.create({
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastQualifyingDate: todayStr
    });
  } else {
    // If already qualified today, do nothing
    if (streak.lastQualifyingDate === todayStr) {
      return; // No-op
    }

    if (streak.lastQualifyingDate === yesterdayStr) {
      // Continuous streak!
      streak.currentStreak += 1;
    } else {
      // Gap in streak
      const gapDateStr = getLocalDateString(addDays(now, -2), timezone);
      
      // If the last qualifying date was exactly 2 days ago and they have a freeze
      if (streak.lastQualifyingDate === gapDateStr && streak.freezesAvailable > 0) {
        streak.freezesAvailable -= 1;
        streak.freezesUsedTotal += 1;
        streak.currentStreak += 1; // Treat as continuous
      } else {
        // Streak broken
        streak.currentStreak = 1;
      }
    }

    if (streak.currentStreak > streak.longestStreak) {
      streak.longestStreak = streak.currentStreak;
    }

    streak.lastQualifyingDate = todayStr;

    // Award freeze if they hit a multiple of 7
    if (streak.currentStreak % 7 === 0 && streak.freezesAvailable < 2) {
      streak.freezesAvailable += 1;
    }

    await streak.save();
  }

  // Check milestone rewards
  const newRewards = [];
  const rewardDef = await StreakReward.findOne({ streakDays: streak.currentStreak });
  if (rewardDef) {
    // Apply reward
    if (rewardDef.rewardType === 'freeze' && streak.freezesAvailable < 2) {
      streak.freezesAvailable += 1;
      await streak.save();
    } else if (rewardDef.rewardType === 'bonus_renewal') {
      user.bonusRenewalsAvailable = (user.bonusRenewalsAvailable || 0) + 1;
      await user.save();
    } else if (rewardDef.rewardType === 'fine_waiver') {
      user.fineWaiverCoupons = (user.fineWaiverCoupons || 0) + 1;
      await user.save();
    }
    newRewards.push(rewardDef);
  }

  // Check stickers
  const newStickers = await checkAndAwardStickers(userId);

  // Emit event via Socket.io (Requires app.get('io'))
  // This will be called globally wherever we pass `req.app` or if we have a global io instance
  // Since we don't have req here, we'll return the payload so the controller can emit it.
  
  return {
    streak,
    newStickers,
    newRewards
  };
};

const useStreakRepair = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  
  const streak = await Streak.findOne({ userId });
  if (!streak) throw new Error('No streak found');
  if (streak.repairUsedThisMonth) throw new Error('Repair already used this month');

  const timezone = user.timezone || 'Asia/Kolkata';
  const now = new Date();
  const yesterdayStr = getLocalDateString(addDays(now, -1), timezone);
  const twoDaysAgoStr = getLocalDateString(addDays(now, -2), timezone);

  // The repair is meant to be used when `lastQualifyingDate` was exactly 2 days ago (missed yesterday)
  if (streak.lastQualifyingDate !== twoDaysAgoStr) {
    throw new Error('Streak repair can only restore a break that happened yesterday');
  }

  // Restore the streak
  streak.repairUsedThisMonth = true;
  streak.lastQualifyingDate = yesterdayStr; // Artificially plug the gap
  // The user will still need to do an action TODAY to increment it, 
  // but at least it won't reset to 1 when they do.
  
  await streak.save();
  return streak;
};

module.exports = {
  recordQualifyingAction,
  checkAndAwardStickers,
  useStreakRepair
};
