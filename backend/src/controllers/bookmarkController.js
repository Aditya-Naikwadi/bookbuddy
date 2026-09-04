const asyncHandler = require('../utils/asyncHandler');
const Bookmark = require('../models/Bookmark');
const EResource = require('../models/EResource');
const AppError = require('../utils/AppError');

// @desc    Get my bookmarks
// @route   GET /api/bookmarks/me
// @access  Private
const getMyBookmarks = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await Bookmark.countDocuments({ userId: req.user.id });
  const bookmarks = await Bookmark.find({ userId: req.user.id })
    .populate('eresourceId', 'title author coverImage format')
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  res.json({
    success: true,
    data: bookmarks,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// @desc    Create bookmark
// @route   POST /api/bookmarks
// @access  Private
const createBookmark = asyncHandler(async (req, res) => {
  const { eresourceId, locationRef, note } = req.body;

  // Enforce tenant scoping: verify eresource belongs to user's college
  const eresource = await EResource.findOne({ _id: eresourceId, collegeId: req.user.collegeId });
  if (!eresource) {
    throw new AppError('EResource not found or unauthorized access.', 404);
  }

  const existing = await Bookmark.findOne({ userId: req.user.id, eresourceId, locationRef });
  if (existing) {
    throw new AppError('Bookmark already exists at this location', 400);
  }

  const bookmark = await Bookmark.create({
    userId: req.user.id,
    eresourceId,
    locationRef,
    note,
  });

  res.json({ success: true, data: bookmark });
});

// @desc    Delete bookmark
// @route   DELETE /api/bookmarks/:id
// @access  Private
const deleteBookmark = asyncHandler(async (req, res) => {
  const bookmark = await Bookmark.findOne({ _id: req.params.id, userId: req.user.id });

  if (!bookmark) {
    throw new AppError('Bookmark not found', 404);
  }

  await bookmark.deleteOne();

  res.json({ success: true, data: {} });
});

module.exports = {
  getMyBookmarks,
  createBookmark,
  deleteBookmark,
};
