const { DateTime } = require('luxon');
const FacilityResourceGroup = require('../models/FacilityResourceGroup');
const FacilityResource = require('../models/FacilityResource');
const FacilityBooking = require('../models/FacilityBooking');
const FacilityBookingQueue = require('../models/FacilityBookingQueue');
const FacilityUsageWeekly = require('../models/FacilityUsageWeekly');
const NoShowStrike = require('../models/NoShowStrike');
const College = require('../models/College');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { runInTransaction } = require('../utils/transactionHelper');
const { escapeRegExp } = require('../utils/sanitize');
const { acquireSoftLock, releaseSoftLock } = require('../utils/softLock');

/**
 * Socket.io safe emission helpers
 */
const emitToCollege = (collegeId, event, data) => {
  try {
    const socketModule = require('../sockets');
    if (socketModule && typeof socketModule.getIO === 'function') {
      const io = socketModule.getIO();
      if (io) {
        io.to(`college:${collegeId.toString()}`).emit(event, data);
      }
    }
  } catch (err) {
    logger.warn(`FacilityEngine: Failed to emit ${event} to college:${collegeId}: ${err.message}`);
  }
};

const emitToUser = (userId, event, data) => {
  try {
    const socketModule = require('../sockets');
    if (socketModule && typeof socketModule.getIO === 'function') {
      const io = socketModule.getIO();
      if (io) {
        io.to(`user:${userId.toString()}`).emit(event, data);
      }
    }
  } catch (err) {
    logger.warn(`FacilityEngine: Failed to emit ${event} to user:${userId}: ${err.message}`);
  }
};

/**
 * Helper to compute the local calendar week range (Monday 00:00:00 to Sunday 23:59:59.999)
 * for a specific college timezone.
 */
