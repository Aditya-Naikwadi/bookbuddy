const asyncHandler = require('../utils/asyncHandler');
const Book = require('../models/Book');
const WatchRequest = require('../models/WatchRequest');
const AppError = require('../utils/AppError');

// @desc    Watch a book for availability notifications when out of stock
// @route   POST /api/books/:id/watch OR POST /api/v1/books/:id/watch
// @access  Private
const watchBook = asyncHandler(async (req, res) => {
  const bookId = req.params.id;

  const book = await Book.findById(bookId);
  if (!book) {
    throw new AppError('Book not found', 404);
  }

  // Reject with 400 if the book currently has available copies
  if (book.copiesAvailable > 0) {
    throw new AppError(
      'Book currently has available copies. Please borrow the book instead of requesting an availability notification.',
      400
    );
  }

  const watchRequest = await WatchRequest.createWatch({
    userId: req.user.id || req.user._id,
    bookId: book._id,
    collegeId: req.user.collegeId || book.collegeId,
  });

  res.status(201).json({
    success: true,
    message: 'Book watch request registered successfully.',
    data: watchRequest,
  });
});

// @desc    Remove a watch request for a book
// @route   DELETE /api/books/:id/watch OR DELETE /api/v1/books/:id/watch
// @access  Private
const unwatchBook = asyncHandler(async (req, res) => {
  const bookId = req.params.id;

  await WatchRequest.findOneAndDelete({
    userId: req.user.id || req.user._id,
    bookId,
  });

  res.json({
    success: true,
    message: 'Book watch request removed successfully.',
  });
});

// @desc    Get watch status for a book for current user
// @route   GET /api/books/:id/watch OR GET /api/v1/books/:id/watch
// @access  Private
const getWatchStatus = asyncHandler(async (req, res) => {
  const bookId = req.params.id;

  const watch = await WatchRequest.findOne({
    userId: req.user.id || req.user._id,
    bookId,
  });

  res.json({
    success: true,
    isWatching: !!watch,
  });
});

module.exports = {
  watchBook,
  unwatchBook,
  getWatchStatus,
};
