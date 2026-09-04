const asyncHandler = require('express-async-handler');
const Book = require('../models/Book');
const UnifiedBook = require('../models/UnifiedBook');
const College = require('../models/College');
const BookDTO = require('../dtos/BookDTO');
const cacheHelper = require('../utils/cacheHelper');
const { getIo } = require('../sockets');
const mongoose = require('mongoose');
const { searchCatalogBooks } = require('../services/catalogSearchService');

/**
 * Validates requested collegeId path param against authenticated user's tenant scope.
 * Returns the effective collegeId or throws 403 Forbidden on tenant mismatch.
 */
const validateTenantAccess = (req, targetCollegeId) => {
  const requestedId = String(targetCollegeId);
  if (req.user && req.user.role !== 'super-admin' && req.user.role !== 'super_admin') {
    const userCollegeId = req.user.collegeId ? String(req.user.collegeId) : null;
    if (
      userCollegeId &&
      mongoose.Types.ObjectId.isValid(requestedId) &&
      userCollegeId !== requestedId
    ) {
      const error = new Error('Forbidden: Access denied to another college data');
      error.statusCode = 403;
      throw error;
    }
  }
  return requestedId;
};

/**
 * Resolves a valid ObjectId for college filtering (handles 'default', null, or invalid strings gracefully)
 */
const resolveCollegeId = async (req, targetCollegeId) => {
  if (targetCollegeId === 'public' || req.query?.scope === 'public') {
    if (targetCollegeId && mongoose.Types.ObjectId.isValid(String(targetCollegeId))) {
      return String(targetCollegeId);
    }
    return null;
  }

  const requestedId = validateTenantAccess(req, targetCollegeId);

  if (mongoose.Types.ObjectId.isValid(requestedId)) {
    return requestedId;
  }

  if (
    req.user &&
    req.user.collegeId &&
    mongoose.Types.ObjectId.isValid(String(req.user.collegeId))
  ) {
    return String(req.user.collegeId);
  }

  // Fallback to active college in DB for public visitors
  const defaultCollege =
    (await College.findOne({ status: 'active' }).select('_id').lean()) ||
    (await College.findOne({}).select('_id').lean());

  return defaultCollege ? defaultCollege._id.toString() : null;
};

const { invalidateStatsCache } = require('../utils/dashboardCache');

/**
 * Emits real-time socket event to college room and invalidates Redis cache on book mutations
 */
const notifyBookChange = (collegeId, eventName, payload) => {
  try {
    if (collegeId) {
      const cacheKey = cacheHelper.makeKey(collegeId, 'books', 'stats');
      cacheHelper.del(cacheKey);
      invalidateStatsCache(collegeId);
      const io = getIo();
      if (io) {
        io.to(`college:${collegeId}`).emit(eventName, payload);
      }
    }
  } catch {
    // Non-blocking
  }
};

