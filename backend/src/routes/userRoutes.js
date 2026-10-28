const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middlewares/auth');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const requireFeature = require('../middlewares/requireFeature');
const validate = require('../middlewares/validate');
const { FEATURE_FLAGS, updateAccessibilitySchema } = require('@bookbuddy/shared');

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

// @desc    Get user accessibility preferences (dyslexia font, high contrast, TTS)
// @route   GET /api/v1/users/me/accessibility
// @access  Private (Scoped by collegeId and userId from session)
router.get(
  '/me/accessibility',
  protect,
  requireFeature(FEATURE_FLAGS.ACCESSIBILITY_MODE),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('accessibilityPreferences collegeId');
    if (!user) {
      throw new AppError('User not found', 404);
    }
    res.json({
      success: true,
      data: user.accessibilityPreferences || {
        dyslexiaFont: false,
        highContrast: false,
        textToSpeech: false,
        ttsRate: 1.0,
        ttsPitch: 1.0,
      },
    });
  })
);

// @desc    Update user accessibility preferences (dyslexia font, high contrast, TTS)
// @route   PATCH /api/v1/users/me/accessibility
// @access  Private (Scoped by collegeId and userId from session)
router.patch(
  '/me/accessibility',
  protect,
  requireFeature(FEATURE_FLAGS.ACCESSIBILITY_MODE),
  validate(updateAccessibilitySchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.accessibilityPreferences) {
      user.accessibilityPreferences = {};
    }

    const { dyslexiaFont, highContrast, textToSpeech, ttsRate, ttsPitch } = req.body;
    if (typeof dyslexiaFont === 'boolean')
      user.accessibilityPreferences.dyslexiaFont = dyslexiaFont;
    if (typeof highContrast === 'boolean')
      user.accessibilityPreferences.highContrast = highContrast;
    if (typeof textToSpeech === 'boolean')
      user.accessibilityPreferences.textToSpeech = textToSpeech;
    if (typeof ttsRate === 'number') user.accessibilityPreferences.ttsRate = ttsRate;
    if (typeof ttsPitch === 'number') user.accessibilityPreferences.ttsPitch = ttsPitch;

    await user.save();

    res.json({
      success: true,
      data: user.accessibilityPreferences,
    });
  })
);

module.exports = router;
