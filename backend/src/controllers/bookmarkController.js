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

  // Enforce tenant scoping: verify eresource belongs to user's college or is public
  const eresourceQuery = { _id: eresourceId };
  if (req.user.collegeId) {
    eresourceQuery.$or = [
      { collegeId: req.user.collegeId },
      { collegeId: null },
      { collegeId: { $exists: false } },
    ];
  }
  const eresource = await EResource.findOne(eresourceQuery);
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
  const bookmark = await Bookmark.findById(req.params.id);

  if (!bookmark) {
    throw new AppError('Bookmark not found', 404);
  }

  // IDOR Protection: Confirm caller owns this bookmark
  if (String(bookmark.userId) !== String(req.user.id)) {
    throw new AppError('Forbidden: You do not have permission to delete this bookmark.', 403);
  }

  await bookmark.deleteOne();

  res.json({ success: true, data: {} });
});

module.exports = {
  getMyBookmarks,
  createBookmark,
  deleteBookmark,
};
