const LabSeat = require('../models/LabSeat');
const LabBooking = require('../models/LabBooking');
const AppError = require('../utils/AppError');
const config = require('../config');
const { recordQualifyingAction } = require('./streakService');
const { runInTransaction } = require('../utils/transactionHelper');

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
      const slotStart = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, 0, 0, 0)
      );
      const slotEnd = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h + 1, 0, 0, 0)
      );

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

const { DateTime } = require('luxon');
const College = require('../models/College');

/**
 * Helper to get the start (Monday 00:00) and end (Sunday 23:59) of the current calendar week
 * computed in the College's local timezone (falling back to UTC).
 */
const getCollegeTimezoneWeekRange = (collegeTimezone = 'UTC', referenceDate = new Date()) => {
  try {
    const zone = collegeTimezone || 'UTC';
    const dt = DateTime.fromJSDate(referenceDate).setZone(zone);
    const monday = dt.startOf('week'); // Luxon ISO week starts Monday 00:00:00.000 in local timezone
    const sunday = dt.endOf('week'); // Luxon ISO week ends Sunday 23:59:59.999 in local timezone
    return {
      monday: monday.toJSDate(),
      sunday: sunday.toJSDate(),
    };
  } catch {
    const d = new Date(referenceDate);
    const day = d.getUTCDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday, 0, 0, 0, 0)
    );
    const sunday = new Date(
      Date.UTC(
        monday.getUTCFullYear(),
        monday.getUTCMonth(),
        monday.getUTCDate() + 6,
        23,
        59,
        59,
        999
      )
    );
    return { monday, sunday };
  }
};

const getCollegeWeekRange = (referenceDate = new Date(), timezone = 'UTC') => {
  return getCollegeTimezoneWeekRange(timezone, referenceDate);
};

/**
 * Validates that the requested slot does not exceed the booking horizon (default: 7 days in advance).
 */
const checkBookingHorizon = (startTime, maxDays = 7, referenceNow = new Date()) => {
  const now = referenceNow;
  const start = new Date(startTime);
  const maxFutureMs = maxDays * 24 * 60 * 60 * 1000;
  if (start.getTime() > now.getTime() + maxFutureMs) {
    throw new AppError(
      `Advance booking limit exceeded. You can only book slots up to ${maxDays} days in advance.`,
      400
    );
  }
};

/**
 * Checks rolling 14-day window for no-show strikes.
 * 3 no-shows within 14 days triggers a 48-hour booking suspension.
 */
const checkNoShowSuspension = async (
  userId,
  collegeId,
  session = null,
  referenceNow = new Date()
) => {
  const now = referenceNow;
  let rollingDays = 14;
  let maxStrikes = 3;
  let suspensionHours = 48;

  if (collegeId) {
    const college = await College.findById(collegeId).select('facilitySettings').lean();
    if (college?.facilitySettings) {
      if (college.facilitySettings.noShowPenaltyWindowDays) {
        rollingDays = college.facilitySettings.noShowPenaltyWindowDays;
      }
      if (college.facilitySettings.noShowMaxStrikes) {
        maxStrikes = college.facilitySettings.noShowMaxStrikes;
      }
      if (college.facilitySettings.noShowSuspensionHours) {
        suspensionHours = college.facilitySettings.noShowSuspensionHours;
      }
    }
  }

  const windowCutoff = new Date(now.getTime() - rollingDays * 24 * 60 * 60 * 1000);

  const query = LabBooking.find({
    userId,
    collegeId,
    status: 'no_show',
    $or: [{ updatedAt: { $gte: windowCutoff } }, { createdAt: { $gte: windowCutoff } }],
  }).sort({ updatedAt: -1, createdAt: -1 });

  if (session) {
    query.session(session);
  }

  const noShows = await query;
  if (noShows.length >= maxStrikes) {
    const mostRecentNoShow = noShows[0];
    const strikeTime = new Date(
      mostRecentNoShow.updatedAt || mostRecentNoShow.createdAt || mostRecentNoShow.startTime
    ).getTime();
    const suspensionEnd = strikeTime + suspensionHours * 60 * 60 * 1000;

    if (now.getTime() < suspensionEnd) {
      const remainingHours = Math.ceil((suspensionEnd - now.getTime()) / (1000 * 60 * 60));
      const err = new AppError(
        `Booking privileges temporarily suspended due to ${noShows.length} no-show strikes in the last ${rollingDays} days. Suspension lifts in ${remainingHours} hour(s).`,
        403
      );
      err.statusCode = 403;
      throw err;
    }
  }
};

/**
 * Checks if the student has exceeded their 12-hour weekly cap for a specific resource type
 * calculated in the College's local timezone.
 */
