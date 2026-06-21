const asyncHandler = require('../utils/asyncHandler');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');

// @desc    Get my notifications
// @route   GET /api/notifications/me
// @access  Private
const getMyNotifications = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await Notification.countDocuments({ userId: req.user._id });
  const notifications = await Notification.find({ userId: req.user._id })
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  res.json({ 
    success: true, 
    data: notifications,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, userId: req.user._id });

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  notification.isRead = true;
  await notification.save();

  res.json({ success: true, data: notification });
});

module.exports = {
  getMyNotifications,
  markAsRead
};