const getCollegeTimezoneWeekRange = (collegeTimezone = 'UTC', referenceDate = new Date()) => {
  try {
    const zone = collegeTimezone || 'UTC';
    const dt = DateTime.fromJSDate(referenceDate).setZone(zone);
    const monday = dt.startOf('week');
    const sunday = dt.endOf('week');
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

/**
 * Validates booking horizon per resource type (§10.3):
 * - Workstations: Max 1 hour in advance
 * - Study Seats: Max 1 day in advance
 */
const checkResourceHorizon = (
  startTime,
  resourceType = 'workstation',
  facilitySettings = {},
  referenceNow = new Date()
) => {
  const start = new Date(startTime);
  if (resourceType === 'workstation') {
    const horizonHours = facilitySettings?.workstationAdvanceHorizonHours ?? 1;
    const maxFutureMs = horizonHours * 60 * 60 * 1000;
    if (start.getTime() > referenceNow.getTime() + maxFutureMs) {
      throw new AppError(
        `Workstations can only be booked up to ${horizonHours} hour(s) in advance of the desired slot.`,
        400
      );
    }
  } else {
    const horizonDays = facilitySettings?.seatAdvanceHorizonDays ?? 1;
    const maxFutureMs = horizonDays * 24 * 60 * 60 * 1000;
    if (start.getTime() > referenceNow.getTime() + maxFutureMs) {
      throw new AppError(
        `Study seats can only be booked up to ${horizonDays} day(s) in advance of the desired slot.`,
        400
      );
    }
  }
};

/**
 * Legacy booking horizon check
 */
const checkBookingHorizon = (startTime, maxDays = 7, referenceNow = new Date()) => {
  const start = new Date(startTime);
  const maxFutureMs = maxDays * 24 * 60 * 60 * 1000;
  if (start.getTime() > referenceNow.getTime() + maxFutureMs) {
    throw new AppError(
      `Advance booking limit exceeded. You can only book slots up to ${maxDays} days in advance.`,
      400
    );
  }
};

/**
 * Evaluates whether a student is currently suspended due to rolling no-show strikes.
 */
const checkSuspensionStatus = async (
  studentId,
  collegeId,
  session = null,
  referenceNow = new Date()
) => {
  let rollingDays = 14;
  let maxStrikes = 3;
  let suspensionHours = 48;

  if (collegeId) {
    const college = await College.findById(collegeId)
      .select('facilitySettings')
      .session(session)
      .lean();
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

  const windowStart = new Date(referenceNow.getTime() - rollingDays * 24 * 60 * 60 * 1000);

  const strikes = await NoShowStrike.find({
    collegeId,
    studentId,
    createdAt: { $gte: windowStart },
  })
    .sort({ createdAt: -1 })
    .session(session)
    .lean();

  if (strikes.length >= maxStrikes) {
    const latestStrikeTime = new Date(strikes[0].createdAt).getTime();
    const suspensionDurationMs = suspensionHours * 60 * 60 * 1000;
    const suspensionLiftTime = new Date(latestStrikeTime + suspensionDurationMs);

    if (referenceNow.getTime() < suspensionLiftTime.getTime()) {
      const remainingHours = Math.ceil(
        (suspensionLiftTime.getTime() - referenceNow.getTime()) / (60 * 60 * 1000)
      );
      return {
        isSuspended: true,
        strikesCount: strikes.length,
        suspensionLiftTime,
        remainingHours,
      };
    }
  }

  return {
    isSuspended: false,
    strikesCount: strikes.length,
  };
};

/**
 * 1. Hold a slot with a 90-second soft lock (Redis / in-memory fallback)
 */
const holdSlot = async ({
  collegeId,
  resourceId,
  studentId,
  date,
  slotStart,
  slotEnd: _slotEnd,
  ttlSeconds = 90,
  referenceNow = new Date(),
}) => {
  // 1. Verify resource existence and availability
  const resource = await FacilityResource.findOne({
    _id: resourceId,
    collegeId,
  }).lean();

  if (!resource) {
    throw new AppError('Facility resource not found.', 404);
  }

  if (resource.status !== 'available') {
    throw new AppError(
      `Resource is currently ${resource.status === 'maintenance' ? 'under maintenance' : 'blocked for institutional use'}.`,
      400
    );
  }

  // 2. Verify student suspension status
  const suspension = await checkSuspensionStatus(studentId, collegeId, null, referenceNow);
  if (suspension.isSuspended) {
    throw new AppError(
      `Booking privileges temporarily suspended due to ${suspension.strikesCount} no-show strikes in the last 14 days. Suspension lifts in ${suspension.remainingHours} hour(s).`,
      403
    );
  }

  // 3. Verify slot is not already confirmed/checked-in
  const existingConfirmed = await FacilityBooking.findOne({
    resourceId,
    date: new Date(date),
    slotStart: new Date(slotStart),
    status: { $in: ['confirmed', 'checked-in'] },
  }).lean();

  if (existingConfirmed) {
    throw new AppError('This slot has already been reserved.', 409);
  }

  // 4. Attempt to acquire soft lock
  const lockResult = await acquireSoftLock({
    resourceId,
    date,
    slotStart,
    studentId,
    ttlSeconds,
  });

  if (!lockResult.success) {
    throw new AppError(
      lockResult.message ||
        'This slot is currently held by another student. Please try again shortly.',
      409
    );
  }

  return {
    success: true,
    held: true,
    ttlSeconds,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    lockKey: lockResult.lockKey,
    refreshed: !!lockResult.refreshed,
  };
};

/**
 * 2. Confirm a booking atomically: checks cap, suspension, writes booking, increments weekly usage, releases soft lock
 */
const confirmBooking = async ({
  collegeId,
  resourceId,
  studentId,
  date,
  slotStart,
  slotEnd,
  bookedByRole = 'student',
  proxyForStudentId = null,
  referenceNow = new Date(),
}) => {
  const targetStudentId = proxyForStudentId || studentId;
  const isStaffSelfBooking =
    !proxyForStudentId && ['staff', 'librarian', 'college-admin'].includes(bookedByRole);

  const parsedDate = new Date(date);
  const start = new Date(slotStart);
  const end = new Date(slotEnd);

  if (start.getTime() >= end.getTime()) {
    throw new AppError('Slot end time must be after slot start time.', 400);
  }

  const slotMinutes = Math.round((end.getTime() - start.getTime()) / (60 * 1000));
  if (slotMinutes <= 0) {
    throw new AppError('Invalid slot duration.', 400);
  }

  // Fetch resource and group details
  const resource = await FacilityResource.findOne({ _id: resourceId, collegeId }).lean();
  if (!resource) {
    throw new AppError('Facility resource not found.', 404);
  }

  if (resource.status !== 'available') {
    throw new AppError(`Resource is not available for booking (status: ${resource.status}).`, 400);
  }

  const group = await FacilityResourceGroup.findById(resource.groupId).lean();
  if (!group) {
    throw new AppError('Resource group not found.', 404);
  }

  const resourceType = group.type; // 'seat' or 'workstation'

  // Fetch college configuration for timezone, weekly quota, and horizon
  const college = await College.findById(collegeId).select('timezone facilitySettings').lean();

  const maxWeeklyWorkstationHours = college?.facilitySettings?.maxWeeklyWorkstationHours ?? 12;
  const maxWeeklySeatHours = college?.facilitySettings?.maxWeeklySeatHours ?? 30;
  const maxWeeklyHours =
    resourceType === 'workstation' ? maxWeeklyWorkstationHours : maxWeeklySeatHours;
  const maxWeeklyMinutes = maxWeeklyHours * 60;
  const collegeTimezone = college?.timezone || 'UTC';

  const isStaffBooking = ['staff', 'librarian', 'college-admin'].includes(bookedByRole);

  // 1. Advance booking horizon check per resource type (§10.3 - staff exempt for admin scheduling)
  if (!isStaffBooking) {
    checkResourceHorizon(start, resourceType, college?.facilitySettings, referenceNow);
  }

  // 2. Rolling no-show suspension check (skip for staff self-booking)
  if (!isStaffSelfBooking) {
    const suspension = await checkSuspensionStatus(targetStudentId, collegeId, null, referenceNow);
    if (suspension.isSuspended) {
      throw new AppError(
        `Booking privileges temporarily suspended due to ${suspension.strikesCount} no-show strikes in the last 14 days. Suspension lifts in ${suspension.remainingHours} hour(s).`,
        403
      );
    }
  }

  // 3. Weekly quota fast check via FacilityUsageWeekly (staff self-booking is unmetered)
  const { monday: weekStart } = getCollegeTimezoneWeekRange(collegeTimezone, parsedDate);

  const currentUsage = await FacilityUsageWeekly.findOne({
    collegeId,
    studentId: targetStudentId,
    resourceType,
    weekStart,
  }).lean();

  const minutesUsedSoFar = currentUsage?.minutesUsed || 0;
  if (!isStaffSelfBooking && minutesUsedSoFar + slotMinutes > maxWeeklyMinutes) {
    const remainingMinutes = Math.max(0, maxWeeklyMinutes - minutesUsedSoFar);
    throw new AppError(
      `Weekly quota exceeded for ${resourceType}s. Max: ${maxWeeklyHours} hrs (${maxWeeklyMinutes} mins), used: ${minutesUsedSoFar} mins, remaining: ${remainingMinutes} mins.`,
      403
    );
  }

  // 4. Atomic MongoDB Transaction:
  // Write FacilityBooking (enforced by DB partial unique index) & Increment FacilityUsageWeekly
  let createdBooking;
  let updatedWeeklyUsage;

  try {
    const result = await runInTransaction(async (session) => {
      // Check collision inside transaction
      const conflict = await FacilityBooking.findOne({
        resourceId,
        date: parsedDate,
        slotStart: start,
        status: { $in: ['confirmed', 'checked-in'] },
      }).session(session);

      if (conflict) {
        throw new AppError('This slot has already been booked by another student.', 409);
      }

      // Create booking record
      const [booking] = await FacilityBooking.create(
        [
          {
            collegeId,
            branchId: resource.branchId || group.branchId || null,
            resourceId,
            studentId: targetStudentId,
            date: parsedDate,
            slotStart: start,
            slotEnd: end,
            status: 'confirmed',
          },
        ],
        { session }
      );

      // Upsert and increment weekly usage atomically
      const usage = await FacilityUsageWeekly.findOneAndUpdate(
        {
          collegeId,
          studentId: targetStudentId,
          resourceType,
          weekStart,
        },
        {
          $inc: { minutesUsed: slotMinutes },
        },
        {
          upsert: true,
          returnDocument: 'after',
          session,
        }
      );

      return { booking, usage };
    });

    createdBooking = result.booking;
    updatedWeeklyUsage = result.usage;
  } catch (err) {
    // Structural MongoDB unique index duplicate error (E11000)
    if (err.code === 11000) {
      throw new AppError(
        'Collision detected: this slot was already confirmed concurrently. Double booking prevented.',
        409
      );
    }
    throw err;
  }

  // 5. Release Soft Lock
  await releaseSoftLock({
    resourceId,
    date: parsedDate,
    slotStart: start,
    studentId: targetStudentId,
  });

  // 6. Emit real-time update to college room
  emitToCollege(collegeId, 'facility:slot_booked', {
    bookingId: createdBooking._id,
    resourceId,
    groupId: group._id,
    resourceType,
    date: parsedDate,
    slotStart: start,
    slotEnd: end,
    status: 'confirmed',
  });

  return {
    success: true,
    booking: createdBooking,
    weeklyUsage: {
      resourceType,
      weekStart,
      minutesUsed: updatedWeeklyUsage.minutesUsed,
      remainingMinutes: Math.max(0, maxWeeklyMinutes - updatedWeeklyUsage.minutesUsed),
      maxWeeklyMinutes,
    },
  };
};

/**
 * 3. Student Check-In (Within Grace Window)
 */
const checkInBooking = async ({ bookingId, studentId, referenceNow = new Date() }) => {
  const booking = await FacilityBooking.findById(bookingId);
  if (!booking) {
    throw new AppError('Facility reservation not found.', 404);
  }

  if (booking.studentId.toString() !== studentId.toString()) {
    throw new AppError('Unauthorized: You can only check into your own reservations.', 403);
  }

  if (booking.status === 'checked-in') {
    return { success: true, booking, alreadyCheckedIn: true };
  }

  if (booking.status !== 'confirmed') {
    throw new AppError(`Cannot check into a reservation with status: ${booking.status}.`, 400);
  }

  const college = await College.findById(booking.collegeId).select('facilitySettings').lean();
  const graceMinutes = college?.facilitySettings?.checkInGraceMinutes ?? 10;

  const nowMs = referenceNow.getTime();
  const startMs = new Date(booking.slotStart).getTime();
  const earliestCheckInMs = startMs - 15 * 60 * 1000; // 15 mins early window
  const latestCheckInMs = startMs + graceMinutes * 60 * 1000;

  if (nowMs < earliestCheckInMs) {
    throw new AppError(
      'Check-in window is not yet open. You can check in up to 15 minutes before slot start.',
      400
    );
  }

  if (nowMs > latestCheckInMs) {
    throw new AppError(
      `Check-in grace period (${graceMinutes} minutes) has expired. This slot was auto-released.`,
      400
    );
  }

  booking.checkedInAt = referenceNow;
  booking.status = 'checked-in';
  await booking.save();

  emitToCollege(booking.collegeId, 'facility:slot_checked_in', {
    bookingId: booking._id,
    resourceId: booking.resourceId,
    checkedInAt: referenceNow,
    status: 'checked-in',
  });

  return {
    success: true,
    booking,
  };
};

/**
 * 4. Automated No-Show Sweep:
 * Finds un-checked-in slots past grace deadline -> marks no-show -> creates NoShowStrike -> frees slot
 */
const autoReleaseNoShows = async (referenceNow = new Date()) => {
  // Query all colleges to respect per-tenant grace windows
  const colleges = await College.find({}).select('facilitySettings').lean();
  const collegeGraceMap = new Map();
  colleges.forEach((c) => {
    collegeGraceMap.set(c._id.toString(), c.facilitySettings?.checkInGraceMinutes ?? 10);
  });

  // Query all confirmed bookings where slot started and is not checked in
  const confirmedBookings = await FacilityBooking.find({
    status: 'confirmed',
    checkedInAt: null,
    slotStart: { $lte: referenceNow },
  });

  const releasedBookings = [];
  const createdStrikes = [];

  for (const b of confirmedBookings) {
    const graceMinutes = collegeGraceMap.get(b.collegeId.toString()) ?? 10;
    const graceDeadline = new Date(new Date(b.slotStart).getTime() + graceMinutes * 60 * 1000);

    if (referenceNow.getTime() >= graceDeadline.getTime()) {
      // 1. Atomically mark as no-show
      await FacilityBooking.updateOne(
        { _id: b._id, status: 'confirmed' },
        { $set: { status: 'no-show' } }
      );

      // 2. Log immutable NoShowStrike
      try {
        const strike = await NoShowStrike.findOneAndUpdate(
          { bookingId: b._id },
          {
            collegeId: b.collegeId,
            studentId: b.studentId,
            bookingId: b._id,
            createdAt: referenceNow,
          },
          { upsert: true, returnDocument: 'after' }
        );
        createdStrikes.push(strike);
      } catch (strikeErr) {
        logger.warn(`Failed to create NoShowStrike for booking ${b._id}: ${strikeErr.message}`);
      }

      // 3. Emit real-time release event
      emitToCollege(b.collegeId, 'facility:slot_released', {
        bookingId: b._id,
        resourceId: b.resourceId,
        date: b.date,
        slotStart: b.slotStart,
        status: 'no-show',
        reason: 'Auto-released due to missed check-in grace period',
      });

      // 4. Promote next student in queue if any
      try {
        const resource = await FacilityResource.findById(b.resourceId).select('groupId').lean();
        if (resource?.groupId) {
          await promoteNextInQueue({
            collegeId: b.collegeId,
            resourceGroupId: resource.groupId,
            resourceId: b.resourceId,
            date: b.date,
            slotStart: b.slotStart,
            slotEnd: b.slotEnd,
            referenceNow,
          });
        }
      } catch (queueErr) {
        logger.warn(`FacilityEngine: Queue promotion error on auto-release: ${queueErr.message}`);
      }

      releasedBookings.push(b._id);
    }
  }

  return {
    releasedCount: releasedBookings.length,
    releasedBookings,
    createdStrikesCount: createdStrikes.length,
  };
};

/**
 * 5. Admin Override Flow:
 * Blocks resource (maintenance or institutional-block) -> auto-cancels conflicting bookings -> refunds quota
 */
const adminOverrideResource = async ({
  collegeId,
  resourceId,
  status,
  notes = '',
  referenceNow = new Date(),
}) => {
  if (!['maintenance', 'institutional-block', 'available'].includes(status)) {
    throw new AppError('Invalid resource status specified.', 400);
  }

  const resource = await FacilityResource.findOne({ _id: resourceId, collegeId });
  if (!resource) {
    throw new AppError('Facility resource not found.', 404);
  }

  resource.status = status;
  resource.notes = notes;
  await resource.save();

  let cancelledCount = 0;

  // If set to unavailable, auto-cancel conflicting active bookings
  if (status !== 'available') {
    const conflictingBookings = await FacilityBooking.find({
      collegeId,
      resourceId,
      slotEnd: { $gte: referenceNow },
      status: { $in: ['confirmed', 'checked-in'] },
    });

    const group = await FacilityResourceGroup.findById(resource.groupId).lean();
    const resourceType = group?.type || 'seat';

    const college = await College.findById(collegeId).select('timezone').lean();
    const collegeTimezone = college?.timezone || 'UTC';

    const notificationsToDispatch = [];
    const eventsToEmit = [];

    for (const cb of conflictingBookings) {
      cb.status = 'cancelled';
      cb.cancelReason = `Administrative Override: ${notes || status}`;
      cb.cancelledAt = referenceNow;
      await cb.save();

      cancelledCount++;

      // Refund consumed weekly minutes in FacilityUsageWeekly
      const slotMinutes = Math.round(
        (new Date(cb.slotEnd).getTime() - new Date(cb.slotStart).getTime()) / (60 * 1000)
      );
      const { monday: weekStart } = getCollegeTimezoneWeekRange(collegeTimezone, cb.date);

      await FacilityUsageWeekly.updateOne(
        {
          collegeId,
          studentId: cb.studentId,
          resourceType,
          weekStart,
        },
        {
          $inc: { minutesUsed: -slotMinutes },
        }
      );

      notificationsToDispatch.push({
        userId: cb.studentId,
        collegeId,
        type: 'booking_cancelled',
        title: 'Facility Reservation Cancelled',
        message: `Your reservation on ${resource.label} was cancelled due to administrative override (${notes || status}). Your weekly quota has been restored.`,
        metadata: {
          bookingId: cb._id,
          resourceLabel: resource.label,
          reason: cb.cancelReason,
        },
      });

      eventsToEmit.push({
        bookingId: cb._id,
        resourceId,
        date: cb.date,
        slotStart: cb.slotStart,
        status: 'cancelled',
        reason: cb.cancelReason,
      });
    }

    if (notificationsToDispatch.length > 0 || eventsToEmit.length > 0) {
      setImmediate(async () => {
        try {
          if (notificationsToDispatch.length > 0) {
            await Notification.insertMany(notificationsToDispatch, { ordered: false }).catch(
              (notifErr) =>
                logger.warn(
                  `Failed to batch insert cancellation notifications: ${notifErr.message}`
                )
            );
          }
          for (const ev of eventsToEmit) {
            emitToCollege(collegeId, 'facility:slot_cancelled', ev);
          }
        } catch (dispatchErr) {
          logger.warn(`Error dispatching async override notifications: ${dispatchErr.message}`);
        }
      });
    }
  }

  // Emit resource status change
  emitToCollege(collegeId, 'facility:resource_status_changed', {
    resourceId,
    status,
    notes,
  });

  return {
    success: true,
    resource,
    cancelledCount,
  };
};

/**
 * 6. Disciplinary Suspension Handler:
 * Revokes all active/future bookings, restores weekly quota, clears soft locks, and emits realtime release
 */
const handleDisciplinarySuspension = async ({
  studentId,
  collegeId,
  reason = 'Disciplinary Suspension: Account Inactivated',
  referenceNow = new Date(),
}) => {
  const activeBookings = await FacilityBooking.find({
    collegeId,
    studentId,
    slotEnd: { $gte: referenceNow },
    status: { $in: ['confirmed', 'held', 'checked-in'] },
  });

  const college = await College.findById(collegeId).select('timezone').lean();
  const collegeTimezone = college?.timezone || 'UTC';

  const cancelledBookings = [];

  for (const b of activeBookings) {
    b.status = 'cancelled';
    b.cancelReason = reason;
    b.cancelledAt = referenceNow;
    await b.save();

    // Release any active soft lock
    await releaseSoftLock({
      resourceId: b.resourceId,
      date: b.date,
      slotStart: b.slotStart,
      studentId,
    });

    // Refund quota
    const slotMinutes = Math.round(
      (new Date(b.slotEnd).getTime() - new Date(b.slotStart).getTime()) / (60 * 1000)
    );
    const resource = await FacilityResource.findById(b.resourceId).lean();
    const group = resource ? await FacilityResourceGroup.findById(resource.groupId).lean() : null;
    const resourceType = group?.type || 'seat';

    const { monday: weekStart } = getCollegeTimezoneWeekRange(collegeTimezone, b.date);

    await FacilityUsageWeekly.updateOne(
      { collegeId, studentId, resourceType, weekStart },
      { $inc: { minutesUsed: -slotMinutes } }
    );

    // Emit slot released to college room so physical capacity is immediately free
    emitToCollege(collegeId, 'facility:slot_released', {
      bookingId: b._id,
      resourceId: b.resourceId,
      date: b.date,
      slotStart: b.slotStart,
      status: 'cancelled',
      reason,
    });

    cancelledBookings.push(b._id);
  }

  return {
    success: true,
    cancelledCount: cancelledBookings.length,
    cancelledBookings,
  };
};

/**
 * 7. Resource Group Downsizing / Deletion Guard
 */
const validateAndExecuteGroupDownsizeOrDelete = async ({
  collegeId,
  groupId,
  targetUnits = 0,
  isDelete = false,
  referenceNow = new Date(),
}) => {
  const group = await FacilityResourceGroup.findOne({ _id: groupId, collegeId });
  if (!group) {
    throw new AppError('Resource group not found.', 404);
  }

  const resources = await FacilityResource.find({ groupId, collegeId }).sort({ label: 1 });

  if (isDelete || targetUnits <= 0) {
    // Check if any resource in group has upcoming active bookings
    const activeBookingsCount = await FacilityBooking.countDocuments({
      collegeId,
      resourceId: { $in: resources.map((r) => r._id) },
      slotEnd: { $gte: referenceNow },
      status: { $in: ['confirmed', 'checked-in'] },
    });

    if (activeBookingsCount > 0) {
      throw new AppError(
        `Cannot delete resource group with ${activeBookingsCount} active reservation(s). Please cancel or reassign them first.`,
        400
      );
    }

    await FacilityResource.deleteMany({ groupId, collegeId });
    await FacilityResourceGroup.deleteOne({ _id: groupId, collegeId });

    return {
      success: true,
      deleted: true,
      removedUnitsCount: resources.length,
    };
  }

  // Downsizing case (e.g. 30 -> 25 units)
  if (targetUnits < resources.length) {
    // Remove highest numbered resources
    const unitsToRemove = resources.slice(targetUnits);
    const removeIds = unitsToRemove.map((r) => r._id);

    // Find and gracefully cancel bookings on the removed units
    const conflictingBookings = await FacilityBooking.find({
      collegeId,
      resourceId: { $in: removeIds },
      slotEnd: { $gte: referenceNow },
      status: { $in: ['confirmed', 'checked-in'] },
    });

    const college = await College.findById(collegeId).select('timezone').lean();
    const collegeTimezone = college?.timezone || 'UTC';

    const downsizeNotifications = [];
    const downsizeEvents = [];

    for (const cb of conflictingBookings) {
      cb.status = 'cancelled';
      cb.cancelReason = 'Resource group capacity reconfiguration: Unit decommissioned';
      cb.cancelledAt = referenceNow;
      await cb.save();

      const slotMinutes = Math.round(
        (new Date(cb.slotEnd).getTime() - new Date(cb.slotStart).getTime()) / (60 * 1000)
      );
      const { monday: weekStart } = getCollegeTimezoneWeekRange(collegeTimezone, cb.date);

      await FacilityUsageWeekly.updateOne(
        { collegeId, studentId: cb.studentId, resourceType: group.type, weekStart },
        { $inc: { minutesUsed: -slotMinutes } }
      );

      downsizeNotifications.push({
        userId: cb.studentId,
        collegeId,
        type: 'booking_cancelled',
        message: `Your reservation on a decommissioned unit in ${group.name} was cancelled due to capacity adjustments. Your weekly quota has been refunded.`,
      });

      downsizeEvents.push({
        bookingId: cb._id,
        resourceId: cb.resourceId,
        date: cb.date,
        slotStart: cb.slotStart,
        status: 'cancelled',
      });
    }

    if (downsizeNotifications.length > 0 || downsizeEvents.length > 0) {
      setImmediate(async () => {
        try {
          if (downsizeNotifications.length > 0) {
            await Notification.insertMany(downsizeNotifications, { ordered: false }).catch(
              (notifErr) =>
                logger.warn(`Failed to batch dispatch downsize notifications: ${notifErr.message}`)
            );
          }
          for (const ev of downsizeEvents) {
            emitToCollege(collegeId, 'facility:slot_cancelled', ev);
          }
        } catch (dispatchErr) {
          logger.warn(`Error dispatching async downsize notifications: ${dispatchErr.message}`);
        }
      });
    }

    await FacilityResource.deleteMany({ _id: { $in: removeIds } });
    group.totalUnits = targetUnits;
    await group.save();

    return {
      success: true,
      downsized: true,
      previousUnits: resources.length,
      currentUnits: targetUnits,
      cancelledBookingsCount: conflictingBookings.length,
    };
  }

  // If increasing or maintaining units
  group.totalUnits = targetUnits;
  await group.save();
  return { success: true, currentUnits: targetUnits };
};

/**
 * 8. Search Resources with ReDoS & Regex Injection Protection
 */
const searchResources = async ({ collegeId, groupId = null, labelQuery = '', status = null }) => {
  const filter = { collegeId };
  if (groupId) {
    filter.groupId = groupId;
  }
  if (status) {
    filter.status = status;
  }
  if (labelQuery && labelQuery.trim()) {
    const sanitized = escapeRegExp(labelQuery.trim());
    filter.label = { $regex: new RegExp(sanitized, 'i') };
  }

  return FacilityResource.find(filter).lean();
};

/**
 * 9. Unified Cancellation Policy (§10.5):
 * - Cancel >= 1 hour before start: Free (quota refunded)
 * - Cancel < 1 hour before start: Quota remains deducted ("you booked it, you lose it")
 */
const cancelBooking = async ({
  bookingId,
  studentId,
  cancelReason = 'Student cancelled reservation',
  referenceNow = new Date(),
}) => {
  const booking = await FacilityBooking.findById(bookingId);
  if (!booking) {
    throw new AppError('Facility reservation not found.', 404);
  }

  if (booking.studentId.toString() !== studentId.toString()) {
    throw new AppError('Unauthorized: You can only cancel your own reservations.', 403);
  }

  if (['cancelled', 'no-show', 'completed'].includes(booking.status)) {
    throw new AppError(`Cannot cancel a reservation with status: ${booking.status}.`, 400);
  }

  const noticeMinutes = Math.round(
    (new Date(booking.slotStart).getTime() - referenceNow.getTime()) / (60 * 1000)
  );
  const isFreeCancellation = noticeMinutes >= 60;

  booking.status = 'cancelled';
  booking.cancelledWithinGrace = isFreeCancellation;
  booking.cancelReason = isFreeCancellation
    ? cancelReason || 'Cancelled with advance notice (no penalty)'
    : `${cancelReason || 'Late cancellation'}: Under 1 hour notice (weekly quota deducted)`;
  booking.cancelledAt = referenceNow;
  await booking.save();

  // Free the soft lock if any
  await releaseSoftLock({
    resourceId: booking.resourceId,
    date: booking.date,
    slotStart: booking.slotStart,
    studentId,
  });

  // If cancelled >= 1 hour before start, refund weekly quota
  if (isFreeCancellation) {
    const slotMinutes = Math.round(
      (new Date(booking.slotEnd).getTime() - new Date(booking.slotStart).getTime()) / (60 * 1000)
    );
    const resource = await FacilityResource.findById(booking.resourceId).lean();
    const group = resource ? await FacilityResourceGroup.findById(resource.groupId).lean() : null;
    const resourceType = group?.type || 'seat';

    const college = await College.findById(booking.collegeId).select('timezone').lean();
    const collegeTimezone = college?.timezone || 'UTC';
    const { monday: weekStart } = getCollegeTimezoneWeekRange(collegeTimezone, booking.date);

    await FacilityUsageWeekly.updateOne(
      { collegeId: booking.collegeId, studentId, resourceType, weekStart },
      { $inc: { minutesUsed: -slotMinutes } }
    );
  }

  // Emit realtime release so physical seat/PC is immediately free for other patrons
  emitToCollege(booking.collegeId, 'facility:slot_released', {
    bookingId: booking._id,
    resourceId: booking.resourceId,
    date: booking.date,
    slotStart: booking.slotStart,
    status: 'cancelled',
    reason: booking.cancelReason,
  });

  // Promote the next student in queue (if any)
  try {
    const resource = await FacilityResource.findById(booking.resourceId).select('groupId').lean();
    if (resource?.groupId) {
      await promoteNextInQueue({
        collegeId: booking.collegeId,
        resourceGroupId: resource.groupId,
        resourceId: booking.resourceId,
        date: booking.date,
        slotStart: booking.slotStart,
        slotEnd: booking.slotEnd,
        referenceNow,
      });
    }
  } catch (queueErr) {
    logger.warn(`FacilityEngine: Queue promotion error on cancellation: ${queueErr.message}`);
  }

  return {
    success: true,
    booking,
    quotaRefunded: isFreeCancellation,
    noticeMinutes,
  };
};

/**
 * 10. Queue System (§10.4 & §11)
 * Reuses the Reservation hold pattern to queue students for fully booked slots.
 */

const joinBookingQueue = async ({
  collegeId,
  branchId = null,
  resourceGroupId,
  resourceId = null,
  studentId,
  date,
  slotStart,
  slotEnd,
  referenceNow = new Date(),
}) => {
  const parsedDate = new Date(date);
  const start = new Date(slotStart);
  const end = new Date(slotEnd);

  // 1. Group validation
  const group = await FacilityResourceGroup.findById(resourceGroupId).lean();
  if (!group) {
    throw new AppError('Resource group not found.', 404);
  }

  // 2. Student suspension check
  const suspension = await checkSuspensionStatus(studentId, collegeId, null, referenceNow);
  if (suspension.isSuspended) {
    throw new AppError(
      `Cannot join queue. Booking privileges temporarily suspended (${suspension.strikesCount} strikes).`,
      403
    );
  }

  // 3. Prevent duplicate active queue tickets for the same slot
  const existingQueue = await FacilityBookingQueue.findOne({
    studentId,
    resourceGroupId,
    date: parsedDate,
    slotStart: start,
    status: { $in: ['queued', 'ready_to_confirm'] },
  }).lean();

  if (existingQueue) {
    throw new AppError(
      `You are already in the waitlist for this slot (Position #${existingQueue.queuePosition}).`,
      409
    );
  }

  // 4. Check if student already has a confirmed booking for this timeslot
  const existingBooking = await FacilityBooking.findOne({
    studentId,
    date: parsedDate,
    slotStart: start,
    status: { $in: ['confirmed', 'checked-in'] },
  }).lean();

  if (existingBooking) {
    throw new AppError('You already have a confirmed booking for this timeslot.', 409);
  }

  // 5. Atomic position calculation with optimistic retry on concurrent join collisions
  let queueEntry = null;
  let nextPosition = 1;
  let attempts = 0;

  while (!queueEntry && attempts < 10) {
    attempts++;
    const highestEntry = await FacilityBookingQueue.findOne({
      resourceGroupId,
      date: parsedDate,
      slotStart: start,
      status: 'queued',
    })
      .sort({ queuePosition: -1 })
      .select('queuePosition')
      .lean();

    nextPosition = highestEntry ? highestEntry.queuePosition + 1 : 1;

    try {
      queueEntry = await FacilityBookingQueue.create({
        collegeId,
        branchId: branchId || group.branchId || null,
        resourceGroupId,
        resourceId,
        studentId,
        date: parsedDate,
        slotStart: start,
        slotEnd: end,
        queuePosition: nextPosition,
        status: 'queued',
      });
    } catch (createErr) {
      // If position collision occurred concurrently, retry with next position
      if (createErr.code === 11000 && createErr.message?.includes('queuePosition')) {
        continue;
      }
      throw createErr;
    }
  }

  if (!queueEntry) {
    throw new AppError(
      'High concurrency contention. Please try joining the queue again shortly.',
      409
    );
  }

  emitToCollege(collegeId, 'facility:queue_updated', {
    resourceGroupId,
    date: parsedDate,
    slotStart: start,
    queueSize: nextPosition,
  });

  return {
    success: true,
    queueEntry,
    queuePosition: nextPosition,
    aheadCount: Math.max(0, nextPosition - 1),
  };
};

const leaveBookingQueue = async ({ queueId, studentId }) => {
  const ticket = await FacilityBookingQueue.findOne({ _id: queueId, studentId });
  if (!ticket) {
    throw new AppError('Queue ticket not found.', 404);
  }

  if (ticket.status !== 'queued') {
    throw new AppError(`Cannot leave queue ticket with status: ${ticket.status}.`, 400);
  }

  const oldPosition = ticket.queuePosition;
  ticket.status = 'cancelled';
  await ticket.save();

  // Re-index subsequent tickets
  await FacilityBookingQueue.updateMany(
    {
      resourceGroupId: ticket.resourceGroupId,
      date: ticket.date,
      slotStart: ticket.slotStart,
      status: 'queued',
      queuePosition: { $gt: oldPosition },
    },
    { $inc: { queuePosition: -1 } }
  );

  emitToCollege(ticket.collegeId, 'facility:queue_updated', {
    resourceGroupId: ticket.resourceGroupId,
    date: ticket.date,
    slotStart: ticket.slotStart,
  });

  return {
    success: true,
    message: 'Successfully left the queue.',
  };
};

const getStudentQueueStatus = async ({ collegeId, studentId }) => {
  const tickets = await FacilityBookingQueue.find({
    collegeId,
    studentId,
    status: { $in: ['queued', 'ready_to_confirm'] },
  })
    .populate('resourceGroupId', 'name type slotDurationMinutes bookingHorizon')
    .populate('resourceId', 'label status')
    .sort({ createdAt: -1 })
    .lean();

  const now = Date.now();
  return tickets.map((t) => {
    let remainingClaimSeconds = 0;
    if (t.status === 'ready_to_confirm' && t.expiresAt) {
      remainingClaimSeconds = Math.max(
        0,
        Math.floor((new Date(t.expiresAt).getTime() - now) / 1000)
      );
    }
    return {
      ...t,
      aheadCount: Math.max(0, (t.queuePosition || 1) - 1),
      remainingClaimSeconds,
    };
  });
};

const promoteNextInQueue = async ({
  collegeId,
  resourceGroupId,
  resourceId = null,
  date,
  slotStart,
  slotEnd: _slotEnd,
  referenceNow = new Date(),
}) => {
  const nextTicket = await FacilityBookingQueue.findOne({
    resourceGroupId,
    date: new Date(date),
    slotStart: new Date(slotStart),
    status: 'queued',
  }).sort({ queuePosition: 1 });

  if (!nextTicket) {
    return { promoted: false };
  }

  const expiresAt = new Date(referenceNow.getTime() + 10 * 60 * 1000); // 10-minute confirmation window
  nextTicket.status = 'ready_to_confirm';
  nextTicket.promotedAt = referenceNow;
  nextTicket.expiresAt = expiresAt;
  if (resourceId) {
    nextTicket.resourceId = resourceId;
  }
  await nextTicket.save();

  // Create notification
  try {
    await Notification.create({
      userId: nextTicket.studentId,
      collegeId: nextTicket.collegeId,
      type: 'facility_queue_promoted',
      title: 'Facility Slot Available to Claim!',
      message: 'A reserved slot has opened up! You have 10 minutes to claim your reservation.',
      data: {
        queueId: nextTicket._id,
        resourceGroupId,
        resourceId,
        date: nextTicket.date,
        slotStart: nextTicket.slotStart,
        expiresAt,
      },
    });
  } catch (notifErr) {
    logger.warn(`FacilityEngine: Failed to create queue notification: ${notifErr.message}`);
  }

  emitToUser(nextTicket.studentId, 'facility:queue_promoted', {
    queueId: nextTicket._id,
    resourceGroupId,
    resourceId,
    date: nextTicket.date,
    slotStart: nextTicket.slotStart,
    expiresAt,
    claimWindowMinutes: 10,
  });

  emitToCollege(collegeId, 'facility:queue_updated', {
    resourceGroupId,
    date: nextTicket.date,
    slotStart: nextTicket.slotStart,
  });

  return {
    promoted: true,
    queueEntry: nextTicket,
  };
};

const claimPromotedQueueSpot = async ({ queueId, studentId, referenceNow = new Date() }) => {
  const ticket = await FacilityBookingQueue.findOne({
    _id: queueId,
    studentId,
  });

  if (!ticket) {
    throw new AppError('Queue ticket not found.', 404);
  }

  if (ticket.status !== 'ready_to_confirm') {
    throw new AppError(`Ticket is not eligible for claiming (status: ${ticket.status}).`, 400);
  }

  if (ticket.expiresAt && referenceNow.getTime() > new Date(ticket.expiresAt).getTime()) {
    ticket.status = 'expired';
    await ticket.save();

    // Auto-promote next in line
    await promoteNextInQueue({
      collegeId: ticket.collegeId,
      resourceGroupId: ticket.resourceGroupId,
      resourceId: ticket.resourceId,
      date: ticket.date,
      slotStart: ticket.slotStart,
      slotEnd: ticket.slotEnd,
      referenceNow,
    });

    throw new AppError(
      'Claim window has expired. The slot has been offered to the next student.',
      400
    );
  }

  // Find candidate resource
  let targetResourceId = ticket.resourceId;
  if (!targetResourceId) {
    const resources = await FacilityResource.find({
      groupId: ticket.resourceGroupId,
      status: 'available',
    })
      .select('_id')
      .lean();

    const bookedResourceIds = await FacilityBooking.distinct('resourceId', {
      resourceId: { $in: resources.map((r) => r._id) },
      date: ticket.date,
      slotStart: ticket.slotStart,
      status: { $in: ['confirmed', 'checked-in'] },
    });

    const candidate = resources.find((r) => !bookedResourceIds.some((bid) => bid.equals(r._id)));
    if (!candidate) {
      throw new AppError('No available resource found for this timeslot.', 409);
    }
    targetResourceId = candidate._id;
  }

  // Confirm booking
  const bookingResult = await confirmBooking({
    collegeId: ticket.collegeId,
    resourceId: targetResourceId,
    studentId,
    date: ticket.date,
    slotStart: ticket.slotStart,
    slotEnd: ticket.slotEnd,
    referenceNow,
  });

  ticket.status = 'confirmed';
  ticket.resourceId = targetResourceId;
  await ticket.save();

  emitToUser(studentId, 'facility:queue_claimed', {
    queueId: ticket._id,
    bookingId: bookingResult.booking._id,
  });

  return {
    success: true,
    booking: bookingResult.booking,
    weeklyUsage: bookingResult.weeklyUsage,
  };
};

const autoExpireQueuePromotions = async (referenceNow = new Date()) => {
  const expiredTickets = await FacilityBookingQueue.find({
    status: 'ready_to_confirm',
    expiresAt: { $lt: referenceNow },
  });

  const expiredCount = expiredTickets.length;
  for (const ticket of expiredTickets) {
    ticket.status = 'expired';
    await ticket.save();

    logger.info(
      `FacilityQueue: Expired claim window for ticket ${ticket._id} (student: ${ticket.studentId})`
    );

    // Promote next in line
    await promoteNextInQueue({
      collegeId: ticket.collegeId,
      resourceGroupId: ticket.resourceGroupId,
      resourceId: ticket.resourceId,
      date: ticket.date,
      slotStart: ticket.slotStart,
      slotEnd: ticket.slotEnd,
      referenceNow,
    });
  }

  return { expiredCount };
};

module.exports = {
  getCollegeTimezoneWeekRange,
  checkBookingHorizon,
  checkResourceHorizon,
  checkSuspensionStatus,
  holdSlot,
  confirmBooking,
  checkInBooking,
  cancelBooking,
  autoReleaseNoShows,
  adminOverrideResource,
  handleDisciplinarySuspension,
  validateAndExecuteGroupDownsizeOrDelete,
  searchResources,
  joinBookingQueue,
  leaveBookingQueue,
  getStudentQueueStatus,
  promoteNextInQueue,
  claimPromotedQueueSpot,
  autoExpireQueuePromotions,
};