const checkWeeklyQuota = async (
  userId,
  collegeId,
  resourceType,
  requestedHours = 1,
  session = null
) => {
  let timezone = 'UTC';
  let maxWeeklyHours = config.labMaxWeeklyHours || 12;

  if (collegeId) {
    const college = await College.findById(collegeId).select('timezone facilitySettings').lean();
    if (college?.timezone) {
      timezone = college.timezone;
    }
    if (college?.facilitySettings?.maxWeeklyHours) {
      maxWeeklyHours = college.facilitySettings.maxWeeklyHours;
    }
  }

  const { monday, sunday } = getCollegeTimezoneWeekRange(timezone, new Date());

  const query = LabBooking.find({
    userId,
    collegeId,
    resourceType,
    status: { $in: ['booked', 'no_show', 'completed'] },
    startTime: { $gte: monday, $lte: sunday },
  });

  if (session) {
    query.session(session);
  }

  const activeBookings = await query;

  // Calculate total booked duration in hours
  const totalBookedMs = activeBookings.reduce((sum, b) => {
    return sum + (new Date(b.endTime).getTime() - new Date(b.startTime).getTime());
  }, 0);

  const totalBookedHours = totalBookedMs / (1000 * 60 * 60);

  if (totalBookedHours + requestedHours > maxWeeklyHours) {
    throw new AppError(
      `Weekly limit reached. You have utilized ${totalBookedHours.toFixed(1)}/12.0 hours for ${resourceType.replace('_', ' ')}s this week.`,
      400
    );
  }

  return { totalBookedHours, maxWeeklyHours };
};

/**
 * Creates a slot reservation with collision safety & quota verification
 */
const createBooking = async (userId, seatId, collegeId, startTimeInput, endTimeInput) => {
  return await runInTransaction(async (session) => {
    const startTime = new Date(startTimeInput);
    const endTime = new Date(endTimeInput);

    // Validate 7-day advance booking horizon
    checkBookingHorizon(startTime, config.labBookingHorizonDays || 7);

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
    if (
      startTime.getUTCMinutes() !== 0 ||
      startTime.getUTCSeconds() !== 0 ||
      startTime.getUTCMilliseconds() !== 0
    ) {
      throw new AppError('Bookings must align with the start of the hour.', 400);
    }

    // Validate within operating hours
    const startHour = startTime.getUTCHours();
    const endHour = endTime.getUTCHours();
    if (
      startHour < config.labOperatingHours.startHour ||
      endHour > config.labOperatingHours.endHour
    ) {
      throw new AppError('Booking falls outside of lab operating hours.', 400);
    }

    // Check no-show 14-day 3-strike suspension
    await checkNoShowSuspension(userId, collegeId, session);

    // 1. Retrieve and verify seat
    const seat = await LabSeat.findOne({ _id: seatId, collegeId }).session(session);
    if (!seat) {
      throw new AppError('Lab seat not found.', 404);
    }

    if (seat.maintenanceStatus !== 'operational') {
      throw new AppError('This seat is currently unavailable (maintenance/retired).', 400);
    }

    if (seat.customOperatingHours?.isBlocked) {
      throw new AppError(
        `Seat unavailable: ${seat.customOperatingHours.blackoutReason || 'Reserved for institutional use'}.`,
        400
      );
    }

    // 2. Check student's weekly 12-hour quota for this resource type
    await checkWeeklyQuota(userId, collegeId, seat.resourceType || 'workstation', 1, session);

    // 3. Cross-seat same-user double-booking conflict check
    const userOverlap = await LabBooking.findOne({
      userId,
      status: 'booked',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    }).session(session);

    if (userOverlap) {
      const err = new AppError(
        'You already hold an active lab seat reservation during this overlapping time slot.',
        409
      );
      err.statusCode = 409;
      throw err;
    }

    // 4. Target seat availability conflict check
    const seatOverlap = await LabBooking.findOne({
      seatId,
      status: 'booked',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    }).session(session);

    if (seatOverlap) {
      const err = new AppError('slot already booked', 409);
      err.statusCode = 409;
      throw err;
    }

    // Normalize date to UTC midnight
    const date = normalizeToUTCMidnight(startTime);

    let booking;
    try {
      const created = await LabBooking.create(
        [
          {
            collegeId,
            userId,
            seatId,
            date,
            startTime,
            endTime,
            resourceType: seat.resourceType || 'workstation',
            status: 'booked',
          },
        ],
        { session }
      );
      booking = created[0];
    } catch (createErr) {
      if (createErr.code === 11000 || createErr.message?.includes('E11000')) {
        const err = new AppError('slot already booked', 409);
        err.statusCode = 409;
        throw err;
      }
      throw createErr;
    }

    // Record streak action
    let streakData = null;
    try {
      streakData = await recordQualifyingAction(userId, collegeId, 'lab_booking');
    } catch {
      // Don't fail the booking if streak service fails
    }

    // Generate signed verification token encoding bookingId & expiry for QR scan-in
    const { generatePatronToken } = require('../utils/patronTokenUtil');
    const tokenObj = generatePatronToken(userId, booking._id.toString());

    const bookingResult = booking.toObject ? booking.toObject() : { ...booking };
    bookingResult.verificationToken = tokenObj.token;
    bookingResult.tokenExpiresAt = tokenObj.expiresAt;

    return { booking: bookingResult, streakData };
  });
};

