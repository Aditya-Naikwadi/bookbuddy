const asyncHandler = require('../utils/asyncHandler');
const Book = require('../models/Book');

// @desc    Get my recommendations
// @route   GET /api/recommendations/me
// @access  Private
const getMyRecommendations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // In a real app, this would use a recommendation engine or collaborative filtering
  // For now, we'll return recently published books matching the user's major/department
  // Or just some random available books if we don't have enough data

  const query = {};

  if (req.user.major) {
    query.category = { $in: [req.user.major] };
  }

  let total = await Book.countDocuments(query);
  let books = await Book.find(query).sort('-publishedYear').skip(skip).limit(limit);

  if (books.length === 0) {
    // fallback
    total = await Book.countDocuments();
    books = await Book.find().sort('-publishedYear').skip(skip).limit(limit);
  }

  res.json({
    success: true,
    data: books,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

module.exports = {
  getMyRecommendations,
};
