const asyncHandler = require('express-async-handler');
const Streak = require('../models/Streak');
const Sticker = require('../models/Sticker');
const UserSticker = require('../models/UserSticker');
const StreakReward = require('../models/StreakReward');
const CheckInLog = require('../models/CheckInLog');
const AppError = require('../utils/AppError');
const { useStreakRepair, recordQualifyingAction } = require('../services/streakService');

// @desc    Get user's current streak stats
// @route   GET /api/streak/me
// @access  Private
const getMyStreak = asyncHandler(async (req, res) => {
  let streak = await Streak.findOne({ userId: req.user._id });

  const timezone = req.user.timezone || 'Asia/Kolkata';
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone });

  if (!streak) {
    return res.json({
      success: true,
      data: {
        currentStreak: 0,
        longestStreak: 0,
        lastQualifyingDate: null,
        freezesAvailable: 2,
        todayComplete: false,
      },
    });
  }

  const lastQualifyingDateStr = streak.lastQualifyingActionAt
    ? new Date(streak.lastQualifyingActionAt).toLocaleDateString('en-CA', { timeZone: timezone })
    : null;

  res.json({
    success: true,
    data: {
      currentStreak: streak.currentStreak,
      longestStreak: streak.maxStreak, // Map maxStreak to longestStreak
      lastQualifyingDate: lastQualifyingDateStr,
      freezesAvailable: streak.freezesAvailable,
      todayComplete: lastQualifyingDateStr === todayStr,
    },
  });
});

// @desc    Idempotent daily check-in to extend streak
// @route   POST /api/streak/check-in
// @access  Private
const checkIn = asyncHandler(async (req, res) => {
  let streak;
  try {
    streak = await recordQualifyingAction(req.user._id, req.user.collegeId, 'check_in');
  } catch (error) {
    if (error.code === 'ALREADY_CHECKED_IN') {
      // Gracefully recover and return current state
      streak = await Streak.findOne({ userId: req.user._id });
      const timezone = req.user.timezone || 'Asia/Kolkata';
      const lastQualifyingDateStr =
        streak && streak.lastQualifyingActionAt
          ? new Date(streak.lastQualifyingActionAt).toLocaleDateString('en-CA', {
              timeZone: timezone,
            })
          : null;

      return res.json({
        success: true,
        message: 'Already checked in today.',
        data: {
          currentStreak: streak ? streak.currentStreak : 0,
          longestStreak: streak ? streak.maxStreak : 0,
          lastQualifyingDate: lastQualifyingDateStr,
          freezesAvailable: streak ? streak.freezesAvailable : 2,
          todayComplete: true,
        },
      });
    }
    throw error;
  }

  const timezone = req.user.timezone || 'Asia/Kolkata';
  const lastQualifyingDateStr = streak.lastQualifyingActionAt
    ? new Date(streak.lastQualifyingActionAt).toLocaleDateString('en-CA', { timeZone: timezone })
    : null;

  res.json({
    success: true,
    data: {
      currentStreak: streak.currentStreak,
      longestStreak: streak.maxStreak,
      lastQualifyingDate: lastQualifyingDateStr,
      freezesAvailable: streak.freezesAvailable,
      todayComplete: true,
      newlyUnlocked: streak.newlyUnlocked || [],
    },
  });
});

// @desc    Use the monthly streak repair
// @route   POST /api/streak/repair
// @access  Private
const repairStreak = asyncHandler(async (req, res) => {
  try {
    const streak = await useStreakRepair(req.user._id);
    res.json({ success: true, data: streak });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// @desc    Get full sticker catalog
// @route   GET /api/stickers
// @access  Private
const getStickerCatalog = asyncHandler(async (req, res) => {
  const stickers = await Sticker.find({});
  res.json({ success: true, data: stickers });
});

// @desc    Get my earned stickers
// @route   GET /api/stickers/me
// @access  Private
const getMyStickers = asyncHandler(async (req, res) => {
  const userStickers = await UserSticker.find({ userId: req.user._id });
  res.json({ success: true, data: userStickers });
});

// @desc    Get streak rewards ladder
// @route   GET /api/streak/rewards
// @access  Private
const getRewardsLadder = asyncHandler(async (req, res) => {
  const rewards = await StreakReward.find({}).sort('streakDays');
  res.json({ success: true, data: rewards });
});

// @desc    Get paginated check-in history
// @route   GET /api/streak/history
// @access  Private
const getStreakHistory = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const query = { userId: req.user._id };

  if (startDate || endDate) {
    query.checkInDate = {};
    if (startDate) query.checkInDate.$gte = startDate;
    if (endDate) query.checkInDate.$lte = endDate;
  }

  const history = await CheckInLog.find(query).sort({ checkInDate: -1 }).limit(100);
  res.json({ success: true, data: history });
});

// @desc    Get badge definitions with student unlock status
// @route   GET /api/streak/badges
// @access  Private
const getBadges = asyncHandler(async (req, res) => {
  const stickers = await Sticker.find({});
  const earned = await UserSticker.find({ userId: req.user._id });
  const earnedIds = new Set(earned.map((e) => e.stickerId.toString()));

  const mapped = stickers.map((sticker) => ({
    _id: sticker._id,
    name: sticker.name,
    rarity: sticker.rarity,
    iconUrl: sticker.iconUrl,
    criteria: sticker.criteria,
    unlocked: earnedIds.has(sticker._id.toString()),
  }));

  res.json({ success: true, data: mapped });
});

// @desc    Create new badge definition
// @route   POST /api/streak/badges
// @access  Private/Admin
const createBadge = asyncHandler(async (req, res) => {
  if (req.user.role !== 'college-admin' && req.user.role !== 'super-admin') {
    throw new AppError('Only staff or administrators are authorized to define badges.', 403);
  }

  const { name, rarity, iconUrl, criteria } = req.body;
  if (!name || !rarity || !criteria) {
    throw new AppError('Name, rarity, and criteria are required.', 400);
  }

  const badge = await Sticker.create({ name, rarity, iconUrl, criteria });
  res.status(201).json({ success: true, data: badge });
});

// @desc    Recalculate streak from CheckInLog
// @route   POST /api/streak/recalculate
// @access  Private
const recalculateMyStreak = asyncHandler(async (req, res) => {
  const { recalculateStreakFromLog } = require('../services/streakService');
  const result = await recalculateStreakFromLog(req.user._id);
  res.json({ success: true, data: result });
});

module.exports = {
  getMyStreak,
  checkIn,
  repairStreak,
  getStickerCatalog,
  getMyStickers,
  getRewardsLadder,
  getStreakHistory,
  getBadges,
  createBadge,
  recalculateMyStreak,
};
