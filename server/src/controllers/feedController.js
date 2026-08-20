const asyncHandler = require('../utils/asyncHandler');
const FeedPost = require('../models/FeedPost');
const AppError = require('../utils/AppError');

// @desc    Create a new feed post (Announcement or Event)
// @route   POST /api/v1/feed OR POST /api/feed
// @access  Private (College Admin only)
const createFeedPost = asyncHandler(async (req, res) => {
  // Role check: Only college-admin (or super-admin) allowed
  const allowedRoles = ['college-admin', 'college_admin', 'super-admin'];
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    throw new AppError('Forbidden: Only college admins can create feed posts', 403);
  }

  const { type, title, body, eventDate, audience, publishAt, expiresAt } = req.body;

  if (!type || !['announcement', 'event'].includes(type)) {
    throw new AppError('Post type must be either announcement or event', 400);
  }

  if (!title || !body) {
    throw new AppError('Title and body are required', 400);
  }

  // SECURITY: collegeId MUST always come from req.user.collegeId, NEVER from req.body
  const collegeId = req.user.collegeId;
  if (!collegeId) {
    throw new AppError('User is not associated with any college', 400);
  }

  const postData = {
    collegeId, // Enforce server's req.user.collegeId
    type,
    title,
    body,
    authorId: req.user.id || req.user._id,
    eventDate: type === 'event' && eventDate ? new Date(eventDate) : null,
    audience: Array.isArray(audience) ? audience : ['student', 'college-admin', 'general'],
    publishAt: publishAt ? new Date(publishAt) : new Date(),
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  };

  const feedPost = await FeedPost.create(postData);

  // Socket.io broadcast on post creation (college room scoped)
  try {
    const socketModule = require('../sockets');
    const io =
      (req.app && typeof req.app.get === 'function' ? req.app.get('io') : null) ||
      (socketModule && typeof socketModule.getIO === 'function' ? socketModule.getIO() : null);
    if (io) {
      io.to(`college:${collegeId}`).emit('feed:new', feedPost);
    }
  } catch (socketErr) {
    // Non-blocking socket emission fallback
  }

  res.status(201).json({
    success: true,
    data: feedPost,
  });
});

// @desc    Get feed posts for requesting user's college (tenant, audience, and expiry filtered)
// @route   GET /api/v1/feed OR GET /api/feed
// @access  Private
const getFeedPosts = asyncHandler(async (req, res) => {
  const { type, limit = 20, page = 1 } = req.query;
  const numLimit = Math.max(1, parseInt(limit, 10) || 20);
  const numPage = Math.max(1, parseInt(page, 10) || 1);
  const skip = (numPage - 1) * numLimit;
  const now = new Date();

  // Role mapping for audience filtering
  const userRole = req.user?.role || 'student';
  const roleAliases = [userRole];
  if (['college-admin', 'college_admin', 'super-admin'].includes(userRole)) {
    roleAliases.push('admin', 'college-admin', 'college_admin');
  }

  const query = {
    collegeId: req.user.collegeId,
    $and: [
      // Expiry filter: expiresAt must be in the future OR null
      {
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      },
      // Publish filter: publishAt must be in the past/now OR null
      {
        $or: [{ publishAt: null }, { publishAt: { $lte: now } }],
      },
      // Audience filter: audience array includes requester's role OR is empty
      {
        $or: [{ audience: { $size: 0 } }, { audience: { $in: roleAliases } }],
      },
    ],
  };

  if (type && ['announcement', 'event'].includes(type)) {
    query.type = type;
  }

  const total = await FeedPost.countDocuments(query);
  const posts = await FeedPost.find(query)
    .populate('authorId', 'name avatar role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(numLimit);

  res.json({
    success: true,
    data: posts,
    pagination: {
      page: numPage,
      limit: numLimit,
      total,
      totalPages: Math.ceil(total / numLimit) || 1,
    },
  });
});

// @desc    RSVP to an event feed post (Toggle ON/OFF)
// @route   POST /api/v1/feed/:id/rsvp OR POST /api/feed/:id/rsvp
// @access  Private
const rsvpEvent = asyncHandler(async (req, res) => {
  const post = await FeedPost.findOne({
    _id: req.params.id,
    collegeId: req.user.collegeId,
  });

  if (!post) {
    throw new AppError('Feed post not found', 404);
  }

  // Acceptance Criteria: Returns 400 if target post's type isn't 'event'
  if (post.type !== 'event') {
    throw new AppError('RSVP is only allowed for event-type posts', 400);
  }

  const userIdObj = req.user.id || req.user._id;
  const existingIndex = post.rsvps.findIndex(
    (r) => r.userId && r.userId.toString() === userIdObj.toString()
  );

  let isRsvped = false;
  if (existingIndex !== -1) {
    // Toggle OFF: Remove user from RSVPs
    post.rsvps.splice(existingIndex, 1);
    isRsvped = false;
  } else {
    // Toggle ON: Add user to RSVPs
    post.rsvps.push({ userId: userIdObj, respondedAt: new Date() });
    isRsvped = true;
  }

  await post.save();

  res.json({
    success: true,
    isRsvped,
    data: post,
  });
});

module.exports = {
  createFeedPost,
  getFeedPosts,
  rsvpEvent,
};
