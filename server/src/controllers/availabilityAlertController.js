const asyncHandler = require('../utils/asyncHandler');
const AvailabilityAlert = require('../models/AvailabilityAlert');
const { notify } = require('../services/notificationService');
const AppError = require('../utils/AppError');

// @desc    Toggle or create availability alert for a catalog item
// @route   POST /api/v1/availability-alerts
// @access  Private
const subscribeAlert = asyncHandler(async (req, res) => {
  const { resourceType, resourceId } = req.body;

  if (!['book', 'eresource'].includes(resourceType)) {
    throw new AppError('Invalid resource type', 400);
  }

  let alert = await AvailabilityAlert.findOne({
    collegeId: req.user.collegeId,
    userId: req.user.id,
    resourceId,
  });

  if (alert) {
    if (alert.status === 'active') {
      alert.status = 'cancelled';
      await alert.save();
      return res.json({
        success: true,
        message: 'Alert unsubscribed',
        data: { subscribed: false },
      });
    } else {
      alert.status = 'active';
      alert.notifiedAt = null;
      await alert.save();
      return res.json({
        success: true,
        message: 'Alert subscribed',
        data: { subscribed: true },
      });
    }
  }

  alert = await AvailabilityAlert.create({
    collegeId: req.user.collegeId,
    userId: req.user.id,
    resourceType,
    resourceId,
    status: 'active',
  });

  res.status(201).json({
    success: true,
    message: 'Alert subscribed',
    data: { subscribed: true },
  });
});

// @desc    Get user active alerts
// @route   GET /api/v1/availability-alerts
// @access  Private
const getUserAlerts = asyncHandler(async (req, res) => {
  const alerts = await AvailabilityAlert.find({
    collegeId: req.user.collegeId,
    userId: req.user.id,
    status: 'active',
  }).sort('-createdAt');

  res.json({
    success: true,
    data: alerts,
  });
});

// Helper function to process alerts when resource becomes available
const notifyAvailableResource = async ({ collegeId, resourceType, resourceId, title }) => {
  try {
    const alerts = await AvailabilityAlert.find({
      collegeId,
      resourceType,
      resourceId,
      status: 'active',
    });

    if (!alerts || alerts.length === 0) return;

    for (const alert of alerts) {
      alert.status = 'notified';
      alert.notifiedAt = new Date();
      await alert.save();

      await notify(
        alert.userId,
        'availability_alert',
        `"${title || 'An item'}" you requested is now available to borrow or access.`,
        resourceId,
        resourceType
      );
    }
  } catch (error) {
    console.error('Error dispatching availability alerts:', error);
  }
};

module.exports = {
  subscribeAlert,
  getUserAlerts,
  notifyAvailableResource,
};
