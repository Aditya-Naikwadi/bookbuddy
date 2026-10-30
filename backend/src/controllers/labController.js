const asyncHandler = require('express-async-handler');
const LabSeat = require('../models/LabSeat');
const LabBooking = require('../models/LabBooking');
const labBookingService = require('../services/labBookingService');
const events = require('../sockets/events');

// @desc    Get all lab seats
// @route   GET /api/lab/seats
// @access  Private
const getSeats = asyncHandler(async (req, res) => {
  const seats = await LabSeat.find({});
  res.json({ success: true, data: seats });
});

// @desc    Get availability by lab name and date
// @route   GET /api/lab/availability
// @access  Private
const getAvailability = asyncHandler(async (req, res) => {
  const { labName, date } = req.query;
  const data = await labBookingService.getAvailability(req.user.collegeId, labName, date);
  res.json({ success: true, data });
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

// @desc    Check in to a lab booking
// @route   POST /api/lab/bookings/:id/check-in
// @access  Private
const checkInBooking = asyncHandler(async (req, res) => {
  const result = await labBookingService.checkInBooking(req.params.id, req.user.id || req.user._id);
  res.json({ success: true, data: result.booking, message: result.message });
});

// @desc    Join facility booking queue
// @route   POST /api/lab/queue/join
// @access  Private
const joinQueue = asyncHandler(async (req, res) => {
  const facilityEngineService = require('../services/facilityEngineService');
  const { resourceGroupId, resourceId, date, slotStart, slotEnd } = req.body;
  const result = await facilityEngineService.joinBookingQueue({
    collegeId: req.user.collegeId,
    branchId: req.user.branchId || null,
    resourceGroupId,
    resourceId,
    studentId: req.user.id || req.user._id,
    date,
    slotStart,
    slotEnd,
  });
  res.status(201).json({ success: true, data: result });
});

// @desc    Leave facility booking queue
// @route   DELETE /api/lab/queue/:id
// @access  Private
const leaveQueue = asyncHandler(async (req, res) => {
  const facilityEngineService = require('../services/facilityEngineService');
  const result = await facilityEngineService.leaveBookingQueue({
    queueId: req.params.id,
    studentId: req.user.id || req.user._id,
  });
  res.json({ success: true, message: result.message });
});

// @desc    Get student's active queue tickets
// @route   GET /api/lab/queue/me
// @access  Private
const getMyQueue = asyncHandler(async (req, res) => {
  const facilityEngineService = require('../services/facilityEngineService');
  const tickets = await facilityEngineService.getStudentQueueStatus({
    collegeId: req.user.collegeId,
    studentId: req.user.id || req.user._id,
  });
  res.json({ success: true, data: tickets });
});

// @desc    Claim promoted queue spot
// @route   POST /api/lab/queue/:id/claim
// @access  Private
const claimQueueSpot = asyncHandler(async (req, res) => {
  const facilityEngineService = require('../services/facilityEngineService');
  const result = await facilityEngineService.claimPromotedQueueSpot({
    queueId: req.params.id,
    studentId: req.user.id || req.user._id,
  });
  res.json({ success: true, data: result });
});

// @desc    Check out of a facility booking
// @route   POST /api/lab/bookings/:id/check-out
// @access  Private
const checkOutBooking = asyncHandler(async (req, res) => {
  const facilityEngineService = require('../services/facilityEngineService');
  const result = await facilityEngineService.checkOutBooking({
    bookingId: req.params.id,
    studentId:
      req.user.role === 'student' || req.user.role === 'college-student'
        ? req.user.id || req.user._id
        : undefined,
    collegeId: req.user.collegeId,
  });
  res.json({ success: true, data: result.booking, message: result.message });
});

// @desc    Get student weekly usage summary and queue status
// @route   GET /api/lab/usage/me
// @access  Private
const getMyUsage = asyncHandler(async (req, res) => {
  const facilityEngineService = require('../services/facilityEngineService');
  const usage = await facilityEngineService.getStudentUsage({
    collegeId: req.user.collegeId,
    studentId: req.user.id || req.user._id,
  });
  res.json({ success: true, data: usage });
});

// @desc    Get college facilities usage report
// @route   GET /api/lab/admin/usage
// @access  Private (CollegeAdmin / SuperAdmin)
const getAdminUsage = asyncHandler(async (req, res) => {
  const facilityEngineService = require('../services/facilityEngineService');
  const { startDate, endDate, status, limit } = req.query;
  const bookings = await facilityEngineService.getAdminFacilitiesUsage({
    collegeId: req.user.collegeId,
    startDate,
    endDate,
    status,
    limit: limit ? parseInt(limit, 10) : 200,
  });
  res.json({ success: true, data: bookings });
});

// @desc    Export college facilities usage report as CSV
// @route   GET /api/lab/admin/usage/export
// @access  Private (CollegeAdmin / SuperAdmin)
const exportAdminUsageCsv = asyncHandler(async (req, res) => {
  const facilityEngineService = require('../services/facilityEngineService');
  const { startDate, endDate, status } = req.query;
  const bookings = await facilityEngineService.getAdminFacilitiesUsage({
    collegeId: req.user.collegeId,
    startDate,
    endDate,
    status,
    limit: 5000,
  });

  const headers = [
    'Booking ID,Student ID,Student Name,Email,Program,Year,Resource,Date,Slot Start,Slot End,Checked In,Checked Out,Minutes Used,Status',
  ];
  const rows = bookings.map((b) => {
    const student = b.studentId || {};
    const resource = b.resourceId || {};
    const checkIn = b.checkedInAt ? new Date(b.checkedInAt).toISOString() : '';
    const checkOut = b.checkedOutAt ? new Date(b.checkedOutAt).toISOString() : '';
    let minutesUsed = 0;
    if (b.checkedInAt && b.checkedOutAt) {
      minutesUsed = Math.max(
        1,
        Math.round((new Date(b.checkedOutAt) - new Date(b.checkedInAt)) / 60000)
      );
    } else if (b.status === 'confirmed' || b.status === 'completed') {
      minutesUsed = Math.round((new Date(b.slotEnd) - new Date(b.slotStart)) / 60000);
    }
    return [
      b._id,
      student.studentId || '',
      `"${(student.name || '').replace(/"/g, '""')}"`,
      student.email || '',
      student.program || '',
      student.year || '',
      resource.label || '',
      b.date ? new Date(b.date).toISOString().split('T')[0] : '',
      b.slotStart ? new Date(b.slotStart).toISOString() : '',
      b.slotEnd ? new Date(b.slotEnd).toISOString() : '',
      checkIn,
      checkOut,
      minutesUsed,
      b.status,
    ].join(',');
  });

  const csvContent = [headers, ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="facility_usage_${Date.now()}.csv"`);
  res.send(csvContent);
});

module.exports = {
  getSeats,
  getAvailability,
  createBooking,
  getMyBookings,
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  getMyUsage,
  getAdminUsage,
  exportAdminUsageCsv,
  joinQueue,
  leaveQueue,
  getMyQueue,
  claimQueueSpot,
};
