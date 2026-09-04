const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');

// @desc    Get my notifications (in-app messages)
// @route   GET /api/notifications/me
// @access  Private
const getMyNotifications = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  const result = await notificationService.getMyNotifications(req.user._id, {
    page,
    limit,
  });

  res.json({
    success: true,
    data: result.notifications,
    pagination: {
      page,
      limit,
      total: result.pagination.total,
      totalPages: result.pagination.pages,
    },
  });
});

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const notification = await notificationService.markRead(req.params.id, userId);
  res.json({ success: true, data: notification });
});

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  await notificationService.markAllRead(userId);
  res.json({ success: true, message: 'All notifications marked as read.' });
});

// @desc    Register FCM device token for web/mobile push
// @route   POST /api/notifications/device-token
// @access  Private
const registerDeviceToken = asyncHandler(async (req, res) => {
  const { fcmToken, platform } = req.body;
  const device = await notificationService.registerDeviceToken(req.user._id, fcmToken, platform);
  res.status(201).json({ success: true, data: device });
});

// @desc    Remove FCM device token on logout/unsubscribe
// @route   DELETE /api/notifications/device-token
// @access  Private
const removeDeviceToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  await notificationService.removeDeviceToken(req.user._id, fcmToken);
  res.json({ success: true, message: 'Device token removed successfully.' });
});

// @desc    Get notification delivery logs / history for current user
// @route   GET /api/notifications/history
// @access  Private
const getNotificationHistory = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  const result = await notificationService.getNotificationHistory(req.user._id, { page, limit });
  res.json({
    success: true,
    data: result.logs,
    pagination: result.pagination,
  });
});

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  registerDeviceToken,
  removeDeviceToken,
  getNotificationHistory,
};
