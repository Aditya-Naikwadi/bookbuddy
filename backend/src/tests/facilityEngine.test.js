const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_facility_engine_test';
process.env.JWT_SECRET = 'testjwtfacilityenginesecretkey123';
process.env.JWT_REFRESH_SECRET = 'testjwtfacilityenginerefreshsecretkey123';
process.env.JWT_ACCESS_EXPIRY = '10m';
process.env.JWT_REFRESH_EXPIRY = '7d';

jest.setTimeout(60000);

const College = require('../models/College');
const User = require('../models/User');
const FacilityResourceGroup = require('../models/FacilityResourceGroup');
const FacilityResource = require('../models/FacilityResource');
const FacilityBooking = require('../models/FacilityBooking');
const FacilityUsageWeekly = require('../models/FacilityUsageWeekly');
const NoShowStrike = require('../models/NoShowStrike');
const Notification = require('../models/Notification');
const softLock = require('../utils/softLock');
const facilityEngineService = require('../services/facilityEngineService');

describe('Conceptual Data Model & Workflow Engine Integration Tests', () => {
  let testCollege;
  let student1;
  let student2;
  let testGroup;
  let testResource;
  let testSeatGroup;
  let testSeatResource;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Clean all collections
    await College.deleteMany({});
    await User.deleteMany({});
    await FacilityResourceGroup.deleteMany({});
    await FacilityResource.deleteMany({});
    await FacilityBooking.deleteMany({});
    await FacilityUsageWeekly.deleteMany({});
    await NoShowStrike.deleteMany({});
    await Notification.deleteMany({});

    // Ensure database partial indexes are compiled
    await FacilityBooking.syncIndexes();
    await FacilityResource.syncIndexes();
    await FacilityUsageWeekly.syncIndexes();
    await NoShowStrike.syncIndexes();

    // 1. Create College with facility configuration
    testCollege = await College.create({
      name: 'Tech University',
      code: 'TECH-U',
      timezone: 'Asia/Kolkata',
      facilitySettings: {
        maxWeeklyWorkstationHours: 12, // 720 minutes
        maxWeeklySeatHours: 30, // 1800 minutes
        workstationAdvanceHorizonHours: 1,
        seatAdvanceHorizonDays: 1,
        checkInGraceMinutes: 10,
        capScope: 'college',
        advanceBookingDays: 7,
        noShowPenaltyWindowDays: 14,
        noShowMaxStrikes: 3,
        noShowSuspensionHours: 48,
      },
    });

    // 2. Create Students
    student1 = await User.create({
      studentId: 'STU_TECH_001',
      name: 'Alice Cooper',
      email: 'alice@tech.edu',
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
      isEmailVerified: true,
    });

    student2 = await User.create({
      studentId: 'STU_TECH_002',
      name: 'Bob Marley',
      email: 'bob@tech.edu',
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
      isEmailVerified: true,
    });

    // 3. Create Resource Groups & Resources (Workstations + Study Seats)
    testGroup = await FacilityResourceGroup.create({
      collegeId: testCollege._id,
      name: 'Computer Lab 2',
      type: 'workstation',
      slotDurationMinutes: 60,
      operatingHours: { openTime: '08:00', closeTime: '22:00' },
      totalUnits: 30,
    });

    testResource = await FacilityResource.create({
      collegeId: testCollege._id,
      groupId: testGroup._id,
      label: 'PC-07',
      status: 'available',
    });

    testSeatGroup = await FacilityResourceGroup.create({
      collegeId: testCollege._id,
      name: 'Silent Reading Hall A',
      type: 'seat',
      slotDurationMinutes: 60,
      operatingHours: { openTime: '08:00', closeTime: '22:00' },
      totalUnits: 50,
    });

    testSeatResource = await FacilityResource.create({
      collegeId: testCollege._id,
      groupId: testSeatGroup._id,
      label: 'Seat-01',
      status: 'available',
    });
  });

  afterAll(async () => {
    softLock.clearAllInMemoryLocks();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    softLock.clearAllInMemoryLocks();
    await FacilityBooking.deleteMany({});
    await FacilityUsageWeekly.deleteMany({});
    await NoShowStrike.deleteMany({});
    await Notification.deleteMany({});
    await FacilityResource.updateMany({}, { $set: { status: 'available', notes: '' } });
  });

  describe('1. Structural Database Double-Booking Impossibility', () => {
    it('should reject concurrent duplicate bookings at the database tier via partial unique index', async () => {
      const slotDate = new Date('2026-10-15T00:00:00.000Z');
      const slotStart = new Date('2026-10-15T10:00:00.000Z');
      const slotEnd = new Date('2026-10-15T11:00:00.000Z');

      // First booking succeeds
      const b1 = await FacilityBooking.create({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student1._id,
        date: slotDate,
        slotStart,
        slotEnd,
        status: 'confirmed',
      });
      expect(b1._id).toBeDefined();

      // Second booking for identical resourceId, date, slotStart MUST be structurally rejected by DB engine (E11000)
      let duplicateError = null;
      try {
        await FacilityBooking.create({
          collegeId: testCollege._id,
          resourceId: testResource._id,
          studentId: student2._id,
          date: slotDate,
          slotStart,
          slotEnd,
          status: 'confirmed',
        });
      } catch (err) {
        duplicateError = err;
      }

      expect(duplicateError).toBeDefined();
      expect(duplicateError.code).toBe(11000);
    });

    it('should allow non-overlapping or cancelled slots on the same resource without collision', async () => {
      const slotDate = new Date('2026-10-15T00:00:00.000Z');
      const slot1Start = new Date('2026-10-15T10:00:00.000Z');
      const slot1End = new Date('2026-10-15T11:00:00.000Z');
      const slot2Start = new Date('2026-10-15T11:00:00.000Z');
      const slot2End = new Date('2026-10-15T12:00:00.000Z');

      // Slot 1
      const b1 = await FacilityBooking.create({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student1._id,
        date: slotDate,
        slotStart: slot1Start,
        slotEnd: slot1End,
        status: 'cancelled',
      });

      // Same slot start, but b1 is cancelled, so new confirmed booking succeeds
      const b2 = await FacilityBooking.create({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student2._id,
        date: slotDate,
        slotStart: slot1Start,
        slotEnd: slot1End,
        status: 'confirmed',
      });
      expect(b2._id).toBeDefined();

      // Non-overlapping slot succeeds
      const b3 = await FacilityBooking.create({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student1._id,
        date: slotDate,
        slotStart: slot2Start,
        slotEnd: slot2End,
        status: 'confirmed',
      });
      expect(b3._id).toBeDefined();
    });
  });

  describe('2. Soft-Lock Workflow (90s TTL & Hold-and-Release)', () => {
    it('should acquire 90s soft lock for student 1 and reject student 2 until released', async () => {
      const slotDate = new Date('2026-10-15T00:00:00.000Z');
      const slotStart = new Date('2026-10-15T14:00:00.000Z');

      // 1. Student 1 acquires soft lock
      const lockRes1 = await softLock.acquireSoftLock({
        resourceId: testResource._id,
        date: slotDate,
        slotStart,
        studentId: student1._id,
        ttlSeconds: 90,
      });
      expect(lockRes1.success).toBe(true);

      // 2. Student 2 attempts to lock same slot -> rejected
      const lockRes2 = await softLock.acquireSoftLock({
        resourceId: testResource._id,
        date: slotDate,
        slotStart,
        studentId: student2._id,
        ttlSeconds: 90,
      });
      expect(lockRes2.success).toBe(false);
      expect(lockRes2.holder).toBe(student1._id.toString());

      // 3. Student 1 can re-request and refresh their own hold
      const refreshRes = await softLock.acquireSoftLock({
        resourceId: testResource._id,
        date: slotDate,
        slotStart,
        studentId: student1._id,
        ttlSeconds: 90,
      });
      expect(refreshRes.success).toBe(true);
      expect(refreshRes.refreshed).toBe(true);

      // 4. Student 1 releases soft lock
      const released = await softLock.releaseSoftLock({
        resourceId: testResource._id,
        date: slotDate,
        slotStart,
        studentId: student1._id,
      });
      expect(released).toBe(true);

      // 5. Now Student 2 can successfully acquire lock
      const lockRes3 = await softLock.acquireSoftLock({
        resourceId: testResource._id,
        date: slotDate,
        slotStart,
        studentId: student2._id,
        ttlSeconds: 90,
      });
      expect(lockRes3.success).toBe(true);
    });
  });

  describe('3. Atomic Booking Confirmation & FacilityUsageWeekly Aggregation', () => {
    it('should confirm booking atomically and increment FacilityUsageWeekly in O(1)', async () => {
      const baseNow = new Date('2026-10-15T14:30:00.000Z');
      const slotDate = new Date('2026-10-15T00:00:00.000Z');
      const slotStart = new Date('2026-10-15T15:00:00.000Z');
      const slotEnd = new Date('2026-10-15T17:00:00.000Z'); // 2 hours = 120 mins

      // Confirm booking
      const result = await facilityEngineService.confirmBooking({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student1._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: baseNow,
      });

      expect(result.success).toBe(true);
      expect(result.booking.status).toBe('confirmed');
      expect(result.weeklyUsage.minutesUsed).toBe(120);
      expect(result.weeklyUsage.remainingMinutes).toBe(600); // 720 - 120

      // Verify record in FacilityUsageWeekly
      const usageDoc = await FacilityUsageWeekly.findOne({
        collegeId: testCollege._id,
        studentId: student1._id,
        resourceType: 'workstation',
      });
      expect(usageDoc).toBeDefined();
      expect(usageDoc.minutesUsed).toBe(120);
    });

    it('should reject booking when weekly quota is exceeded', async () => {
      const baseNow = new Date('2026-10-15T17:30:00.000Z');
      const slotDate = new Date('2026-10-15T00:00:00.000Z');
      const { monday: weekStart } = facilityEngineService.getCollegeTimezoneWeekRange(
        testCollege.timezone,
        slotDate
      );

      // Pre-seed 11 hours (660 minutes) used out of 12 hours (720 minutes)
      await FacilityUsageWeekly.create({
        collegeId: testCollege._id,
        studentId: student1._id,
        resourceType: 'workstation',
        weekStart,
        minutesUsed: 660,
      });

      // Try to book a 2-hour slot (120 minutes), which would bring total to 780 > 720
      const slotStart = new Date('2026-10-15T18:00:00.000Z');
      const slotEnd = new Date('2026-10-15T20:00:00.000Z');

      await expect(
        facilityEngineService.confirmBooking({
          collegeId: testCollege._id,
          resourceId: testResource._id,
          studentId: student1._id,
          date: slotDate,
          slotStart,
          slotEnd,
          referenceNow: baseNow,
        })
      ).rejects.toThrow(/Weekly quota exceeded/);
    });
  });

  describe('4. Check-In & Automated No-Show Sweep Workflow', () => {
    it('should allow student to check in within the 10-minute grace window', async () => {
      const slotStart = new Date('2026-10-15T10:00:00.000Z');
      const slotEnd = new Date('2026-10-15T11:00:00.000Z');

      const booking = await FacilityBooking.create({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student1._id,
        date: new Date('2026-10-15T00:00:00.000Z'),
        slotStart,
        slotEnd,
        status: 'confirmed',
      });

      // Check in at 10:05 AM (within 10-min grace period)
      const checkInTime = new Date('2026-10-15T10:05:00.000Z');
      const checkInRes = await facilityEngineService.checkInBooking({
        bookingId: booking._id,
        studentId: student1._id,
        referenceNow: checkInTime,
      });

      expect(checkInRes.success).toBe(true);
      expect(checkInRes.booking.status).toBe('checked-in');
      expect(checkInRes.booking.checkedInAt).toBeDefined();
    });

    it('should auto-release non-checked-in slots past grace deadline, log NoShowStrike, and trigger suspension after 3 strikes', async () => {
      const slotStart = new Date('2026-10-15T10:00:00.000Z');
      const slotEnd = new Date('2026-10-15T11:00:00.000Z');

      const booking = await FacilityBooking.create({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student1._id,
        date: new Date('2026-10-15T00:00:00.000Z'),
        slotStart,
        slotEnd,
        status: 'confirmed',
      });

      // Reference time: 10:11 AM (11 mins past slot start, > 10 min grace window)
      const sweepNow = new Date('2026-10-15T10:11:00.000Z');
      const sweepResult = await facilityEngineService.autoReleaseNoShows(sweepNow);

      expect(sweepResult.releasedCount).toBe(1);
      expect(sweepResult.createdStrikesCount).toBe(1);

      // Verify booking status transitioned to no-show
      const updatedBooking = await FacilityBooking.findById(booking._id);
      expect(updatedBooking.status).toBe('no-show');

      // Verify NoShowStrike logged
      const strikeDoc = await NoShowStrike.findOne({ bookingId: booking._id });
      expect(strikeDoc).toBeDefined();
      expect(strikeDoc.studentId.toString()).toBe(student1._id.toString());

      // Seed 2 additional strikes within the 14-day rolling window
      await NoShowStrike.create([
        {
          collegeId: testCollege._id,
          studentId: student1._id,
          bookingId: new mongoose.Types.ObjectId(),
          createdAt: new Date('2026-10-14T10:00:00.000Z'),
        },
        {
          collegeId: testCollege._id,
          studentId: student1._id,
          bookingId: new mongoose.Types.ObjectId(),
          createdAt: new Date('2026-10-13T10:00:00.000Z'),
        },
      ]);

      // Verify student is now suspended
      const suspension = await facilityEngineService.checkSuspensionStatus(
        student1._id,
        testCollege._id,
        null,
        sweepNow
      );
      expect(suspension.isSuspended).toBe(true);
      expect(suspension.strikesCount).toBe(3);

      // Subsequent booking attempts must be blocked with HTTP 403
      const attemptNow = new Date('2026-10-16T13:30:00.000Z');
      await expect(
        facilityEngineService.confirmBooking({
          collegeId: testCollege._id,
          resourceId: testResource._id,
          studentId: student1._id,
          date: new Date('2026-10-16T00:00:00.000Z'),
          slotStart: new Date('2026-10-16T14:00:00.000Z'),
          slotEnd: new Date('2026-10-16T15:00:00.000Z'),
          referenceNow: attemptNow,
        })
      ).rejects.toThrow(/Booking privileges temporarily suspended/);
    });
  });

  describe('5. Admin Override Flow (Maintenance & Cascading Cancellation)', () => {
    it('should set resource to maintenance, auto-cancel conflicting bookings, and refund weekly usage', async () => {
      const slotDate = new Date('2026-10-16T00:00:00.000Z');
      const slotStart = new Date('2026-10-16T10:00:00.000Z');
      const slotEnd = new Date('2026-10-16T12:00:00.000Z'); // 2 hrs = 120 mins
      const baseNow = new Date('2026-10-16T09:30:00.000Z');

      // 1. Confirm a booking for student2
      const bookRes = await facilityEngineService.confirmBooking({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student2._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: baseNow,
      });
      expect(bookRes.success).toBe(true);

      const usageBefore = await FacilityUsageWeekly.findOne({
        collegeId: testCollege._id,
        studentId: student2._id,
        resourceType: 'workstation',
      });
      expect(usageBefore.minutesUsed).toBe(120);

      // 2. Admin marks resource for emergency maintenance
      const overrideRes = await facilityEngineService.adminOverrideResource({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        status: 'maintenance',
        notes: 'Hardware replacement for GPU',
        referenceNow: baseNow,
      });

      expect(overrideRes.success).toBe(true);
      expect(overrideRes.cancelledCount).toBe(1);

      // 3. Verify booking is cancelled with reason
      const cancelledBooking = await FacilityBooking.findById(bookRes.booking._id);
      expect(cancelledBooking.status).toBe('cancelled');
      expect(cancelledBooking.cancelReason).toContain('Hardware replacement');

      // 4. Verify weekly minutes refunded
      const usageAfter = await FacilityUsageWeekly.findOne({
        collegeId: testCollege._id,
        studentId: student2._id,
        resourceType: 'workstation',
      });
      expect(usageAfter.minutesUsed).toBe(0); // 120 - 120 = 0

      // 5. Verify notification generated for student
      const notif = await Notification.findOne({
        userId: student2._id,
        type: 'booking_cancelled',
      });
      expect(notif).toBeDefined();
      expect(notif.message).toContain('Hardware replacement');
    });
  });

  describe('6. Disciplinary Suspension Cascading Flow', () => {
    it('should revoke future bookings, release soft locks, and refund quota upon disciplinary suspension', async () => {
      const slotDate = new Date('2026-10-17T00:00:00.000Z');
      const slotStart = new Date('2026-10-17T10:00:00.000Z');
      const slotEnd = new Date('2026-10-17T11:00:00.000Z');
      const baseNow = new Date('2026-10-17T09:30:00.000Z');

      // Student 1 confirms a booking
      const bookRes = await facilityEngineService.confirmBooking({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student1._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: baseNow,
      });
      expect(bookRes.success).toBe(true);

      // Verify quota incremented to 60 mins
      const usageBefore = await FacilityUsageWeekly.findOne({
        collegeId: testCollege._id,
        studentId: student1._id,
        resourceType: 'workstation',
      });
      expect(usageBefore.minutesUsed).toBe(60);

      // Student gets college-wide disciplinary suspension
      const suspRes = await facilityEngineService.handleDisciplinarySuspension({
        studentId: student1._id,
        collegeId: testCollege._id,
        reason: 'Violation of Library Conduct Policy',
        referenceNow: baseNow,
      });

      expect(suspRes.success).toBe(true);
      expect(suspRes.cancelledCount).toBe(1);

      // Verify booking cancelled
      const bookingAfter = await FacilityBooking.findById(bookRes.booking._id);
      expect(bookingAfter.status).toBe('cancelled');
      expect(bookingAfter.cancelReason).toContain('Violation of Library Conduct Policy');

      // Verify quota refunded
      const usageAfter = await FacilityUsageWeekly.findOne({
        collegeId: testCollege._id,
        studentId: student1._id,
        resourceType: 'workstation',
      });
      expect(usageAfter.minutesUsed).toBe(0);

      // Slot is now immediately free for Student 2
      const bookRes2 = await facilityEngineService.confirmBooking({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student2._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: baseNow,
      });
      expect(bookRes2.success).toBe(true);
    });
  });

  describe('7. Resource Group Downsizing & Deletion Protection', () => {
    it('should reject deletion of resource group when active reservations exist', async () => {
      const slotDate = new Date('2026-10-18T00:00:00.000Z');
      const slotStart = new Date('2026-10-18T10:00:00.000Z');
      const slotEnd = new Date('2026-10-18T11:00:00.000Z');
      const baseNow = new Date('2026-10-18T09:30:00.000Z');

      await facilityEngineService.confirmBooking({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student1._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: baseNow,
      });

      // Attempt deletion while active reservation exists
      await expect(
        facilityEngineService.validateAndExecuteGroupDownsizeOrDelete({
          collegeId: testCollege._id,
          groupId: testGroup._id,
          isDelete: true,
          referenceNow: baseNow,
        })
      ).rejects.toThrow(/Cannot delete resource group with 1 active reservation/);
    });

    it('should gracefully downsize resource group, cancel bookings on removed units, and refund quota', async () => {
      const baseNow = new Date('2026-10-18T13:30:00.000Z');

      // Create extra resource PC-08 for group
      const extraResource = await FacilityResource.create({
        collegeId: testCollege._id,
        groupId: testGroup._id,
        label: 'PC-08',
        status: 'available',
      });

      // Book PC-08
      const slotDate = new Date('2026-10-18T00:00:00.000Z');
      const slotStart = new Date('2026-10-18T14:00:00.000Z');
      const slotEnd = new Date('2026-10-18T16:00:00.000Z'); // 120 mins

      const bookRes = await facilityEngineService.confirmBooking({
        collegeId: testCollege._id,
        resourceId: extraResource._id,
        studentId: student2._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: baseNow,
      });
      expect(bookRes.success).toBe(true);

      // Downsize group to 1 unit (decommissioning PC-08)
      const downsizeRes = await facilityEngineService.validateAndExecuteGroupDownsizeOrDelete({
        collegeId: testCollege._id,
        groupId: testGroup._id,
        targetUnits: 1,
        referenceNow: baseNow,
      });

      expect(downsizeRes.success).toBe(true);
      expect(downsizeRes.downsized).toBe(true);
      expect(downsizeRes.cancelledBookingsCount).toBe(1);

      // Verify PC-08 was removed
      const pc08Doc = await FacilityResource.findById(extraResource._id);
      expect(pc08Doc).toBeNull();

      // Verify PC-08 booking was cancelled with notification
      const bookingAfter = await FacilityBooking.findById(bookRes.booking._id);
      expect(bookingAfter.status).toBe('cancelled');
      expect(bookingAfter.cancelReason).toContain('capacity reconfiguration');
    });
  });

  describe('8. ReDoS and Search Query Regex Sanitization', () => {
    it('should safely handle regex special characters in resource label search', async () => {
      // Query with regex metacharacters: +*?()[]\
      const rawQuery = 'PC-.*+?[]^$';
      const results = await facilityEngineService.searchResources({
        collegeId: testCollege._id,
        labelQuery: rawQuery,
      });

      // Must execute cleanly without SyntaxError or ReDoS
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);

      // Query for actual PC-07 with partial match
      const validResults = await facilityEngineService.searchResources({
        collegeId: testCollege._id,
        labelQuery: 'PC-07',
      });
      expect(validResults.length).toBe(1);
      expect(validResults[0].label).toBe('PC-07');
    });
  });

  describe('9. Staff Proxy Booking & Unmetered Quota Exemption', () => {
    it('should allow staff to book beyond 12-hour limit for staff self-use', async () => {
      const baseNow = new Date('2026-10-15T08:00:00.000Z');
      const slotDate = new Date('2026-10-15T00:00:00.000Z');
      const { monday: weekStart } = facilityEngineService.getCollegeTimezoneWeekRange(
        testCollege.timezone,
        slotDate
      );

      // Pre-seed usage beyond weekly cap (720 minutes)
      await FacilityUsageWeekly.create({
        collegeId: testCollege._id,
        studentId: student1._id,
        resourceType: 'workstation',
        weekStart,
        minutesUsed: 720,
      });

      const slotStart = new Date('2026-10-15T19:00:00.000Z');
      const slotEnd = new Date('2026-10-15T21:00:00.000Z');

      // Staff member self-booking is exempt from student cap
      const staffBookRes = await facilityEngineService.confirmBooking({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student1._id,
        date: slotDate,
        slotStart,
        slotEnd,
        bookedByRole: 'college-admin',
        referenceNow: baseNow,
      });

      expect(staffBookRes.success).toBe(true);
      expect(staffBookRes.booking.status).toBe('confirmed');
    });
  });

  describe('10. Separate Caps Per Resource Type (§10.1)', () => {
    it('should independently enforce 12h workstation and 30h seat caps for the same student', async () => {
      const slotDate = new Date('2026-10-15T00:00:00.000Z');
      const baseNow = new Date('2026-10-15T13:30:00.000Z');
      const { monday: weekStart } = facilityEngineService.getCollegeTimezoneWeekRange(
        testCollege.timezone,
        slotDate
      );

      // 1. Pre-seed workstation cap exhausted: 720 minutes used (12 hours)
      await FacilityUsageWeekly.create({
        collegeId: testCollege._id,
        studentId: student1._id,
        resourceType: 'workstation',
        weekStart,
        minutesUsed: 720,
      });

      // 2. Student tries to book another workstation slot -> Rejected due to exhausted cap
      const pcStart = new Date('2026-10-15T14:00:00.000Z');
      const pcEnd = new Date('2026-10-15T15:00:00.000Z');
      await expect(
        facilityEngineService.confirmBooking({
          collegeId: testCollege._id,
          resourceId: testResource._id,
          studentId: student1._id,
          date: slotDate,
          slotStart: pcStart,
          slotEnd: pcEnd,
          referenceNow: baseNow,
        })
      ).rejects.toThrow(/Weekly quota exceeded for workstations/);

      // 3. Student books a Study Seat for 2 hours (120 minutes) -> Must SUCCEED under separate 30h cap
      const seatStart = new Date('2026-10-15T16:00:00.000Z');
      const seatEnd = new Date('2026-10-15T18:00:00.000Z');
      const seatRes = await facilityEngineService.confirmBooking({
        collegeId: testCollege._id,
        resourceId: testSeatResource._id,
        studentId: student1._id,
        date: slotDate,
        slotStart: seatStart,
        slotEnd: seatEnd,
        referenceNow: baseNow,
      });

      expect(seatRes.success).toBe(true);
      expect(seatRes.booking.status).toBe('confirmed');
      expect(seatRes.weeklyUsage.minutesUsed).toBe(120);
      expect(seatRes.weeklyUsage.remainingMinutes).toBe(1680); // 1800 - 120 = 1680 (30 hours)

      // Verify separate records exist in FacilityUsageWeekly
      const pcUsage = await FacilityUsageWeekly.findOne({
        collegeId: testCollege._id,
        studentId: student1._id,
        resourceType: 'workstation',
      });
      const seatUsage = await FacilityUsageWeekly.findOne({
        collegeId: testCollege._id,
        studentId: student1._id,
        resourceType: 'seat',
      });

      expect(pcUsage.minutesUsed).toBe(720);
      expect(seatUsage.minutesUsed).toBe(120);
    });
  });

  describe('11. Split Booking Horizons (§10.3)', () => {
    it('should reject workstation bookings > 1 hour ahead and accept <= 1 hour ahead', async () => {
      const slotDate = new Date('2026-10-15T00:00:00.000Z');
      const baseNow = new Date('2026-10-15T10:00:00.000Z');

      // Attempt booking 75 minutes in advance (11:15 AM) -> Must FAIL
      const tooEarlyStart = new Date('2026-10-15T11:15:00.000Z');
      const tooEarlyEnd = new Date('2026-10-15T12:15:00.000Z');
      await expect(
        facilityEngineService.confirmBooking({
          collegeId: testCollege._id,
          resourceId: testResource._id,
          studentId: student1._id,
          date: slotDate,
          slotStart: tooEarlyStart,
          slotEnd: tooEarlyEnd,
          referenceNow: baseNow,
        })
      ).rejects.toThrow(/Workstations can only be booked up to 1 hour\(s\) in advance/);

      // Attempt booking 40 minutes in advance (10:40 AM) -> Must SUCCEED
      const validStart = new Date('2026-10-15T10:40:00.000Z');
      const validEnd = new Date('2026-10-15T11:40:00.000Z');
      const okRes = await facilityEngineService.confirmBooking({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student1._id,
        date: slotDate,
        slotStart: validStart,
        slotEnd: validEnd,
        referenceNow: baseNow,
      });

      expect(okRes.success).toBe(true);
      expect(okRes.booking.status).toBe('confirmed');
    });

    it('should reject study seat bookings > 1 day ahead and accept <= 1 day ahead', async () => {
      const baseNow = new Date('2026-10-15T10:00:00.000Z');

      // Attempt booking 48 hours ahead (Oct 17, 10:00 AM) -> Must FAIL
      const futureDate = new Date('2026-10-17T00:00:00.000Z');
      const futureStart = new Date('2026-10-17T10:00:00.000Z');
      const futureEnd = new Date('2026-10-17T11:00:00.000Z');

      await expect(
        facilityEngineService.confirmBooking({
          collegeId: testCollege._id,
          resourceId: testSeatResource._id,
          studentId: student2._id,
          date: futureDate,
          slotStart: futureStart,
          slotEnd: futureEnd,
          referenceNow: baseNow,
        })
      ).rejects.toThrow(/Study seats can only be booked up to 1 day\(s\) in advance/);

      // Attempt booking 18 hours ahead (Oct 16, 04:00 AM) -> Must SUCCEED
      const validDate = new Date('2026-10-16T00:00:00.000Z');
      const validStart = new Date('2026-10-16T04:00:00.000Z');
      const validEnd = new Date('2026-10-16T05:00:00.000Z');

      const okRes = await facilityEngineService.confirmBooking({
        collegeId: testCollege._id,
        resourceId: testSeatResource._id,
        studentId: student2._id,
        date: validDate,
        slotStart: validStart,
        slotEnd: validEnd,
        referenceNow: baseNow,
      });

      expect(okRes.success).toBe(true);
      expect(okRes.booking.status).toBe('confirmed');
    });
  });

  describe('12. Unified Cancellation & No-Show Policy (§10.5)', () => {
    it('should refund weekly quota if cancelled >= 1 hour before slot start', async () => {
      const slotDate = new Date('2026-10-15T00:00:00.000Z');
      const slotStart = new Date('2026-10-15T15:00:00.000Z');
      const slotEnd = new Date('2026-10-15T16:00:00.000Z');
      const bookNow = new Date('2026-10-15T14:30:00.000Z');

      // Book 60-minute PC slot
      const bookRes = await facilityEngineService.confirmBooking({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student1._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: bookNow,
      });

      expect(bookRes.weeklyUsage.minutesUsed).toBe(60);

      // Cancel at 13:30 (90 minutes before slot start >= 60 minutes notice)
      const cancelTime = new Date('2026-10-15T13:30:00.000Z');
      const cancelRes = await facilityEngineService.cancelBooking({
        bookingId: bookRes.booking._id,
        studentId: student1._id,
        cancelReason: 'Plans changed early',
        referenceNow: cancelTime,
      });

      expect(cancelRes.success).toBe(true);
      expect(cancelRes.quotaRefunded).toBe(true);
      expect(cancelRes.booking.status).toBe('cancelled');

      // Verify quota refunded back to 0
      const usageDoc = await FacilityUsageWeekly.findOne({
        collegeId: testCollege._id,
        studentId: student1._id,
        resourceType: 'workstation',
      });
      expect(usageDoc.minutesUsed).toBe(0);
    });

    it('should NOT refund weekly quota if cancelled < 1 hour before slot start ("you booked it, you lose it")', async () => {
      const slotDate = new Date('2026-10-15T00:00:00.000Z');
      const slotStart = new Date('2026-10-15T15:00:00.000Z');
      const slotEnd = new Date('2026-10-15T16:00:00.000Z');
      const bookNow = new Date('2026-10-15T14:30:00.000Z');

      // Book 60-minute PC slot
      const bookRes = await facilityEngineService.confirmBooking({
        collegeId: testCollege._id,
        resourceId: testResource._id,
        studentId: student2._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: bookNow,
      });

      expect(bookRes.weeklyUsage.minutesUsed).toBe(60);

      // Cancel at 14:35 (25 minutes before slot start < 60 minutes notice)
      const lateCancelTime = new Date('2026-10-15T14:35:00.000Z');
      const cancelRes = await facilityEngineService.cancelBooking({
        bookingId: bookRes.booking._id,
        studentId: student2._id,
        cancelReason: 'Running late, cannot make it',
        referenceNow: lateCancelTime,
      });

      expect(cancelRes.success).toBe(true);
      expect(cancelRes.quotaRefunded).toBe(false);
      expect(cancelRes.booking.status).toBe('cancelled');
      expect(cancelRes.booking.cancelReason).toContain('weekly quota deducted');

      // Verify quota REMAINS deducted at 60 minutes
      const usageDoc = await FacilityUsageWeekly.findOne({
        collegeId: testCollege._id,
        studentId: student2._id,
        resourceType: 'workstation',
      });
      expect(usageDoc.minutesUsed).toBe(60);
    });
  });
});
