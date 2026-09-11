const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_facility_queue_test';
process.env.JWT_SECRET = 'testjwtfacilityqueuesecretkey123';
process.env.JWT_REFRESH_SECRET = 'testjwtfacilityqueuerefreshsecretkey123';
process.env.JWT_ACCESS_EXPIRY = '10m';
process.env.JWT_REFRESH_EXPIRY = '7d';

jest.setTimeout(60000);

const College = require('../models/College');
const User = require('../models/User');
const FacilityResourceGroup = require('../models/FacilityResourceGroup');
const FacilityResource = require('../models/FacilityResource');
const FacilityBooking = require('../models/FacilityBooking');
const FacilityBookingQueue = require('../models/FacilityBookingQueue');
const FacilityUsageWeekly = require('../models/FacilityUsageWeekly');
const NoShowStrike = require('../models/NoShowStrike');
const Notification = require('../models/Notification');
const softLock = require('../utils/softLock');
const facilityEngineService = require('../services/facilityEngineService');

describe('Facility Booking Queue System (§10.4 & §11)', () => {
  let testCollege;
  let student1;
  let student2;
  let student3;
  let pcGroup;
  let pcResource;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    await College.deleteMany({});
    await User.deleteMany({});
    await FacilityResourceGroup.deleteMany({});
    await FacilityResource.deleteMany({});
    await FacilityBooking.deleteMany({});
    await FacilityBookingQueue.deleteMany({});
    await FacilityUsageWeekly.deleteMany({});
    await NoShowStrike.deleteMany({});
    await Notification.deleteMany({});

    await FacilityBooking.syncIndexes();
    await FacilityBookingQueue.syncIndexes();
    await FacilityUsageWeekly.syncIndexes();

    testCollege = await College.create({
      name: 'Queue Test University',
      code: 'QT-U',
      timezone: 'Asia/Kolkata',
      facilitySettings: {
        maxWeeklyWorkstationHours: 12,
        maxWeeklySeatHours: 30,
        workstationAdvanceHorizonHours: 1,
        seatAdvanceHorizonDays: 1,
        checkInGraceMinutes: 10,
        capScope: 'college',
      },
    });

    student1 = await User.create({
      studentId: 'STU_Q_001',
      name: 'Charlie Brown',
      email: 'charlie@qtu.edu',
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
      isEmailVerified: true,
    });

    student2 = await User.create({
      studentId: 'STU_Q_002',
      name: 'Dana Scully',
      email: 'dana@qtu.edu',
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
      isEmailVerified: true,
    });

    student3 = await User.create({
      studentId: 'STU_Q_003',
      name: 'Fox Mulder',
      email: 'fox@qtu.edu',
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
      isEmailVerified: true,
    });

    pcGroup = await FacilityResourceGroup.create({
      collegeId: testCollege._id,
      name: 'CAD Lab Alpha',
      type: 'workstation',
      slotDurationMinutes: 60,
      bookingHorizon: 'shortLead1hr',
      totalUnits: 1,
    });

    pcResource = await FacilityResource.create({
      collegeId: testCollege._id,
      groupId: pcGroup._id,
      label: 'CAD-01',
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
    await FacilityBookingQueue.deleteMany({});
    await FacilityUsageWeekly.deleteMany({});
    await NoShowStrike.deleteMany({});
    await Notification.deleteMany({});
  });

  describe('1. Queue Join & Position Ordering', () => {
    it('should assign sequential queue positions 1 and 2, and reject duplicate join for same slot', async () => {
      const slotDate = new Date('2026-10-20T00:00:00.000Z');
      const slotStart = new Date('2026-10-20T10:00:00.000Z');
      const slotEnd = new Date('2026-10-20T11:00:00.000Z');

      // Student 1 joins queue
      const q1 = await facilityEngineService.joinBookingQueue({
        collegeId: testCollege._id,
        resourceGroupId: pcGroup._id,
        resourceId: pcResource._id,
        studentId: student1._id,
        date: slotDate,
        slotStart,
        slotEnd,
      });

      expect(q1.success).toBe(true);
      expect(q1.queuePosition).toBe(1);
      expect(q1.aheadCount).toBe(0);

      // Student 2 joins queue
      const q2 = await facilityEngineService.joinBookingQueue({
        collegeId: testCollege._id,
        resourceGroupId: pcGroup._id,
        resourceId: pcResource._id,
        studentId: student2._id,
        date: slotDate,
        slotStart,
        slotEnd,
      });

      expect(q2.success).toBe(true);
      expect(q2.queuePosition).toBe(2);
      expect(q2.aheadCount).toBe(1);

      // Student 1 attempts to join queue AGAIN for the same slot -> 409 Rejected
      await expect(
        facilityEngineService.joinBookingQueue({
          collegeId: testCollege._id,
          resourceGroupId: pcGroup._id,
          resourceId: pcResource._id,
          studentId: student1._id,
          date: slotDate,
          slotStart,
          slotEnd,
        })
      ).rejects.toThrow(/already in the waitlist/);
    });
  });

  describe('2. Queue Leaving & Re-indexing', () => {
    it('should re-index remaining positions when a student leaves the queue', async () => {
      const slotDate = new Date('2026-10-20T00:00:00.000Z');
      const slotStart = new Date('2026-10-20T11:00:00.000Z');
      const slotEnd = new Date('2026-10-20T12:00:00.000Z');

      const q1 = await facilityEngineService.joinBookingQueue({
        collegeId: testCollege._id,
        resourceGroupId: pcGroup._id,
        studentId: student1._id,
        date: slotDate,
        slotStart,
        slotEnd,
      });

      const q2 = await facilityEngineService.joinBookingQueue({
        collegeId: testCollege._id,
        resourceGroupId: pcGroup._id,
        studentId: student2._id,
        date: slotDate,
        slotStart,
        slotEnd,
      });

      const q3 = await facilityEngineService.joinBookingQueue({
        collegeId: testCollege._id,
        resourceGroupId: pcGroup._id,
        studentId: student3._id,
        date: slotDate,
        slotStart,
        slotEnd,
      });

      expect(q1.queuePosition).toBe(1);
      expect(q2.queuePosition).toBe(2);
      expect(q3.queuePosition).toBe(3);

      // Student 2 leaves queue
      const leaveRes = await facilityEngineService.leaveBookingQueue({
        queueId: q2.queueEntry._id,
        studentId: student2._id,
      });
      expect(leaveRes.success).toBe(true);

      // Verify Student 3 is now promoted to position 2
      const updatedQ3 = await FacilityBookingQueue.findById(q3.queueEntry._id);
      expect(updatedQ3.queuePosition).toBe(2);

      // Student 1 remains position 1
      const updatedQ1 = await FacilityBookingQueue.findById(q1.queueEntry._id);
      expect(updatedQ1.queuePosition).toBe(1);
    });
  });

  describe('3. Promotion on Cancellation Flow', () => {
    it('should promote the next student in line when a booking is cancelled', async () => {
      const slotDate = new Date('2026-10-20T00:00:00.000Z');
      const slotStart = new Date('2026-10-20T14:00:00.000Z');
      const slotEnd = new Date('2026-10-20T15:00:00.000Z');
      const baseNow = new Date('2026-10-20T13:30:00.000Z');

      // 1. Student 1 confirms booking
      const bookRes = await facilityEngineService.confirmBooking({
        collegeId: testCollege._id,
        resourceId: pcResource._id,
        studentId: student1._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: baseNow,
      });
      expect(bookRes.success).toBe(true);

      // 2. Student 2 joins queue for this slot
      const qRes = await facilityEngineService.joinBookingQueue({
        collegeId: testCollege._id,
        resourceGroupId: pcGroup._id,
        resourceId: pcResource._id,
        studentId: student2._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: baseNow,
      });
      expect(qRes.queuePosition).toBe(1);

      // 3. Student 1 cancels booking at 13:40 (advance notice)
      const cancelTime = new Date('2026-10-20T13:40:00.000Z');
      await facilityEngineService.cancelBooking({
        bookingId: bookRes.booking._id,
        studentId: student1._id,
        referenceNow: cancelTime,
      });

      // 4. Verify Student 2 was promoted with 10-minute confirmation window
      const promotedTicket = await FacilityBookingQueue.findById(qRes.queueEntry._id);
      expect(promotedTicket.status).toBe('ready_to_confirm');
      expect(promotedTicket.promotedAt).toBeDefined();
      expect(promotedTicket.expiresAt).toEqual(new Date(cancelTime.getTime() + 10 * 60 * 1000));

      // 5. Student 2 claims spot within 10 minutes (at 13:45)
      const claimTime = new Date('2026-10-20T13:45:00.000Z');
      const claimRes = await facilityEngineService.claimPromotedQueueSpot({
        queueId: promotedTicket._id,
        studentId: student2._id,
        referenceNow: claimTime,
      });

      expect(claimRes.success).toBe(true);
      expect(claimRes.booking.status).toBe('confirmed');
      expect(claimRes.booking.studentId.toString()).toBe(student2._id.toString());

      // Verify ticket status is now 'confirmed'
      const finalTicket = await FacilityBookingQueue.findById(promotedTicket._id);
      expect(finalTicket.status).toBe('confirmed');
    });
  });

  describe('4. Auto-Expiration & Cascade Promotion Flow', () => {
    it('should expire unclaimed promotions after 10 minutes and promote the next person in line', async () => {
      const slotDate = new Date('2026-10-20T00:00:00.000Z');
      const slotStart = new Date('2026-10-20T16:00:00.000Z');
      const slotEnd = new Date('2026-10-20T17:00:00.000Z');
      const baseNow = new Date('2026-10-20T15:30:00.000Z');

      // Student 1 and Student 2 join queue
      const q1 = await facilityEngineService.joinBookingQueue({
        collegeId: testCollege._id,
        resourceGroupId: pcGroup._id,
        resourceId: pcResource._id,
        studentId: student1._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: baseNow,
      });

      const q2 = await facilityEngineService.joinBookingQueue({
        collegeId: testCollege._id,
        resourceGroupId: pcGroup._id,
        resourceId: pcResource._id,
        studentId: student2._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: baseNow,
      });

      // Promote Student 1 manually at 15:30
      await facilityEngineService.promoteNextInQueue({
        collegeId: testCollege._id,
        resourceGroupId: pcGroup._id,
        resourceId: pcResource._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: baseNow,
      });

      const ticket1 = await FacilityBookingQueue.findById(q1.queueEntry._id);
      expect(ticket1.status).toBe('ready_to_confirm');

      // Fast-forward 11 minutes (15:41) past the 10-minute expiry
      const sweepNow = new Date('2026-10-20T15:41:00.000Z');
      const expireRes = await facilityEngineService.autoExpireQueuePromotions(sweepNow);
      expect(expireRes.expiredCount).toBe(1);

      // Verify Student 1's ticket is expired
      const expiredTicket1 = await FacilityBookingQueue.findById(ticket1._id);
      expect(expiredTicket1.status).toBe('expired');

      // Verify Student 2 is now automatically promoted!
      const ticket2 = await FacilityBookingQueue.findById(q2.queueEntry._id);
      expect(ticket2.status).toBe('ready_to_confirm');
      expect(ticket2.expiresAt).toEqual(new Date(sweepNow.getTime() + 10 * 60 * 1000));
    });
  });
});
