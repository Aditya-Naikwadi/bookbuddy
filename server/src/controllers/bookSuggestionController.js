const asyncHandler = require('express-async-handler');
const BookSuggestion = require('../models/BookSuggestion');

// @desc    Suggest a book
// @route   POST /api/book-suggestions
// @access  Private
const suggestBook = asyncHandler(async (req, res) => {
  const { title, author, isbn, reason } = req.body;

  const suggestion = await BookSuggestion.create({
    userId: req.user._id,
    title,
    author,
    isbn,
    reason,
    upvotedBy: [req.user._id],
  });

  res.status(201).json({ success: true, data: suggestion });
});

// @desc    Get all suggestions
// @route   GET /api/book-suggestions
// @access  Private
const getSuggestions = asyncHandler(async (req, res) => {
  const suggestions = await BookSuggestion.find({})
    .sort({ upvotes: -1 })
    .populate('userId', 'name');
  res.json({ success: true, data: suggestions });
});

// @desc    Upvote a suggestion
// @route   POST /api/book-suggestions/:id/upvote
// @access  Private
const upvoteSuggestion = asyncHandler(async (req, res) => {
  const suggestion = await BookSuggestion.findById(req.params.id);

  if (!suggestion) {
    res.status(404);
    throw new Error('Suggestion not found');
  }

  if (suggestion.upvotedBy.includes(req.user._id)) {
    res.status(400);
    throw new Error('You already upvoted this suggestion');
  }

  suggestion.upvotes += 1;
  suggestion.upvotedBy.push(req.user._id);
  await suggestion.save();

  res.json({ success: true, data: suggestion });
});

module.exports = { suggestBook, getSuggestions, upvoteSuggestion };
