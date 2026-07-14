const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');
const AppError = require('../utils/AppError');

// @desc    Get my notifications
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
  const notification = await notificationService.markRead(req.params.id, req.user._id);
  res.json({ success: true, data: notification });
});

module.exports = {
  getMyNotifications,
  markAsRead,
};
