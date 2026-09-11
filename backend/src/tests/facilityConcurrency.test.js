const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_facility_concurrency_test';
process.env.JWT_SECRET = 'testjwtfacilityconcurrencysecretkey123';
process.env.JWT_REFRESH_SECRET = 'testjwtfacilityconcurrencyrefreshsecretkey123';
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
const softLock = require('../utils/softLock');
const facilityEngineService = require('../services/facilityEngineService');

describe('Concurrency & Race Condition Load Tests (@testing-performance-benchmarker & @security-appsec-engineer)', () => {
  let testCollege;
  let students = [];
  let testGroup;
  let hotResource;

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

    await FacilityBooking.syncIndexes();
    await FacilityBookingQueue.syncIndexes();
    await FacilityUsageWeekly.syncIndexes();

    testCollege = await College.create({
      name: 'Concurrency Benchmark University',
      code: 'CBU',
      timezone: 'Asia/Kolkata',
      facilitySettings: {
        maxWeeklyWorkstationHours: 12,
        maxWeeklySeatHours: 30,
        workstationAdvanceHorizonHours: 1,
        seatAdvanceHorizonDays: 1,
      },
    });

    // Create 15 distinct students for concurrency bombardment
    for (let i = 1; i <= 15; i++) {
      const student = await User.create({
        studentId: `STU_CONCURRENCY_${i.toString().padStart(3, '0')}`,
        name: `Student Concurrency ${i}`,
        email: `student${i}@cbu.edu`,
        password: 'Password123!',
        role: 'student',
        collegeId: testCollege._id,
        status: 'active',
        isEmailVerified: true,
      });
      students.push(student);
    }

    testGroup = await FacilityResourceGroup.create({
      collegeId: testCollege._id,
      name: 'High-Demand GPU Lab',
      type: 'workstation',
      slotDurationMinutes: 60,
      bookingHorizon: 'shortLead1hr',
      totalUnits: 1,
    });

    hotResource = await FacilityResource.create({
      collegeId: testCollege._id,
      groupId: testGroup._id,
      label: 'GPU-H100-01',
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
  });

  it('should handle 10 simultaneous booking attempts on a hot slot: exactly 1 succeeds, 9 rejected, 0 DB duplicates', async () => {
    const slotDate = new Date('2026-10-25T00:00:00.000Z');
    const slotStart = new Date('2026-10-25T14:00:00.000Z');
    const slotEnd = new Date('2026-10-25T15:00:00.000Z');
    const baseNow = new Date('2026-10-25T13:30:00.000Z'); // 30m before start

    // Launch 10 simultaneous booking attempts in parallel via Promise.allSettled
    const attempts = students.slice(0, 10).map((student) =>
      facilityEngineService.confirmBooking({
        collegeId: testCollege._id,
        resourceId: hotResource._id,
        studentId: student._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: baseNow,
      })
    );

    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly 1 winner
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(9);

    // Verify database tier: exactly 1 confirmed record exists
    const bookingsInDb = await FacilityBooking.find({
      resourceId: hotResource._id,
      date: slotDate,
      slotStart,
      status: 'confirmed',
    });
    expect(bookingsInDb.length).toBe(1);
    expect(bookingsInDb[0].studentId.toString()).toBe(
      fulfilled[0].value.booking.studentId.toString()
    );

    // Verify rejection reasons
    for (const rej of rejected) {
      expect(rej.reason.message).toMatch(
        /(already been reserved|already been booked|Collision detected|E11000 duplicate key)/
      );
    }
  });

  it('should handle 10 simultaneous queue join attempts: assigns positions 1 to 10 with zero race duplicates', async () => {
    const slotDate = new Date('2026-10-25T00:00:00.000Z');
    const slotStart = new Date('2026-10-25T16:00:00.000Z');
    const slotEnd = new Date('2026-10-25T17:00:00.000Z');
    const baseNow = new Date('2026-10-25T15:30:00.000Z');

    // Launch 10 simultaneous queue joins for 10 distinct students
    const queueAttempts = students.slice(0, 10).map((student) =>
      facilityEngineService.joinBookingQueue({
        collegeId: testCollege._id,
        resourceGroupId: testGroup._id,
        resourceId: hotResource._id,
        studentId: student._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: baseNow,
      })
    );

    const results = await Promise.allSettled(queueAttempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(10);

    // Verify all positions in DB are distinct 1..10
    const queueEntries = await FacilityBookingQueue.find({
      resourceGroupId: testGroup._id,
      date: slotDate,
      slotStart,
      status: 'queued',
    }).sort({ queuePosition: 1 });

    expect(queueEntries.length).toBe(10);
    const positions = queueEntries.map((e) => e.queuePosition);
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
