const express = require('express');
const router = express.Router();
const { createFeedPost, getFeedPosts, rsvpEvent } = require('../controllers/feedController');
const { protect, requireRole } = require('../middlewares/auth');

// @desc    Get feed posts for user's college
// @route   GET /api/v1/feed OR GET /api/feed
// @access  Private
router.get('/', protect, getFeedPosts);

// @desc    Create a new feed post (Announcement or Event)
// @route   POST /api/v1/feed OR POST /api/feed
// @access  Private (College Admin only)
router.post(
  '/',
  protect,
  requireRole('college-admin', 'college_admin', 'super-admin'),
  createFeedPost
);

// @desc    RSVP to an event post
// @route   POST /api/v1/feed/:id/rsvp OR POST /api/feed/:id/rsvp
// @access  Private
router.post('/:id/rsvp', protect, rsvpEvent);

module.exports = router;
