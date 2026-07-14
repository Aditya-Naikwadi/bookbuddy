const asyncHandler = require('../utils/asyncHandler');
const Reservation = require('../models/Reservation');
const { joinQueue, leaveQueue } = require('../services/reservationService');

// @desc    Join reservation queue
// @route   POST /api/reservations
// @access  Private
const joinQueueHandler = asyncHandler(async (req, res) => {
  const { bookId } = req.body;
  const reservation = await joinQueue(req.user._id, bookId);
  res.json({ success: true, data: reservation });
});

// @desc    Get my reservations
// @route   GET /api/reservations/me
// @access  Private
const getMyReservations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await Reservation.countDocuments({ userId: req.user._id });
  const reservations = await Reservation.find({ userId: req.user._id })
    .populate('bookId', 'title author coverImage')
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  res.json({
    success: true,
    data: reservations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// @desc    Leave reservation queue
// @route   DELETE /api/reservations/:id
// @access  Private
const leaveQueueHandler = asyncHandler(async (req, res) => {
  const reservation = await leaveQueue(req.params.id, req.user._id);
  res.json({ success: true, data: reservation });
});

module.exports = {
  joinQueueHandler,
  getMyReservations,
  leaveQueueHandler,
};
