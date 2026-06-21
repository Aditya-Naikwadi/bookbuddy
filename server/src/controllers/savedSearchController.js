const asyncHandler = require('../utils/asyncHandler');
const SavedSearch = require('../models/SavedSearch');
const AppError = require('../utils/AppError');

// @desc    Get my saved searches
// @route   GET /api/saved-searches/me
// @access  Private
const getMySavedSearches = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await SavedSearch.countDocuments({ userId: req.user._id });
  const searches = await SavedSearch.find({ userId: req.user._id })
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  res.json({ 
    success: true, 
    data: searches,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});

// @desc    Create saved search
// @route   POST /api/saved-searches
// @access  Private
const createSavedSearch = asyncHandler(async (req, res) => {
  const { label, filters } = req.body;

  const search = await SavedSearch.create({
    userId: req.user._id,
    label,
    filters
  });

  res.json({ success: true, data: search });
});

module.exports = {
  getMySavedSearches,
  createSavedSearch
};
