const asyncHandler = require('express-async-handler');
const googleBooksService = require('../services/googleBooksService');
const Book = require('../models/Book');
const College = require('../models/College');

// @desc    Search live Google Books catalog
// @route   GET /api/google-books/search
// @access  Public
const searchGoogleBooks = asyncHandler(async (req, res) => {
  const { search = 'computer science', category, page = 1, limit = 12 } = req.query;
  const result = await googleBooksService.searchBooks({ search, category, page, limit });
  res.json({ success: true, data: result });
});

// @desc    Get Google Book Volume Detail
// @route   GET /api/google-books/volume/:id
// @access  Public
const getGoogleBookById = asyncHandler(async (req, res) => {
  const book = await googleBooksService.getBookById(req.params.id);
  res.json({ success: true, data: book });
});

// @desc    Import a Google Book into BookBuddy database catalog
// @route   POST /api/google-books/import
// @access  Private
const importGoogleBook = asyncHandler(async (req, res) => {
  const { volumeId } = req.body;
  if (!volumeId) {
    res.status(400);
    throw new Error('volumeId is required');
  }

  const bookData = await googleBooksService.getBookById(volumeId);

  // Target collegeId from user or fallback to first college in DB
  let collegeId = req.user?.collegeId;
  if (!collegeId) {
    const firstCollege = await College.findOne({});
    collegeId = firstCollege?._id;
  }

  if (!collegeId) {
    res.status(400);
    throw new Error('College context is required to import books');
  }

  // Check if book already imported
  let existing = await Book.findOne({
    $or: [{ isbn: bookData.isbn }, { title: bookData.title, author: bookData.author }],
  });

  if (existing) {
    return res.json({
      success: true,
      message: 'Book already exists in catalog',
      book: existing,
    });
  }

  const newBook = await Book.create({
    collegeId,
    isbn: bookData.isbn,
    title: bookData.title,
    author: bookData.author,
    category: bookData.category || 'General',
    format: 'digital',
    copiesTotal: 5,
    copiesAvailable: 5,
    shelfLocation: 'Digital Shelf / Google Books',
  });

  res.status(201).json({
    success: true,
    message: 'Book successfully imported from Google Books API',
    book: newBook,
  });
});

// @desc    Trigger seeding of Google Books into database catalog
// @route   POST /api/google-books/seed
// @access  Private (Admin)
const seedGoogleBooks = asyncHandler(async (req, res) => {
  const topics = req.body.topics || [
    'Computer Science',
    'Artificial Intelligence',
    'Physics',
    'Mathematics',
    'Biology',
    'Data Science',
    'Software Engineering',
  ];

  let collegeId = req.user?.collegeId;
  if (!collegeId) {
    const college = await College.findOne({});
    collegeId = college?._id;
  }

  const result = await googleBooksService.seedBooksToDatabase(topics, collegeId);

  res.json({
    success: true,
    message: `Seeded ${result.seededCount} new books from Google Books API (${result.skippedCount} existing skipped)`,
    data: result,
  });
});

module.exports = {
  searchGoogleBooks,
  getGoogleBookById,
  importGoogleBook,
  seedGoogleBooks,
};