// @desc    Get paginated books for a college
// @route   GET /api/v1/college/:id/books
// @access  Public / Protected (Tenant Scoped)
const getCollegeBooks = asyncHandler(async (req, res) => {
  const collegeId = await resolveCollegeId(req, req.params.id);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 12));
  const skip = (page - 1) * limit;

  const { search, category, format, available, sortBy } = req.query;

  const filter = collegeId ? { collegeId: new mongoose.Types.ObjectId(collegeId) } : {};

  if (search) {
    filter.$text = { $search: search };
  }

  if (category && category !== 'All' && category !== 'all') {
    const categories = category.split(',').map((c) => c.trim());
    filter.$or = [{ category: { $in: categories } }, { genre: { $in: categories } }];
  }

  if (format && format !== 'All' && format !== 'all') {
    filter.format = format;
  }

  if (available === 'true' || available === 'Available') {
    filter.$or = [{ copiesAvailable: { $gt: 0 } }, { availableCopies: { $gt: 0 } }];
  }

  let sortOption = { createdAt: -1 };
  if (search) {
    sortOption = { score: { $meta: 'textScore' } };
  } else if (sortBy === 'title') {
    sortOption = { title: 1 };
  } else if (sortBy === 'newest') {
    sortOption = { createdAt: -1 };
  } else if (sortBy === 'available') {
    sortOption = { copiesAvailable: -1 };
  }

  const [total, books] = await Promise.all([
    Book.countDocuments(filter),
    Book.find(filter).sort(sortOption).skip(skip).limit(limit).lean(),
  ]);

  res.json({
    success: true,
    data: BookDTO.transformMany(books),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

// @desc    Get cached stats for a college catalog
// @route   GET /api/v1/college/:id/books/stats
// @access  Public / Protected (Tenant Scoped)
const getCollegeBookStats = asyncHandler(async (req, res) => {
  const collegeId = await resolveCollegeId(req, req.params.id);
  const cacheKey = collegeId
    ? cacheHelper.makeKey(collegeId, 'books', 'stats')
    : 'books:stats:global';

  // Check Redis Cache
  const cachedStats = await cacheHelper.get(cacheKey);
  if (cachedStats) {
    return res.json({
      success: true,
      data: cachedStats,
      cached: true,
    });
  }

  const bookFilter = collegeId ? { collegeId: new mongoose.Types.ObjectId(collegeId) } : {};

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [totalBooks, newArrivalsCount, categoryAggregation] = await Promise.all([
    Book.countDocuments(bookFilter),
    Book.countDocuments({
      ...bookFilter,
      createdAt: { $gte: thirtyDaysAgo },
    }),
    Book.aggregate([
      { $match: bookFilter },
      {
        $group: {
          _id: { $ifNull: ['$category', '$genre'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const colors = [
    '#4F46E5',
    '#10B981',
    '#F59E0B',
    '#8B5CF6',
    '#EC4899',
    '#3B82F6',
    '#06B6D4',
    '#64748B',
  ];
  const totalGrouped = categoryAggregation.reduce((acc, c) => acc + c.count, 0);

  const categoryBreakdown = categoryAggregation.map((cat, idx) => ({
    label: cat._id || 'General',
    value: totalGrouped > 0 ? Math.round((cat.count / totalGrouped) * 100) : 0,
    count: cat.count,
    color: colors[idx % colors.length],
  }));

  const statsData = {
    totalBooks,
    totalCatalogBooks: totalBooks,
    newArrivalsCount,
    addedThisMonth: newArrivalsCount,
    categoryBreakdown,
  };

  // Cache in Redis for 300 seconds
  await cacheHelper.set(cacheKey, statsData, 300);

  res.json({
    success: true,
    data: statsData,
    cached: false,
  });
});

// @desc    Get new arrivals for a college
// @route   GET /api/v1/college/:id/books/new-arrivals
// @access  Public / Protected (Tenant Scoped)
const getCollegeNewArrivals = asyncHandler(async (req, res) => {
  const collegeId = await resolveCollegeId(req, req.params.id);
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));

  const filter = collegeId ? { collegeId: new mongoose.Types.ObjectId(collegeId) } : {};

  const newArrivals = await Book.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

  res.json({
    success: true,
    data: BookDTO.transformMany(newArrivals),
  });
});

// @desc    Search books for a college or public catalog
// @route   GET /api/v1/college/:id/books/search
// @access  Public / Protected (Tenant Scoped or Public Eligible)
const searchCollegeBooks = asyncHandler(async (req, res) => {
  const isPublicScope = req.query.scope === 'public' || req.params.id === 'public';
  const scope = isPublicScope ? 'public' : 'college';
  const collegeId = await resolveCollegeId(req, req.params.id);

  const result = await searchCatalogBooks({
    scope,
    collegeId,
    q: req.query.q || req.query.query || '',
    category: req.query.category,
    available: req.query.available,
    format: req.query.format,
    sortBy: req.query.sortBy,
    page: req.query.page,
    limit: req.query.limit,
  });

  res.json({
    success: true,
    data: result.books,
    pagination: result.pagination,
  });
});

// @desc    Batch resolve multiple book details by IDs
// @route   GET /api/v1/college/:id/books/batch
// @access  Public / Protected (Tenant Scoped)
const getCollegeBooksBatch = asyncHandler(async (req, res) => {
  const collegeId = await resolveCollegeId(req, req.params.id);
  const rawIds = req.query.ids;

  if (!rawIds) {
    return res.json({ success: true, data: [] });
  }

  const idArray = (typeof rawIds === 'string' ? rawIds.split(',') : rawIds)
    .map((id) => id.trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (idArray.length === 0) {
    return res.json({ success: true, data: [] });
  }

  const filter = { _id: { $in: idArray } };
  if (collegeId) {
    filter.collegeId = new mongoose.Types.ObjectId(collegeId);
  }

  const books = await Book.find(filter).lean();

  res.json({
    success: true,
    data: BookDTO.transformMany(books),
  });
});

// @desc    Get single book detail by ID
// @route   GET /api/v1/college/:id/books/:bookId
// @access  Public / Protected (Tenant Scoped)
const getCollegeBookById = asyncHandler(async (req, res) => {
  const collegeId = await resolveCollegeId(req, req.params.id);
  const { bookId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    res.status(400);
    throw new Error('Invalid book ID format');
  }

  const filter = { _id: bookId };
  if (collegeId) {
    filter.collegeId = new mongoose.Types.ObjectId(collegeId);
  }

  const book = await Book.findOne(filter).lean();

  if (!book) {
    res.status(404);
    throw new Error('Book not found in this college catalog');
  }

  res.json({
    success: true,
    data: BookDTO.transform(book),
  });
});

// @desc    Add new book to college catalog
// @route   POST /api/v1/college/:id/books
// @access  College Admin / Super Admin
const createCollegeBook = asyncHandler(async (req, res) => {
  const collegeId = await resolveCollegeId(req, req.params.id);
  const {
    title,
    author,
    isbn,
    category,
    genre,
    copiesTotal,
    copiesAvailable,
    totalCopies,
    availableCopies,
    format,
    shelfLocation,
    coverUrl,
    description,
  } = req.body;

  if (!title || !author || !isbn) {
    res.status(400);
    throw new Error('Title, Author, and ISBN are required');
  }

  const total = Number(totalCopies || copiesTotal || 1);
  const avail = Number(
    availableCopies !== undefined
      ? availableCopies
      : copiesAvailable !== undefined
        ? copiesAvailable
        : total
  );

  const targetCollegeObjectId = collegeId
    ? new mongoose.Types.ObjectId(collegeId)
    : req.user?.collegeId || null;

  const book = await Book.create({
    collegeId: targetCollegeObjectId,
    title,
    author,
    isbn,
    category: category || genre || 'General',
    copiesTotal: total,
    copiesAvailable: avail,
    format: format || 'physical',
    shelfLocation: shelfLocation || 'Main Stacks',
    coverImageUrl: coverUrl || null,
    description: description || '',
  });

  const transformed = BookDTO.transform(book);
  notifyBookChange(collegeId, 'book:added', transformed);

  res.status(201).json({
    success: true,
    data: transformed,
  });
});

/**
 * @desc    Get distinct book categories dynamically from database for a college
 * @route   GET /api/v1/college/:id/books/categories
 * @access  Public / Authenticated
 */
const getCollegeBookCategories = asyncHandler(async (req, res) => {
  const collegeId = await resolveCollegeId(req, req.params.id);
  const filter = collegeId ? { collegeId: new mongoose.Types.ObjectId(collegeId) } : {};

  const [bookCategories, unifiedCategories] = await Promise.all([
    Book.distinct('category', filter),
    UnifiedBook.distinct('sources', {}),
  ]);

  const rawCategories = Array.from(
    new Set([...bookCategories, ...unifiedCategories, 'Computer Science', 'General'])
  ).filter(Boolean);

  const categories = ['All', ...rawCategories.sort()];

  res.json({
    success: true,
    data: categories,
  });
});

module.exports = {
  getCollegeBooks,
  getCollegeBookStats,
  getCollegeNewArrivals,
  searchCollegeBooks,
  getCollegeBooksBatch,
  getCollegeBookCategories,
  getCollegeBookById,
  createCollegeBook,
  notifyBookChange,
};
