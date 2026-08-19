const Book = require('../models/Book');
const BookDTO = require('../dtos/BookDTO');
const AppError = require('../utils/AppError');
const asyncHandler = require('express-async-handler');

// @desc    Get all books with search, filter & pagination
// @route   GET /api/books
// @access  Public
const getBooks = asyncHandler(async (req, res) => {
  const pageSize = Math.max(1, Math.min(100, Number(req.query.limit) || 12));
  const page = Math.max(1, Number(req.query.page) || 1);

  const { search, category, format, available, yearFrom, yearTo, lang } = req.query;

  let query = { ...req.tenantFilter };

  if (search) {
    query.$text = { $search: search };
  }

  if (category) {
    // allow comma separated categories
    query.category = { $in: category.split(',') };
  }

  if (format) {
    query.format = format;
  }

  if (available === 'true') {
    query.availableCopies = { $gt: 0 };
  }

  if (yearFrom || yearTo) {
    query.publishedYear = {};
    if (yearFrom) query.publishedYear.$gte = Number(yearFrom);
    if (yearTo) query.publishedYear.$lte = Number(yearTo);
  }

  if (lang) {
    query.language = lang;
  }

  const count = await Book.countDocuments(query);

  const books = await Book.find(query)
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
  const book = await Book.findOne({ _id: req.params.id, ...req.tenantFilter });

  if (!book) {
    return next(new AppError('Book not found', 404));
  }

  res.json({ success: true, book: BookDTO.transform(book) });
});

// @desc    Get book availability
// @route   GET /api/books/:id/availability
// @access  Public
const getBookAvailability = asyncHandler(async (req, res, next) => {
  const book = await Book.findOne({ _id: req.params.id, ...req.tenantFilter }).select(
    'totalCopies availableCopies'
  );

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
