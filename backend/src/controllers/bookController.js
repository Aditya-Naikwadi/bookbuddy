const Book = require('../models/Book');
const BookDTO = require('../dtos/BookDTO');
const AppError = require('../utils/AppError');
const asyncHandler = require('express-async-handler');
const { scopeToCollege } = require('../middlewares/scopeToCollege');
const cursorPagination = require('../utils/cursorPagination');
const { getCache, setCache } = require('../utils/redisCache');
const crypto = require('crypto');

// @desc    Get all books with search, filter & cursor/keyset pagination
// @route   GET /api/books
// @access  Public
const getBooks = asyncHandler(async (req, res) => {
  const pageSize = Math.max(1, Math.min(100, Number(req.query.limit) || 12));
  const {
    search,
    category,
    format,
    available,
    yearFrom,
    yearTo,
    lang,
    cursor,
    sortBy = 'newest',
  } = req.query;

  let queryFilter = {};

  if (search) {
    queryFilter.$text = { $search: search };
  }

  if (category) {
    // allow comma separated categories
    queryFilter.category = { $in: category.split(',') };
  }

  if (format) {
    queryFilter.format = format;
  }

  if (available === 'true') {
    queryFilter.availableCopies = { $gt: 0 };
  }

  if (yearFrom || yearTo) {
    queryFilter.publishedYear = {};
    if (yearFrom) queryFilter.publishedYear.$gte = Number(yearFrom);
    if (yearTo) queryFilter.publishedYear.$lte = Number(yearTo);
  }

  if (lang) {
    queryFilter.language = lang;
  }

  const scopedQuery = scopeToCollege(queryFilter, req.user?.collegeId);

  // Redis-cached total count calculation (5-minute TTL)
  const countKeyPayload = JSON.stringify({
    scopedQuery,
    cid: req.user?.collegeId || 'public',
  });
  const countHash = crypto.createHash('md5').update(countKeyPayload).digest('hex');
  const countCacheKey = `books:count:${countHash}`;

  let total = await getCache(countCacheKey);
  if (total === null || total === undefined) {
    total = await Book.countDocuments(scopedQuery);
    await setCache(countCacheKey, total, 300);
  }

  // Handle keyset cursor pagination vs legacy offset fallback
  const isKeyset = Boolean(cursor || !req.query.page);
  let books;
  let hasMore;
  let nextCursor = null;

  if (isKeyset) {
    const keysetFilter = { ...scopedQuery };
    if (cursor) {
      const decodedCursor = cursorPagination.decode(cursor);
      if (decodedCursor) {
        cursorPagination.apply(keysetFilter, decodedCursor, sortBy);
      }
    }

    const sortConfig =
      sortBy === 'title'
        ? { title: 1, _id: 1 }
        : search
          ? { score: { $meta: 'textScore' } }
          : { createdAt: -1, _id: -1 };

    const rawBooks = await Book.find(keysetFilter)
      .limit(pageSize + 1)
      .sort(sortConfig);

    hasMore = rawBooks.length > pageSize;
    books = hasMore ? rawBooks.slice(0, pageSize) : rawBooks;

    if (hasMore && books.length > 0) {
      const last = books[books.length - 1];
      const sortVal = sortBy === 'title' ? last.title : new Date(last.createdAt).getTime();
      nextCursor = cursorPagination.encode(sortVal, last._id.toString());
    }
  } else {
    const page = Math.max(1, Number(req.query.page) || 1);
    books = await Book.find(scopedQuery)
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 });
    hasMore = page * pageSize < total;
  }

  const pageNumber = Number(req.query.page) || 1;
  const totalPages = Math.ceil(total / pageSize) || 1;

  res.json({
    success: true,
    books: BookDTO.transformMany(books),
    data: BookDTO.transformMany(books),
    page: pageNumber,
    pages: totalPages,
    total,
    pagination: {
      hasMore,
      nextCursor,
      total,
      limit: pageSize,
      page: pageNumber,
      pages: totalPages,
    },
  });
});

// @desc    Get book by ID
// @route   GET /api/books/:id
// @access  Public
const getBookById = asyncHandler(async (req, res, next) => {
  const scopedFilter = scopeToCollege({ _id: req.params.id }, req.user?.collegeId);
  const book = await Book.findOne(scopedFilter);

  if (!book) {
    return next(new AppError('Book not found', 404));
  }

  res.json({ success: true, book: BookDTO.transform(book) });
});

// @desc    Get book availability
// @route   GET /api/books/:id/availability
// @access  Public
const getBookAvailability = asyncHandler(async (req, res, next) => {
  const scopedFilter = scopeToCollege({ _id: req.params.id }, req.user?.collegeId);
  const book = await Book.findOne(scopedFilter).select('totalCopies availableCopies');

  if (!book) {
    return next(new AppError('Book not found', 404));
  }

  res.json({ success: true, availability: book });
});

module.exports = {
  getBooks,
  getBookById,
  getBookAvailability,
};
