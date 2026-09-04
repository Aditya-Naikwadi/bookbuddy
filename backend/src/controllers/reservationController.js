const asyncHandler = require('../utils/asyncHandler');
const Reservation = require('../models/Reservation');
const ReservationDTO = require('../dtos/ReservationDTO');
const AppError = require('../utils/AppError');
const { joinQueue, leaveQueue } = require('../services/reservationService');

// @desc    Join reservation queue
// @route   POST /api/reservations
// @access  Private
const joinQueueHandler = asyncHandler(async (req, res) => {
  const { bookId } = req.body;
  const reservation = await joinQueue(req.user.id, bookId, req.user.collegeId);
  res.json({ success: true, data: ReservationDTO.transform(reservation) });
});

// @desc    Get my reservations
// @route   GET /api/reservations/me
// @access  Private
const getMyReservations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await Reservation.countDocuments({ userId: req.user.id });
  const reservations = await Reservation.find({ userId: req.user.id })
    .populate('bookId', 'title author coverImage')
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  res.json({
    success: true,
    data: ReservationDTO.transformMany(reservations),
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
  const reservationDoc = await Reservation.findById(req.params.id);
  const currentUserId = (req.user.id || req.user._id).toString();

  if (!reservationDoc || reservationDoc.userId.toString() !== currentUserId) {
    throw new AppError('Reservation not found.', 404);
  }

  const reservation = await leaveQueue(req.params.id, currentUserId);
  res.json({ success: true, data: reservation });
});

module.exports = {
  joinQueueHandler,
  getMyReservations,
  leaveQueueHandler,
};
