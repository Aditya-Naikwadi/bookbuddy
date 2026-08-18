const NotificationPreference = require('../models/NotificationPreference');

// GET /api/v1/notification-preferences/me
const getMyPreferences = async (req, res, next) => {
  try {
    let prefs = await NotificationPreference.findOne({ userId: req.user._id });
    if (!prefs) {
      prefs = await NotificationPreference.create({
        userId: req.user._id,
        emailEnabled: true,
        pushEnabled: true,
        inAppEnabled: true,
        typePreferences: {},
      });
    }

    res.status(200).json({
      success: true,
      data: prefs,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/notification-preferences/me
const updateMyPreferences = async (req, res, next) => {
  try {
    const { emailEnabled, pushEnabled, inAppEnabled, typePreferences } = req.body;

    let prefs = await NotificationPreference.findOne({ userId: req.user._id });
    if (!prefs) {
      prefs = new NotificationPreference({ userId: req.user._id });
    }

    if (emailEnabled !== undefined) prefs.emailEnabled = Boolean(emailEnabled);
    if (pushEnabled !== undefined) prefs.pushEnabled = Boolean(pushEnabled);
    if (inAppEnabled !== undefined) prefs.inAppEnabled = Boolean(inAppEnabled);
    if (typePreferences && typeof typePreferences === 'object') {
      prefs.typePreferences = new Map(Object.entries(typePreferences));
    }

    await prefs.save();

    res.status(200).json({
      success: true,
      data: prefs,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMyPreferences,
  updateMyPreferences,
};
