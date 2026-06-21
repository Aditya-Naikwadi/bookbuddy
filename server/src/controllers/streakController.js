const asyncHandler = require('express-async-handler');
const Streak = require('../models/Streak');
const Sticker = require('../models/Sticker');
const UserSticker = require('../models/UserSticker');
const StreakReward = require('../models/StreakReward');
const { useStreakRepair } = require('../services/streakService');

// @desc    Get user's current streak stats
// @route   GET /api/streak/me
// @access  Private
const getMyStreak = asyncHandler(async (req, res) => {
  let streak = await Streak.findOne({ userId: req.user._id });
  
  if (!streak) {
    // If they have no streak doc yet, return a clean state
    return res.json({
      success: true,
      data: {
        currentStreak: 0,
        longestStreak: 0,
        lastQualifyingDate: null,
        freezesAvailable: 0,
        todayComplete: false
      }
    });
  }

  const timezone = req.user.timezone || 'Asia/Kolkata';
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
  
  res.json({
    success: true,
    data: {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastQualifyingDate: streak.lastQualifyingDate,
      freezesAvailable: streak.freezesAvailable,
      todayComplete: streak.lastQualifyingDate === todayStr
    }
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

module.exports = {
  getMyStreak,
  repairStreak,
  getStickerCatalog,
  getMyStickers,
  getRewardsLadder
};
