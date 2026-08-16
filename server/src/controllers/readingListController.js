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

  // show public lists + user's own lists scoped to their college
  const query = {
    collegeId: req.user.collegeId,
    $or: [{ visibility: 'public' }, { ownerId: req.user.id }],
  };

  const total = await ReadingList.countDocuments(query);
  const lists = await ReadingList.find(query)
    .populate('ownerId', 'name')
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
  const list = await ReadingList.findOne({
    _id: req.params.id,
    collegeId: req.user.collegeId,
  }).populate('ownerId', 'name');

  if (!list) {
    throw new AppError('Reading list not found', 404);
  }

  if (
    list.visibility === 'private' &&
    list.ownerId._id.toString() !== req.user.id.toString() &&
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
  const { title, description, visibility } = req.body;

  const list = await ReadingList.create({
    collegeId: req.user.collegeId,
    ownerId: req.user.id,
    title,
    description,
    visibility: visibility || 'private',
    items: [],
  });

  res.json({ success: true, data: list });
});

// @desc    Update reading list
// @route   PATCH /api/reading-lists/:id
// @access  Private
const updateList = asyncHandler(async (req, res) => {
  let list = await ReadingList.findOne({ _id: req.params.id, collegeId: req.user.collegeId });

  if (!list) {
    throw new AppError('Reading list not found', 404);
  }

  if (
    list.ownerId.toString() !== req.user.id.toString() &&
    !['college-admin', 'super-admin', 'admin'].includes(req.user.role)
  ) {
    throw new AppError('Not authorized to update this list', 403);
  }

  const { title, description, visibility, items } = req.body;
  if (title !== undefined) list.title = title;
  if (description !== undefined) list.description = description;
  if (visibility !== undefined) list.visibility = visibility;
  if (items !== undefined) list.items = items;

  await list.save();

  res.json({ success: true, data: list });
});

// @desc    Delete reading list
// @route   DELETE /api/reading-lists/:id
// @access  Private
const deleteList = asyncHandler(async (req, res) => {
  const list = await ReadingList.findOne({ _id: req.params.id, collegeId: req.user.collegeId });

  if (!list) {
    throw new AppError('Reading list not found', 404);
  }

  if (
    list.ownerId.toString() !== req.user.id.toString() &&
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
