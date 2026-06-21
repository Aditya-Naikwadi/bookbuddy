const asyncHandler = require('express-async-handler');
const Feedback = require('../models/Feedback');

// @desc    Submit feedback
// @route   POST /api/feedback
// @access  Private
const submitFeedback = asyncHandler(async (req, res) => {
  const { rating, category, comment, isAnonymous } = req.body;
  
  const feedback = await Feedback.create({
    userId: isAnonymous ? null : req.user._id,
    rating,
    category,
    comment,
    isAnonymous
  });

  res.status(201).json({ success: true, data: feedback });
});

// @desc    Get all feedback
// @route   GET /api/feedback
// @access  Private/Admin
const getFeedback = asyncHandler(async (req, res) => {
  const feedback = await Feedback.find({}).sort({ createdAt: -1 }).populate('userId', 'name email');
  res.json({ success: true, data: feedback });
});

module.exports = { submitFeedback, getFeedback };
