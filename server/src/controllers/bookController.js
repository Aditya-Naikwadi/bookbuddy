const Book = require('../models/Book');
const asyncHandler = require('express-async-handler');

// @desc    Get all books with search, filter & pagination
// @route   GET /api/books
// @access  Public
const getBooks = asyncHandler(async (req, res) => {
  const pageSize = Number(req.query.limit) || 12;
  const page = Number(req.query.page) || 1;

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
    books,
    page,
    pages: Math.ceil(count / pageSize),
    total: count,
  });
});

// @desc    Get book by ID
// @route   GET /api/books/:id
// @access  Public
const getBookById = asyncHandler(async (req, res) => {
  const book = await Book.findOne({ _id: req.params.id, ...req.tenantFilter });

  if (book) {
    res.json({ success: true, book });
  } else {
    res.status(404);
    throw new Error('Book not found');
  }
});

// @desc    Get book availability
// @route   GET /api/books/:id/availability
// @access  Public
const getBookAvailability = asyncHandler(async (req, res) => {
  const book = await Book.findOne({ _id: req.params.id, ...req.tenantFilter }).select('totalCopies availableCopies');

  if (book) {
    res.json({ success: true, availability: book });
  } else {
    res.status(404);
    throw new Error('Book not found');
  }
});

module.exports = {
  getBooks,
  getBookById,
  getBookAvailability,
};
