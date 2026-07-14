const asyncHandler = require('../utils/asyncHandler');
const ReadingList = require('../models/ReadingList');
const AppError = require('../utils/AppError');

// @desc    Get reading lists
// @route   GET /api/reading-lists
// @access  Private
const getLists = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // show public lists + user's own lists
  const query = { $or: [{ isPublic: true }, { createdBy: req.user._id }] };

  const total = await ReadingList.countDocuments(query);
  const lists = await ReadingList.find(query)
    .populate('createdBy', 'name')
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  res.json({
    success: true,
    data: lists,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// @desc    Get single list
// @route   GET /api/reading-lists/:id
// @access  Private
const getListById = asyncHandler(async (req, res) => {
  const list = await ReadingList.findById(req.params.id)
    .populate('createdBy', 'name')
    .populate('bookIds', 'title author coverImage');

  if (!list) {
    throw new AppError('Reading list not found', 404);
  }

  if (
    !list.isPublic &&
    list.createdBy._id.toString() !== req.user._id.toString() &&
    req.user.role === 'student'
  ) {
    throw new AppError('Not authorized to view this list', 403);
  }

  res.json({ success: true, data: list });
});

// @desc    Create reading list
// @route   POST /api/reading-lists
// @access  Private
const createList = asyncHandler(async (req, res) => {
  const { title, description, coverImage, bookIds, type, isPublic } = req.body;

  const list = await ReadingList.create({
    title,
    description,
    coverImage,
    bookIds: bookIds || [],
    createdBy: req.user._id,
    type: type || 'personal',
    isPublic: isPublic || false,
  });

  res.json({ success: true, data: list });
});

// @desc    Update reading list
// @route   PATCH /api/reading-lists/:id
// @access  Private
const updateList = asyncHandler(async (req, res) => {
  let list = await ReadingList.findById(req.params.id);

  if (!list) {
    throw new AppError('Reading list not found', 404);
  }

  if (
    list.createdBy.toString() !== req.user._id.toString() &&
    !['college-admin', 'super-admin', 'admin'].includes(req.user.role)
  ) {
    throw new AppError('Not authorized to update this list', 403);
  }

  list = await ReadingList.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.json({ success: true, data: list });
});

// @desc    Delete reading list
// @route   DELETE /api/reading-lists/:id
// @access  Private
const deleteList = asyncHandler(async (req, res) => {
  const list = await ReadingList.findById(req.params.id);

  if (!list) {
    throw new AppError('Reading list not found', 404);
  }

  if (
    list.createdBy.toString() !== req.user._id.toString() &&
    !['college-admin', 'super-admin', 'admin'].includes(req.user.role)
  ) {
    throw new AppError('Not authorized to delete this list', 403);
  }

  await list.deleteOne();

  res.json({ success: true, data: {} });
});

module.exports = {
  getLists,
  getListById,
  createList,
  updateList,
  deleteList,
};