/**
 * Automatically cancels future active bookings for a seat when switched to maintenance/retired mode
 */
const handleSeatMaintenanceChange = async (seatId, newStatus, collegeId) => {
  if (newStatus !== 'maintenance' && newStatus !== 'retired') {
    return { cancelledCount: 0 };
  }

  const now = new Date();
  const activeBookings = await LabBooking.find({
    seatId,
    collegeId,
    status: 'booked',
    startTime: { $gte: now },
  }).populate('seatId');

  if (activeBookings.length === 0) {
    return { cancelledCount: 0 };
  }

  const notificationService = require('./notificationService');

  for (const b of activeBookings) {
    b.status = 'cancelled';
    await b.save();

    // Send cancellation notification to student
    try {
      await notificationService.notifyUser({
        userId: b.userId,
        collegeId,
        type: 'lab_booking_cancelled',
        title: 'Workstation Maintenance Cancellation',
        message: `Your booking for Seat ${b.seatId?.seatNumber || 'workstation'} on ${new Date(b.startTime).toLocaleDateString()} has been cancelled because the station was placed under maintenance.`,
      });
    } catch {
      // Continue even if notification fails
    }
  }

  return { cancelledCount: activeBookings.length };
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

/**
 * Student Check-In to a reserved lab timeslot (within 10-min grace period)
 */
const checkInBooking = async (bookingId, userId) => {
  const booking = await LabBooking.findById(bookingId).populate('seatId');
  if (!booking) {
    throw new AppError('Lab booking not found.', 404);
  }

  if (booking.userId.toString() !== userId.toString()) {
    throw new AppError('Unauthorized: This booking belongs to another student.', 403);
  }

  if (booking.status === 'cancelled') {
    throw new AppError('Cannot check in to a cancelled reservation.', 400);
  }

  if (booking.status === 'completed' || booking.checkedInAt) {
    return { booking, message: 'Already checked in.' };
  }

  const now = new Date();
  const startTime = new Date(booking.startTime);
  const graceWindowEnd = new Date(startTime.getTime() + 10 * 60 * 1000);
  const earlyCheckInWindow = new Date(startTime.getTime() - 15 * 60 * 1000);

  if (now < earlyCheckInWindow) {
    throw new AppError('Check-in opens 15 minutes prior to slot start.', 400);
  }

  if (now > graceWindowEnd) {
    booking.status = 'no_show';
    await booking.save();
    throw new AppError('Check-in grace period (10 minutes) has expired. Marked as no-show.', 400);
  }

  booking.checkedInAt = now;
  booking.status = 'completed';
  await booking.save();

  return { booking, message: 'Check-in confirmed successfully. Workstation unlocked.' };
};

/**
 * Sweeps un-checked-in slots past 10 minutes from slot start and auto-releases them as no-shows
 */
const autoReleaseNoShows = async (referenceNow = new Date()) => {
  const now = referenceNow;
  const graceCutoff = new Date(now.getTime() - 10 * 60 * 1000);

  const overdueBookings = await LabBooking.find({
    status: 'booked',
    $or: [{ checkedInAt: null }, { checkedInAt: { $exists: false } }],
    startTime: { $lt: graceCutoff },
  });

  if (overdueBookings.length === 0) {
    return 0;
  }

  const notificationService = require('./notificationService');
  let releasedCount = 0;

  for (const b of overdueBookings) {
    await LabBooking.updateOne({ _id: b._id }, { $set: { status: 'no_show' } });
    releasedCount++;

    try {
      await notificationService.notifyUser({
        userId: b.userId,
        collegeId: b.collegeId,
        type: 'lab_booking_noshow',
        title: 'Workstation Booking Released (No-Show)',
        message: `Your booking on ${new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} was released due to non-check-in within the 10-minute grace period.`,
      });
    } catch {
      // ignore notification errors
    }
  }

  return releasedCount;
};

module.exports = {
  getAvailability,
  createBooking,
  cancelBooking,
  checkInBooking,
  autoReleaseNoShows,
  checkWeeklyQuota,
  checkBookingHorizon,
  checkNoShowSuspension,
  handleSeatMaintenanceChange,
  normalizeToUTCMidnight,
  getCollegeTimezoneWeekRange,
  getCollegeWeekRange,
};
