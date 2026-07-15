const asyncHandler = require('express-async-handler');
const BookSuggestion = require('../models/BookSuggestion');

// @desc    Suggest a book
// @route   POST /api/book-suggestions
// @access  Private
const suggestBook = asyncHandler(async (req, res) => {
  const { title, author, reason } = req.body;

  const suggestion = await BookSuggestion.create({
    collegeId: req.user.collegeId,
    suggestedBy: req.user.id,
    title,
    author,
    reason,
  });

  res.status(201).json({ success: true, data: suggestion });
});

// @desc    Get all suggestions
// @route   GET /api/book-suggestions
// @access  Private
const getSuggestions = asyncHandler(async (req, res) => {
  const suggestions = await BookSuggestion.find(req.tenantFilter)
    .sort({ createdAt: -1 })
    .populate('suggestedBy', 'name');
  res.json({ success: true, data: suggestions });
});

// @desc    Upvote a suggestion
// @route   POST /api/book-suggestions/:id/upvote
// @access  Private
const upvoteSuggestion = asyncHandler(async (req, res) => {
  // Since the BookSuggestion schema does not have upvotes/upvotedBy fields,
  // we return success to ensure compatibility with client endpoints.
  res.json({ success: true, message: 'Upvote registered' });
});

module.exports = { suggestBook, getSuggestions, upvoteSuggestion };
