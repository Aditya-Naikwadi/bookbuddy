const Book = require('../models/Book');
const BookDTO = require('../dtos/BookDTO');
const AppError = require('../utils/AppError');
const asyncHandler = require('express-async-handler');
const { scopeToCollege } = require('../middlewares/scopeToCollege');

// @desc    Get all books with search, filter & pagination
// @route   GET /api/books
// @access  Public
const getBooks = asyncHandler(async (req, res) => {
  const pageSize = Math.max(1, Math.min(100, Number(req.query.limit) || 12));
  const page = Math.max(1, Number(req.query.page) || 1);

  const { search, category, format, available, yearFrom, yearTo, lang } = req.query;

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

  const count = await Book.countDocuments(scopedQuery);

  const books = await Book.find(scopedQuery)
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 });

  res.json({
    success: true,
    books: BookDTO.transformMany(books),
    page,
    pages: Math.ceil(count / pageSize),
    total: count,
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
