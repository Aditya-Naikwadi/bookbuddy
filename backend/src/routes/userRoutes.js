const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middlewares/auth');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

// @desc    Get current user profile
// @route   GET /api/v1/users/me OR GET /api/users/me
// @access  Private
router.get(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    res.json({
      success: true,
      data: user,
    });
  })
);

// @desc    Update current user profile / settings (e.g. isLeaderboardVisible)
// @route   PATCH /api/v1/users/me OR PATCH /api/users/me
// @access  Private
router.patch(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const { isLeaderboardVisible, isLeaderboardPublic, hasSeenOnboarding, name, avatar } = req.body;

    if (typeof isLeaderboardVisible === 'boolean') {
      user.isLeaderboardVisible = isLeaderboardVisible;
    }
    if (typeof isLeaderboardPublic === 'boolean') {
      user.isLeaderboardVisible = isLeaderboardPublic;
    }
    if (typeof hasSeenOnboarding === 'boolean') {
      user.hasSeenOnboarding = hasSeenOnboarding;
    }
    if (name) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    res.json({
      success: true,
      data: user,
    });
  })
);

module.exports = router;
