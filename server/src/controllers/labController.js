const asyncHandler = require('express-async-handler');
const LabSeat = require('../models/LabSeat');
const LabBooking = require('../models/LabBooking');
const labBookingService = require('../services/labBookingService');
const { recordQualifyingAction } = require('../services/streakService');
const events = require('../sockets/events');

// @desc    Get all lab seats
// @route   GET /api/lab/seats
// @access  Private
const getSeats = asyncHandler(async (req, res) => {
  const seats = await LabSeat.find({});
  res.json({ success: true, data: seats });
});

// @desc    Book a lab seat
// @route   POST /api/lab/bookings
// @access  Private
const createBooking = asyncHandler(async (req, res) => {
  const { seatId, startTime, endTime } = req.body;

  const result = await labBookingService.createBooking(
    req.user.id,
    seatId,
    req.user.collegeId,
    startTime,
    endTime
  );

  if (result.streakData && req.app.get('io')) {
    req.app.get('io').to(`user:${req.user.id}`).emit(events.STREAK_UPDATED, result.streakData);
  }

  res.status(201).json({ success: true, data: result.booking });
});

// @desc    Get my bookings
// @route   GET /api/lab/bookings/me
// @access  Private
const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await LabBooking.find({ userId: req.user._id }).populate('seatId');
  res.json({ success: true, data: bookings });
});

// @desc    Cancel a booking
// @route   DELETE /api/lab/bookings/:id
// @access  Private
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await LabBooking.findOne({ _id: req.params.id, userId: req.user._id });
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  booking.status = 'cancelled';
  await booking.save();
  res.json({ success: true, message: 'Booking cancelled' });
});

module.exports = { getSeats, createBooking, getMyBookings, cancelBooking };
