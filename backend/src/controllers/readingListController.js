const asyncHandler = require('../utils/asyncHandler');
const ReadingList = require('../models/ReadingList');
const AppError = require('../utils/AppError');

// Helper to get current tenant ID safely from request context (F0.1)
const getTenantId = (req) => {
  return req.tenantId || req.user?.collegeId;
};

// Helper to check owner authority safely whether userId/ownerId are populated or unpopulated
const isOwner = (list, userId) => {
  const userStr = userId ? userId.toString() : '';
  const ownerRaw = list.ownerId?._id ? list.ownerId._id : list.ownerId;
  const userRaw = list.userId?._id ? list.userId._id : list.userId;
  const ownerStr = ownerRaw ? ownerRaw.toString() : '';
  const userFieldStr = userRaw ? userRaw.toString() : '';
  return Boolean(userStr && (ownerStr === userStr || userFieldStr === userStr));
};

// @desc    Get reading lists (own + college-visible via F0.1)
// @route   GET /api/reading-lists
// @access  Private
const getLists = asyncHandler(async (req, res) => {
  const tenantCollegeId = getTenantId(req);
  if (!tenantCollegeId && req.user.role !== 'super-admin') {
    throw new AppError('Unauthorized: Active institution context required.', 403);
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const currentUserId = req.user._id || req.user.id;

  const query = {
    collegeId: tenantCollegeId,
    $or: [
      { userId: currentUserId },
      { ownerId: currentUserId },
      { visibility: { $in: ['college', 'public'] } },
    ],
  };

  if (req.query.tag) {
    query.tags = req.query.tag.toLowerCase().trim();
  }

  if (req.query.category) {
    query.category = req.query.category;
  }

  const total = await ReadingList.countDocuments(query);
  const lists = await ReadingList.find(query)
    .populate('userId', 'name email')
    .populate('ownerId', 'name email')
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  res.json({
    success: true,
    data: lists,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// @desc    Get single reading list by ID
// @route   GET /api/reading-lists/:id
// @access  Private
const getListById = asyncHandler(async (req, res) => {
  const list = await ReadingList.findById(req.params.id)
    .populate('userId', 'name email')
    .populate('ownerId', 'name email');

  if (!list) {
    throw new AppError('Reading list not found', 404);
  }

  const tenantCollegeId = getTenantId(req);
  const currentUserId = req.user._id || req.user.id;

  // Tenant Scoping (F0.1): Cross-college access forbidden
  if (
    list.collegeId &&
    tenantCollegeId &&
    list.collegeId.toString() !== tenantCollegeId.toString() &&
    req.user.role !== 'super-admin'
  ) {
    throw new AppError('Cross-college access forbidden', 403);
  }

  // Owner/Privacy Scoping: Non-owner accessing private list
  if (
    list.visibility === 'private' &&
    !isOwner(list, currentUserId) &&
    !['college-admin', 'super-admin', 'admin'].includes(req.user.role)
  ) {
    throw new AppError('Not authorized to access this private reading list', 403);
  }

  res.json({ success: true, data: list });
});

// @desc    Create reading list
// @route   POST /api/reading-lists
// @access  Private
const createList = asyncHandler(async (req, res) => {
  const tenantCollegeId = getTenantId(req);
  if (!tenantCollegeId && req.user.role !== 'super-admin') {
    throw new AppError('Unauthorized: Active institution context required.', 403);
  }

  const currentUserId = req.user._id || req.user.id;
  const { name, title, description, visibility, items, tags, category } = req.body;
  const listName = name || title || 'Untitled Reading List';

  const list = await ReadingList.create({
    collegeId: tenantCollegeId,
    userId: currentUserId,
    ownerId: currentUserId,
    name: listName,
    title: listName,
    description: description || '',
    visibility: visibility || 'private',
    tags: Array.isArray(tags) ? tags.map((t) => String(t).toLowerCase().trim()) : [],
    category: category || 'General',
    items: Array.isArray(items) ? items : [],
  });

  res.status(201).json({ success: true, data: list });
});

// @desc    Update reading list (owner-scoped)
// @route   PATCH /api/reading-lists/:id
// @access  Private
const updateList = asyncHandler(async (req, res) => {
  const list = await ReadingList.findById(req.params.id);

  if (!list) {
    throw new AppError('Reading list not found', 404);
  }

  const tenantCollegeId = getTenantId(req);
  const currentUserId = req.user._id || req.user.id;

  // Tenant Scoping (F0.1)
  if (
    list.collegeId &&
    tenantCollegeId &&
    list.collegeId.toString() !== tenantCollegeId.toString() &&
    req.user.role !== 'super-admin'
  ) {
    throw new AppError('Cross-college access forbidden', 403);
  }

  // Owner Scoping
  if (
    !isOwner(list, currentUserId) &&
    !['college-admin', 'super-admin', 'admin'].includes(req.user.role)
  ) {
    throw new AppError('Not authorized to update this reading list', 403);
  }

  const { name, title, description, visibility, items, tags, category, isFeatured } = req.body;
  const newName = name || title;

  if (newName !== undefined) {
    list.name = newName;
    list.title = newName;
  }
  if (description !== undefined) list.description = description;
  if (visibility !== undefined) list.visibility = visibility;
  if (items !== undefined) {
    list.items = items;
    list.markModified('items');
  }
  if (tags !== undefined)
    list.tags = Array.isArray(tags) ? tags.map((t) => String(t).toLowerCase().trim()) : [];
  if (category !== undefined) list.category = category;
  if (
    isFeatured !== undefined &&
    ['college-admin', 'super-admin', 'admin'].includes(req.user.role)
  ) {
    list.isFeatured = isFeatured;
  }

  await list.save();

  res.json({ success: true, data: list });
});

// @desc    Delete reading list (owner-scoped)
// @route   DELETE /api/reading-lists/:id
// @access  Private
const deleteList = asyncHandler(async (req, res) => {
  const list = await ReadingList.findById(req.params.id);

  if (!list) {
    throw new AppError('Reading list not found', 404);
  }

  const tenantCollegeId = getTenantId(req);
  const currentUserId = req.user._id || req.user.id;

  // Tenant Scoping (F0.1)
  if (
    list.collegeId &&
    tenantCollegeId &&
    list.collegeId.toString() !== tenantCollegeId.toString() &&
    req.user.role !== 'super-admin'
  ) {
    throw new AppError('Cross-college access forbidden', 403);
  }

  // Owner Scoping
  if (
    !isOwner(list, currentUserId) &&
    !['college-admin', 'super-admin', 'admin'].includes(req.user.role)
  ) {
    throw new AppError('Not authorized to delete this reading list', 403);
  }

  await list.deleteOne();

  res.json({ success: true, message: 'Reading list deleted successfully' });
});

// @desc    Add item to reading list (owner-scoped)
// @route   POST /api/reading-lists/:id/items
// @access  Private
const addListItem = asyncHandler(async (req, res) => {
  const list = await ReadingList.findById(req.params.id);

  if (!list) {
    throw new AppError('Reading list not found', 404);
  }

  const tenantCollegeId = getTenantId(req);
  const currentUserId = req.user._id || req.user.id;

  // Tenant Scoping (F0.1)
  if (
    list.collegeId &&
    tenantCollegeId &&
    list.collegeId.toString() !== tenantCollegeId.toString() &&
    req.user.role !== 'super-admin'
  ) {
    throw new AppError('Cross-college access forbidden', 403);
  }

  // Owner Scoping
  if (
    !isOwner(list, currentUserId) &&
    !['college-admin', 'super-admin', 'admin'].includes(req.user.role)
  ) {
    throw new AppError('Not authorized to modify items in this reading list', 403);
  }

  const { bookId, resourceId, resourceType, note } = req.body;
  const targetId = bookId || resourceId;

  if (!targetId) {
    throw new AppError('bookId or resourceId is required', 400);
  }

  list.items.push({
    bookId: targetId,
    resourceId: targetId,
    resourceType: resourceType || 'book',
    addedAt: new Date(),
    note: note || '',
  });

  list.markModified('items');
  await list.save();

  res.status(200).json({ success: true, data: list });
});

// @desc    Remove item from reading list (owner-scoped)
// @route   DELETE /api/reading-lists/:id/items/:bookId
// @access  Private
const deleteListItem = asyncHandler(async (req, res) => {
  const list = await ReadingList.findById(req.params.id);

  if (!list) {
    throw new AppError('Reading list not found', 404);
  }

  const tenantCollegeId = getTenantId(req);
  const currentUserId = req.user._id || req.user.id;

  // Tenant Scoping (F0.1)
  if (
    list.collegeId &&
    tenantCollegeId &&
    list.collegeId.toString() !== tenantCollegeId.toString() &&
    req.user.role !== 'super-admin'
  ) {
    throw new AppError('Cross-college access forbidden', 403);
  }

  // Owner Scoping
  if (
    !isOwner(list, currentUserId) &&
    !['college-admin', 'super-admin', 'admin'].includes(req.user.role)
  ) {
    throw new AppError('Not authorized to modify items in this reading list', 403);
  }

  const { bookId } = req.params;

  list.items = list.items.filter((item) => {
    const itemBookId = item.bookId ? item.bookId.toString() : '';
    const itemResourceId = item.resourceId ? item.resourceId.toString() : '';
    const itemId = item._id ? item._id.toString() : '';
    return itemBookId !== bookId && itemResourceId !== bookId && itemId !== bookId;
  });

  list.markModified('items');
  await list.save();

  res.json({ success: true, data: list });
});

module.exports = {
  getLists,
  getListById,
  createList,
  updateList,
  deleteList,
  addListItem,
  deleteListItem,
};
