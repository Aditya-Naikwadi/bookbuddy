const asyncHandler = require('../utils/asyncHandler');
const EResource = require('../models/EResource');
const AppError = require('../utils/AppError');
const { recordQualifyingAction } = require('../services/streakService');

// @desc    Get internal e-resources
// @route   GET /api/eresources
// @access  Private
const listInternalResources = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const query = { source: 'internal', status: 'approved' };

  if (req.query.search) {
    query.title = { $regex: req.query.search, $options: 'i' };
  }

  const total = await EResource.countDocuments(query);
  const resources = await EResource.find(query).skip(skip).limit(limit).sort('-createdAt');

  res.json({
    success: true,
    data: resources,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// @desc    Update progress (already in external, but master prompt asks for it here too)
// @route   POST /api/eresources/:id/progress
// @access  Private
const updateProgress = asyncHandler(async (req, res) => {
  const { dailySecondsToday } = req.body;

  if (dailySecondsToday >= 180) {
    // 3 minutes = 180 seconds
    await recordQualifyingAction(req.user._id, 'eresource');
  }

  res.json({ success: true, message: 'Progress updated' });
});

module.exports = {
  listInternalResources,
  updateProgress,
};
