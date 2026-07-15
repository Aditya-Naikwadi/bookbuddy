const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const User = require('../models/User');
const { emitNotification } = require('../sockets');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Creates and pushes a notification if not muted by the user's preferences.
 *
 * CRITICAL: This is the ONLY function permitted to write to the Notification collection.
 */
const notify = async (userId, type, message, relatedId = null, relatedType = null) => {
  // 1. Fetch user to verify they exist and get their collegeId
  const user = await User.findById(userId).select('collegeId');
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  // 2. Load the user's NotificationPreference (default all-true if none exists)
  let pref = await NotificationPreference.findOne({ userId });
  if (!pref) {
    pref = {
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      typePreferences: new Map(),
    };
  }

  // Check if in-app notifications are muted globally, or this specific type is muted
  const typeMuted =
    pref.typePreferences && pref.typePreferences.get
      ? pref.typePreferences.get(type) === false
      : pref.typePreferences && pref.typePreferences[type] === false;

  if (!pref.inAppEnabled || typeMuted) {
    // Notification is muted by user preferences
    return null;
  }

  // 3. Create the Notification document
  const notification = await Notification.create({
    userId,
    collegeId: user.collegeId,
    type,
    message,
    relatedId: relatedId || undefined,
    relatedType: relatedType || undefined,
    read: false,
  });

  // 4. Emit socket event
  emitNotification(userId, notification);

  // 5. Stubs for Email/Push alerts
  if (pref.emailEnabled) {
    // TODO: Integrate actual email service provider (e.g. Nodemailer/SendGrid)
    logger.info(`[TODO: Email Notification] Send to User: ${userId}, Message: "${message}"`);
  }
  if (pref.pushEnabled) {
    // TODO: Integrate push notification service provider (e.g. Firebase Cloud Messaging)
    logger.info(`[TODO: Push Notification] Send to User: ${userId}, Message: "${message}"`);
  }

  return notification;
};

/**
 * Simple read-side helper for the notifications route
 */
const getMyNotifications = async (userId, options = {}) => {
  const { read, page = 1, limit = 10 } = options;
  const filter = { userId };

  if (read !== undefined) {
    filter.read = read === 'true' || read === true;
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const total = await Notification.countDocuments(filter);
  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10));

  return {
    notifications,
    pagination: {
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
    },
  };
};

/**
 * Marks a notification as read and verifies ownership
 */
const markRead = async (notificationId, userId) => {
  const notification = await Notification.findOne({ _id: notificationId, userId });
  if (!notification) {
    throw new AppError('Notification not found.', 404);
  }

  notification.read = true;
  await notification.save();
  return notification;
};

module.exports = {
  notify,
  getMyNotifications,
  markRead,
};
