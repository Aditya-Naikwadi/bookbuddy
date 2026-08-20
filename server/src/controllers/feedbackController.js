const asyncHandler = require('express-async-handler');
const Feedback = require('../models/Feedback');
const { scopeToCollege } = require('../middlewares/scopeToCollege');

// @desc    Submit feedback
// @route   POST /api/feedback
// @access  Private
const submitFeedback = asyncHandler(async (req, res) => {
  const { rating, category, comment, message } = req.body;

  const feedback = await Feedback.create({
    collegeId: req.user.collegeId,
    submittedBy: req.user._id,
    rating,
    category,
    message: message || comment,
  });

  res.status(201).json({ success: true, data: feedback });
});

// @desc    Get all feedback
// @route   GET /api/feedback
// @access  Private/Admin
const getFeedback = asyncHandler(async (req, res) => {
  const scopedFilter = scopeToCollege({}, req.user?.collegeId);
  const feedback = await Feedback.find(scopedFilter)
    .sort({ createdAt: -1 })
    .populate('submittedBy', 'name email');
  res.json({ success: true, data: feedback });
});

module.exports = { submitFeedback, getFeedback };
