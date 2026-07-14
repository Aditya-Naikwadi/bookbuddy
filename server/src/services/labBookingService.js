const LabSeat = require('../models/LabSeat');
const LabBooking = require('../models/LabBooking');
const AppError = require('../utils/AppError');
const config = require('../config');
const { recordQualifyingAction } = require('./streakService');

/**
 * Helper to normalize a Date to UTC midnight
 */
const normalizeToUTCMidnight = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/**
 * Returns seats with their booked/free slots for that day (tenant-scoped)
 */
const getAvailability = async (collegeId, labName, dateStr) => {
  const date = normalizeToUTCMidnight(dateStr);

  // 1. Fetch all seats for the given college & lab name that are operational
  const seats = await LabSeat.find({
    collegeId,
    labName,
    maintenanceStatus: 'operational',
  });

  // 2. Fetch all booked reservations for these seats on this specific date
  const bookings = await LabBooking.find({
    collegeId,
    seatId: { $in: seats.map((s) => s._id) },
    date,
    status: 'booked',
  });

  // 3. For each seat, map the hourly slots defined by operating hours config
  const { startHour, endHour } = config.labOperatingHours;

  const results = seats.map((seat) => {
    const slots = [];
    for (let h = startHour; h < endHour; h++) {
      const slotStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, 0, 0, 0));
      const slotEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h + 1, 0, 0, 0));

      const isBooked = bookings.some(
        (b) =>
          b.seatId.toString() === seat._id.toString() &&
          b.startTime.getTime() === slotStart.getTime()
      );

      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        isAvailable: !isBooked,
      });
    }

    return {
      seat,
      slots,
    };
  });

  return results;
};

/**
 * Creates a slot reservation with collision safety
 */
const createBooking = async (userId, seatId, collegeId, startTimeInput, endTimeInput) => {
  const startTime = new Date(startTimeInput);
  const endTime = new Date(endTimeInput);

  // Validate start < end
  if (startTime.getTime() >= endTime.getTime()) {
    throw new AppError('Start time must be before end time.', 400);
  }

  // Validate duration is exactly 1 hour
  const durationMs = endTime.getTime() - startTime.getTime();
  if (durationMs !== 60 * 60 * 1000) {
    throw new AppError('Bookings must be made in exactly 1-hour slots.', 400);
  }

  // Validate starts on the hour
  if (startTime.getUTCMinutes() !== 0 || startTime.getUTCSeconds() !== 0 || startTime.getUTCMilliseconds() !== 0) {
    throw new AppError('Bookings must align with the start of the hour.', 400);
  }

  // Validate within operating hours
  const startHour = startTime.getUTCHours();
  const endHour = endTime.getUTCHours();
  if (startHour < config.labOperatingHours.startHour || endHour > config.labOperatingHours.endHour) {
    throw new AppError('Booking falls outside of lab operating hours.', 400);
  }

  // Normalize date to UTC midnight
  const date = normalizeToUTCMidnight(startTime);

  // Retrieve and verify seat
  const seat = await LabSeat.findOne({ _id: seatId, collegeId });
  if (!seat) {
    throw new AppError('Lab seat not found.', 404);
  }

  if (seat.maintenanceStatus !== 'operational') {
    throw new AppError('This seat is currently unavailable (maintenance/retired).', 400);
  }

  try {
    const booking = await LabBooking.create({
      collegeId,
      userId,
      seatId,
      date,
      startTime,
      endTime,
      status: 'booked',
    });

    // Record streak action
    let streakData = null;
    try {
      streakData = await recordQualifyingAction(userId, 'lab_booking');
    } catch (err) {
      // Don't fail the booking if streak service fails
    }

    return { booking, streakData };
  } catch (error) {
    // Catch MongoDB duplicate key error (code 11000)
    if (error.code === 11000) {
      throw new AppError('slot already booked', 409);
    }
    throw error;
  }
};

/**
 * Cancels a booking, verifying ownership or admin status
 */
const cancelBooking = async (bookingId, userId, role) => {
  const booking = await LabBooking.findById(bookingId);
  if (!booking) {
    throw new AppError('Lab booking not found.', 404);
  }

  const isAdmin = ['college-admin', 'admin', 'librarian'].includes(role);
  if (!isAdmin && booking.userId.toString() !== userId.toString()) {
    throw new AppError('You do not have permission to cancel this booking.', 403);
  }

  booking.status = 'cancelled';
  await booking.save();
  return booking;
};

module.exports = {
  getAvailability,
  createBooking,
  cancelBooking,
  normalizeToUTCMidnight,
};
