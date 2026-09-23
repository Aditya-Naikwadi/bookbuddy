/**
 * @testing-test-automation-engineer Test Suite:
 * Verify Facility / Lab Booking Side Effects Execute Outside Transaction
 *
 * Confirms:
 * 1. Post-commit side effects (streakService.recordQualifyingAction) execute strictly
 *    after booking transaction commits successfully.
 * 2. If the booking transaction aborts or fails (e.g. duplicate slot conflict, non-existent seat),
 *    zero side effects occur: streakService.recordQualifyingAction does NOT fire.
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');
const User = require('../models/User');
const College = require('../models/College');
const LabSeat = require('../models/LabSeat');
const LabBooking = require('../models/LabBooking');
const labBookingService = require('../services/labBookingService');
const streakService = require('../services/streakService');
const config = require('../config');

describe('@testing-test-automation-engineer: Facility / Lab Booking Side-Effects Isolation', () => {
  let testCollege;
  let studentUser;
  let testSeat;
  let validStart;
  let validEnd;
  let recordStreakSpy;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    const unique = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    testCollege = await College.create({
      name: 'Lab Side Effect College',
      code: 'LSEC_' + unique.replace('-', '_'),
      slug: 'lsec-' + unique,
      status: 'active',
    });

    studentUser = await User.create({
      studentId: 'STU_LAB_' + unique,
      name: 'Lab Test Student',
      email: `student_lab_${unique}@lsec.edu`,
      password: 'Password123!',
      role: 'student',
      collegeId: testCollege._id,
      status: 'active',
    });

    testSeat = await LabSeat.create({
      collegeId: testCollege._id,
      labName: 'CS Lab 1',
      seatNumber: 'S-101',
      resourceType: 'workstation',
      zoneName: 'Quiet Area',
      maintenanceStatus: 'operational',
    });

    // Configure a booking time 2 days from now, aligning with operating hours
    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() + 2);
    const startHour = Math.max(9, (config.labOperatingHours?.startHour || 8) + 1);
    targetDate.setUTCHours(startHour, 0, 0, 0);

    validStart = new Date(targetDate);
    validEnd = new Date(targetDate.getTime() + 60 * 60 * 1000);
  });

  afterAll(async () => {
    try {
      if (testCollege?._id) {
        await LabBooking.deleteMany({ collegeId: testCollege._id });
        await LabSeat.deleteMany({ collegeId: testCollege._id });
        await User.deleteMany({ collegeId: testCollege._id });
        await College.deleteMany({ _id: testCollege._id });
      }
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  beforeEach(() => {
    recordStreakSpy = jest
      .spyOn(streakService, 'recordQualifyingAction')
      .mockResolvedValue({ currentStreak: 3 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. Executes recordQualifyingAction AFTER booking transaction commits successfully', async () => {
    const result = await labBookingService.createBooking(
      studentUser._id,
      testSeat._id,
      testCollege._id,
      validStart,
      validEnd
    );

    expect(result).toBeDefined();
    expect(result.booking).toBeDefined();
    expect(result.booking.status).toBe('booked');

    // Confirm post-commit side effect executed
    expect(recordStreakSpy).toHaveBeenCalledTimes(1);
    expect(recordStreakSpy).toHaveBeenCalledWith(studentUser._id, testCollege._id, 'lab_booking');
  });

  it('2. Confirms NO streak recording occurs if booking transaction aborts on duplicate slot conflict', async () => {
    // Attempting to book the EXACT same slot on the same seat will trigger duplicate collision
    let threw = false;
    try {
      await labBookingService.createBooking(
        studentUser._id,
        testSeat._id,
        testCollege._id,
        validStart,
        validEnd
      );
    } catch (err) {
      threw = true;
      expect(err.message).toMatch(/already booked|overlapping time slot/i);
    }

    expect(threw).toBe(true);

    // Confirm side-effect NEVER fired on transaction abort
    expect(recordStreakSpy).not.toHaveBeenCalled();
  });

  it('3. Confirms NO streak recording occurs if booking seat does not exist', async () => {
    const fakeSeatId = new mongoose.Types.ObjectId();
    const anotherStart = new Date(validStart.getTime() + 2 * 3600000);
    const anotherEnd = new Date(anotherStart.getTime() + 3600000);

    let threw = false;
    try {
      await labBookingService.createBooking(
        studentUser._id,
        fakeSeatId,
        testCollege._id,
        anotherStart,
        anotherEnd
      );
    } catch (err) {
      threw = true;
      expect(err.message).toMatch(/seat not found/i);
    }

    expect(threw).toBe(true);
    expect(recordStreakSpy).not.toHaveBeenCalled();
  });
});
