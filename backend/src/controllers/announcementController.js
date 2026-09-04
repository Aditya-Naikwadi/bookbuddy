const asyncHandler = require('../utils/asyncHandler');
const Announcement = require('../models/Announcement');
const AppError = require('../utils/AppError');

// @desc    Get announcements & events
// @route   GET /api/v1/announcements
// @access  Private
const getAnnouncements = asyncHandler(async (req, res) => {
  const { category, isEvent } = req.query;

  const query = {
    $or: [{ collegeId: req.user.collegeId }, { collegeId: null }],
    isActive: true,
  };

  if (category) query.category = category;
  if (isEvent === 'true') query.isEvent = true;

  const announcements = await Announcement.find(query)
    .populate('createdBy', 'name')
    .sort('-startDate');

  const formatted = announcements.map((a) => {
    const isRsvp = a.rsvpUsers.some((u) => u.userId.toString() === req.user.id.toString());
    return {
      ...a.toObject(),
      userHasRSVPd: isRsvp,
      currentRSVPCount: a.rsvpUsers.length,
    };
  });

  res.json({
    success: true,
    data: formatted,
  });
});

// @desc    Toggle RSVP for a campus library event
// @route   POST /api/v1/announcements/:id/rsvp
// @access  Private
const toggleRSVP = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);

  if (!announcement) {
    throw new AppError('Announcement/Event not found', 404);
  }

  if (!announcement.isEvent) {
    throw new AppError('This announcement is not an interactive event', 400);
  }

  const userIdStr = req.user.id.toString();
  const existingIdx = announcement.rsvpUsers.findIndex((u) => u.userId.toString() === userIdStr);

  let hasRSVPd;

  if (existingIdx > -1) {
    announcement.rsvpUsers.splice(existingIdx, 1);
    hasRSVPd = false;
  } else {
    if (announcement.maxCapacity > 0 && announcement.rsvpUsers.length >= announcement.maxCapacity) {
      throw new AppError('Event has reached maximum capacity', 400);
    }
    announcement.rsvpUsers.push({ userId: req.user.id, rsvpAt: new Date() });
    hasRSVPd = true;
  }

  await announcement.save();

  res.json({
    success: true,
    data: {
      hasRSVPd,
      currentRSVPCount: announcement.rsvpUsers.length,
      maxCapacity: announcement.maxCapacity,
    },
  });
});

module.exports = {
  getAnnouncements,
  toggleRSVP,
};
