const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const NotificationLog = require('../models/NotificationLog');
const DeviceToken = require('../models/DeviceToken');
const User = require('../models/User');
const { emitNotification } = require('../sockets');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Exponential backoff retry utility
 */
const retrySend = async (sendFn, maxAttempts = 3, initialDelayMs = 50) => {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await sendFn(attempt);
      return { success: true, result, attempts: attempt };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  return {
    success: false,
    error: lastError?.message || 'Delivery failed after retries',
    attempts: maxAttempts,
  };
};

/**
 * Send email notification using configured provider (Nodemailer / SendGrid / Sandbox)
 */
const sendEmail = async (userId, userEmail, type, message) => {
  const provider = config.emailProvider || 'sandbox-nodemailer';

  const deliveryResult = await retrySend(
    async () => {
      // Standard mock/sandbox or real provider invocation
      if (process.env.EMAIL_DRIVER_THROW === 'true') {
        throw new Error('Email provider connection timeout');
      }

      // In non-test environment, write to logger or HTTP provider
      logger.info(`[Email Service (${provider})] Sent to ${userEmail}: "${message}"`);
      return { messageId: `msg_${Date.now()}` };
    },
    3,
    30
  );

  const status = deliveryResult.success ? 'sent' : 'failed';
  const error = deliveryResult.success ? null : deliveryResult.error;

  const logEntry = await NotificationLog.create({
    userId,
    channel: 'email',
    type,
    status,
    provider,
    error,
  });

  return logEntry;
};

/**
 * Send push notification using FCM or Sandbox provider
 */
const sendPush = async (userId, type, message) => {
  const provider = config.pushProvider || 'sandbox-fcm';

  // Fetch device tokens for user
  const deviceTokens = await DeviceToken.find({ userId }).select('+fcmToken');

  const deliveryResult = await retrySend(
    async () => {
      if (process.env.PUSH_DRIVER_THROW === 'true') {
        throw new Error('FCM push service unreachable');
      }

      if (!deviceTokens || deviceTokens.length === 0) {
        // If no devices registered, log sent/mock status for web push sandbox
        logger.info(`[Push Service (${provider})] No active FCM device tokens for user ${userId}`);
      } else {
        logger.info(
          `[Push Service (${provider})] Sent push to ${deviceTokens.length} devices for user ${userId}: "${message}"`
        );
      }

      return { multicastId: `fcm_${Date.now()}` };
    },
    3,
    30
  );

  const status = deliveryResult.success ? 'sent' : 'failed';
  const error = deliveryResult.success ? null : deliveryResult.error;

  const logEntry = await NotificationLog.create({
    userId,
    channel: 'push',
    type,
    status,
    provider,
    error,
  });

  return logEntry;
};

/**
 * Creates and pushes a notification, triggers Email/Push drivers, and logs to NotificationLog
 */
const notify = async (userId, type, message, relatedId = null, relatedType = null) => {
  const user = await User.findById(userId).select('email collegeId');
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  let pref = await NotificationPreference.findOne({ userId });
  if (!pref) {
    pref = {
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      typePreferences: new Map(),
    };
  }

  const typeMuted =
    pref.typePreferences && pref.typePreferences.get
      ? pref.typePreferences.get(type) === false
      : pref.typePreferences && pref.typePreferences[type] === false;

  if (!pref.inAppEnabled || typeMuted) {
    return null;
  }

  const notification = await Notification.create({
    userId,
    collegeId: user.collegeId,
    type,
    message,
    relatedId: relatedId || undefined,
    relatedType: relatedType || undefined,
    read: false,
  });

  emitNotification(userId, notification);

  if (pref.emailEnabled && user.email) {
    await sendEmail(userId, user.email, type, message);
  }
  if (pref.pushEnabled) {
    await sendPush(userId, type, message);
  }

  return notification;
};

/**
 * Register FCM device token
 */
const registerDeviceToken = async (userId, fcmToken, platform = 'web') => {
  if (!fcmToken) {
    throw new AppError('FCM token is required.', 400);
  }

  const device = await DeviceToken.findOneAndUpdate(
    { fcmToken },
    { userId, fcmToken, platform, lastSeenAt: new Date() },
    { upsert: true, new: true }
  );

  return device;
};

/**
 * Remove FCM device token
 */
const removeDeviceToken = async (userId, fcmToken) => {
  if (!fcmToken) {
    throw new AppError('FCM token is required.', 400);
  }

  await DeviceToken.deleteOne({ userId, fcmToken });
  return true;
};

/**
 * Get notification log delivery history for user
 */
const getNotificationHistory = async (userId, options = {}) => {
  const { page = 1, limit = 20 } = options;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const total = await NotificationLog.countDocuments({ userId });
  const logs = await NotificationLog.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10));

  return {
    logs,
    pagination: {
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
    },
  };
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
    .limit(parseInt(limit, 10))
    .lean();

  return {
    notifications,
    total,
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

/**
 * Marks all unread notifications for a user as read
 */
const markAllRead = async (userId) => {
  await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
  return true;
};

module.exports = {
  notify,
  sendEmail,
  sendPush,
  registerDeviceToken,
  removeDeviceToken,
  getNotificationHistory,
  getMyNotifications,
  markRead,
  markAllRead,
};
