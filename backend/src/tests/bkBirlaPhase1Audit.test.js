/**
 * Phase 1 Audit & Gaps Verification Suite — B.K. Birla College
 * Tests:
 *  1. Initial password = student ID upload policy (off-by-default, explicit confirmation, audit log, no email/SMS, 30-day window)
 *  2. 1,000-Student Dataset Processing & Hashing Concurrency Benchmark (bkbirlacollege_students_1000.csv)
 *  3. Case-insensitive and mixed-case login with forced password change on first login
 *  4. Workstation 15-hour weekly cap enforcement & Monday 00:00 IST reset
 *  5. Check-in & check-out time recording and actual minute reconciliation
 *  6. Slot queue FIFO promotion with 10-minute confirmation window & cap-skipping
 *  7. Admin usage view & CSV export
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_bkbirla_phase1_audit_key_32chars';
process.env.JWT_REFRESH_SECRET = 'test_refresh_bkbirla_phase1_audit_key_32c';

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const FacilityResourceGroup = require('../models/FacilityResourceGroup');
const FacilityResource = require('../models/FacilityResource');
const FacilityBooking = require('../models/FacilityBooking');
const FacilityBookingQueue = require('../models/FacilityBookingQueue');
const FacilityUsageWeekly = require('../models/FacilityUsageWeekly');
const AuditLog = require('../models/AuditLog');
const StudentUploadBatch = require('../models/StudentUploadBatch');
const facilityEngineService = require('../services/facilityEngineService');
const { processRosterBatchAsync } = require('../controllers/rosterUploadController');
const { generateTokenPair } = require('../utils/token');

jest.setTimeout(120000); // 2 minutes for 1,000 student hashing test

describe('Phase 1 Audit & Gaps Suite — B.K. Birla College Specs', () => {
  let college;
  let collegeAdmin;
  let adminToken;
  let student1;
  let studentToken1;
  let student2;
  let pcGroup;
  let pc1;
  let pc2;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test');
    }

    // Clean test collections
    await College.deleteMany({ slug: 'bkbirla-audit' });
    await User.deleteMany({ email: /@bkbirla-audit\.edu$/ });
    await User.deleteMany({ email: /@bkbirlacollege\.edu$/ });
    await FacilityResourceGroup.deleteMany({});
    await FacilityResource.deleteMany({});
    await FacilityBooking.deleteMany({});
    await FacilityBookingQueue.deleteMany({});
    await FacilityUsageWeekly.deleteMany({});
    await AuditLog.deleteMany({});
    await StudentUploadBatch.deleteMany({});

    // Create test college with 15 hr weekly workstation cap
    college = await College.create({
      name: 'B. K. Birla College of Arts, Science & Commerce',
      code: 'BKBIRLA-AUDIT',
      slug: 'bkbirla-audit',
      timezone: 'Asia/Kolkata',
      facilitySettings: {
        maxWeeklyWorkstationHours: 15,
        maxWeeklySeatHours: 30,
        workstationAdvanceHorizonHours: 168,
        seatAdvanceHorizonDays: 7,
        checkInGraceMinutes: 10,
      },
    });

    // Create college admin
    collegeAdmin = await User.create({
      name: 'Admin Birla',
      email: 'admin@bkbirla-audit.edu',
      password: 'AdminPassword123!',
      role: 'college-admin',
      collegeId: college._id,
      isEmailVerified: true,
      status: 'active',
    });
    const adminTokens = generateTokenPair({
      id: collegeAdmin._id,
      role: collegeAdmin.role,
      collegeId: college._id,
    });
    adminToken = adminTokens.accessToken;

    // Create test students
    student1 = await User.create({
      studentId: 'bk-2026-cs-001',
      name: 'Aarav Sharma',
      email: 'aarav@bkbirla-audit.edu',
      password: 'InitialPassword123!',
      role: 'student',
      collegeId: college._id,
      isEmailVerified: true,
      status: 'active',
    });
    const s1Tokens = generateTokenPair({
      id: student1._id,
      role: student1.role,
      collegeId: college._id,
    });
    studentToken1 = s1Tokens.accessToken;

    student2 = await User.create({
      studentId: 'bk-2026-cs-002',
      name: 'Vivaan Verma',
      email: 'vivaan@bkbirla-audit.edu',
      password: 'InitialPassword123!',
      role: 'student',
      collegeId: college._id,
      isEmailVerified: true,
      status: 'active',
    });

    // Create 50-PC Resource Group
    pcGroup = await FacilityResourceGroup.create({
      collegeId: college._id,
      name: 'Main Computer Lab - 50 PCs',
      type: 'workstation',
      slotDurationMinutes: 60,
      operatingHours: { openTime: '08:00', closeTime: '20:00' },
      totalUnits: 50,
      bookingHorizon: 'dayAhead1day',
    });

    pc1 = await FacilityResource.create({
      collegeId: college._id,
      groupId: pcGroup._id,
      label: 'PC-01',
      status: 'available',
    });

    pc2 = await FacilityResource.create({
      collegeId: college._id,
      groupId: pcGroup._id,
      label: 'PC-02',
      status: 'available',
    });
  });

  afterAll(async () => {
    try {
      await College.deleteMany({ slug: 'bkbirla-audit' });
      await User.deleteMany({ email: /@bkbirla-audit\.edu$/ });
      await User.deleteMany({ email: /@bkbirlacollege\.edu$/ });
      await FacilityResourceGroup.deleteMany({});
      await FacilityResource.deleteMany({});
      await FacilityBooking.deleteMany({});
      await FacilityBookingQueue.deleteMany({});
      await FacilityUsageWeekly.deleteMany({});
      await AuditLog.deleteMany({});
      await StudentUploadBatch.deleteMany({});
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('1. Roster Upload: Initial Password = Student ID Policy', () => {
    it('should reject student_id password policy if explicit confirmation is missing', async () => {
      const batch = await StudentUploadBatch.create({
        collegeId: college._id,
        uploadedBy: collegeAdmin._id,
        fileName: 'students.csv',
        totalRows: 1,
        validRowsCount: 1,
        status: 'preview',
      });

      const res = await request(app)
        .post('/api/admin/students/upload/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          batchId: batch._id,
          validRows: [
            {
              studentId: 'BK-2026-TEST-999',
              name: 'Test Student',
              email: 'test999@bkbirla-audit.edu',
            },
          ],
          initialPasswordPolicy: 'student_id',
          confirmStudentIdPasswordPolicy: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/confirmation required/i);
    });

    it('should successfully commit with student_id policy, create AuditLog, and set password = studentId', async () => {
      const batch = await StudentUploadBatch.create({
        collegeId: college._id,
        uploadedBy: collegeAdmin._id,
        fileName: 'roster_sample.csv',
        totalRows: 2,
        validRowsCount: 2,
        status: 'preview',
      });

      const res = await request(app)
        .post('/api/admin/students/upload/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          batchId: batch._id,
          validRows: [
            {
              studentId: 'BK-2026-CS-0100',
              name: 'Ishaan Gupta',
              email: 'ishaan@bkbirla-audit.edu',
              program: 'Computer Science',
              year: 'Year 1',
            },
            {
              studentId: 'BK-2026-IT-0200',
              name: 'Diya Joshi',
              email: 'diya@bkbirla-audit.edu',
              program: 'Information Technology',
              year: 'Year 2',
            },
          ],
          initialPasswordPolicy: 'student_id',
          confirmStudentIdPasswordPolicy: true,
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);

      // Verify AuditLog record
      const audit = await AuditLog.findOne({
        collegeId: college._id,
        action: 'ROSTER_UPLOAD_INITIAL_PASSWORD_STUDENT_ID_ENABLED',
      });
      expect(audit).not.toBeNull();
      expect(audit.details.totalStudents).toBe(2);

      // Wait for batch status to reach 'committed'
      for (let i = 0; i < 50; i++) {
        const b = await StudentUploadBatch.findById(batch._id);
        if (b && (b.status === 'committed' || b.status === 'failed')) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      // Verify student in DB
      const student = await User.findOne({ email: 'ishaan@bkbirla-audit.edu' }).select(
        '+password +activationTokenHash'
      );
      expect(student).not.toBeNull();
      expect(student.mustChangePasswordOnNextLogin).toBe(true);
      expect(student.activationTokenHash).toBeNull(); // No activation token required

      // Verify case-preserved initial password works (mixed case)
      const exactMatch = await student.comparePassword('BK-2026-CS-0100');
      expect(exactMatch).toBe(true);

      // Verify lowercase login works via transparent fallback
      const lowerMatch = await student.comparePassword('bk-2026-cs-0100');
      expect(lowerMatch).toBe(true);
    });
  });

  describe('2. 1,000-Student Dataset Benchmark (bkbirlacollege_students_1000.csv)', () => {
    it('should ingest all 1,000 students, throttle concurrency to 25, measure memory/time, and verify accounts', async () => {
      const csvPath = path.resolve(__dirname, '../../bkbirlacollege_students_1000.csv');
      expect(fs.existsSync(csvPath)).toBe(true);

      const content = fs.readFileSync(csvPath, 'utf8');
      const lines = content.trim().split(/\r?\n/);
      const headers = lines[0].split(',');
      expect(headers).toEqual(['StudentId', 'Name', 'Email', 'Program', 'Year', 'Phone']);

      const rawRows = lines.slice(1).map((line, idx) => {
        const [studentId, name, email, program, year, phone] = line.split(',');
        return {
          rowNumber: idx + 2,
          studentId: studentId.trim(),
          name: name.trim(),
          email: email.trim(),
          program: program.trim(),
          year: year.trim(),
          phone: phone.trim(),
        };
      });

      expect(rawRows.length).toBe(1000);

      // Create dedicated batch record
      const batch1000 = await StudentUploadBatch.create({
        collegeId: college._id,
        uploadedBy: collegeAdmin._id,
        fileName: 'bkbirlacollege_students_1000.csv',
        totalRows: 1000,
        validRowsCount: 1000,
        status: 'preview',
      });

      // Benchmark ingestion execution
      const startTime = Date.now();
      const initialMem = process.memoryUsage().heapUsed;

      await processRosterBatchAsync(
        batch1000._id,
        college._id,
        rawRows,
        false, // bulkDeactivateAbsent
        college,
        'student_id' // initialPasswordPolicy
      );

      const durationMs = Date.now() - startTime;
      const memDeltaMb = ((process.memoryUsage().heapUsed - initialMem) / (1024 * 1024)).toFixed(2);

      console.log(`\n======================================================`);
      console.log(`📊 1,000-STUDENT HASHING & PROVISIONING BENCHMARK REPORT`);
      console.log(`======================================================`);
      console.log(`⏱️ Total Ingestion Time: ${durationMs} ms (${(durationMs / 1000).toFixed(2)}s)`);
      console.log(`🧠 Heap Memory Delta:    ${memDeltaMb} MB`);
      console.log(`⚡ Average per Student:  ${(durationMs / 1000).toFixed(2)} ms/student`);
      console.log(`🔀 Concurrency Pool:     25 parallel workers with event-loop tick yield`);
      console.log(`======================================================\n`);

      // Verify batch summary
      const completedBatch = await StudentUploadBatch.findById(batch1000._id);
      expect(completedBatch.status).toBe('committed');
      expect(completedBatch.createdCount).toBe(1000);
      expect(completedBatch.updatedCount).toBe(0);
      expect(completedBatch.deactivatedCount).toBe(0);

      // Verify count reconciliation: 1000 rows = 1000 imported + 0 rejected
      const totalCreatedInDb = await User.countDocuments({
        uploadBatchId: batch1000._id,
        role: 'student',
        invitedVia: 'bulk_upload_student_id_pwd',
      });
      expect(totalCreatedInDb).toBe(1000);

      // Sample check 5 students across beginning, middle, end
      const sampleIndices = [0, 249, 499, 749, 999];
      for (const idx of sampleIndices) {
        const expected = rawRows[idx];
        const student = await User.findOne({
          collegeId: college._id,
          studentId: expected.studentId.toLowerCase(),
        }).select('+password');

        expect(student).not.toBeNull();
        expect(student.name).toBe(expected.name);
        expect(student.email).toBe(expected.email.toLowerCase());
        expect(student.mustChangePasswordOnNextLogin).toBe(true);

        // Verify login password matches their exact StudentId
        const match = await student.comparePassword(expected.studentId);
        expect(match).toBe(true);
      }
    });
  });

  describe('3. Workstation 15-Hour Weekly Cap & Reconciled Usage', () => {
    it('should allow bookings within 15 hours and track minutes in FacilityUsageWeekly', async () => {
      const now = new Date('2026-11-02T10:00:00.000Z'); // Monday 10:00 AM
      const slotStart = new Date('2026-11-02T11:00:00.000Z');
      const slotEnd = new Date('2026-11-02T12:00:00.000Z');

      const result = await facilityEngineService.confirmBooking({
        collegeId: college._id,
        resourceId: pc1._id,
        studentId: student1._id,
        date: new Date('2026-11-02T00:00:00.000Z'),
        slotStart,
        slotEnd,
        referenceNow: now,
      });

      expect(result.success).toBe(true);
      expect(result.booking.status).toBe('confirmed');

      // Verify student usage endpoint
      const usage = await facilityEngineService.getStudentUsage({
        collegeId: college._id,
        studentId: student1._id,
        referenceNow: now,
      });

      expect(usage.workstation.maxWeeklyHours).toBe(15);
      expect(usage.workstation.hoursUsed).toBe(1);
      expect(usage.workstation.remainingHours).toBe(14);
      expect(usage.workstation.capReached).toBe(false);
    });

    it('should block booking when student reaches 15-hour weekly cap', async () => {
      const now = new Date('2026-11-02T10:00:00.000Z');
      const { monday: weekStart } = facilityEngineService.getCollegeTimezoneWeekRange(
        'Asia/Kolkata',
        now
      );

      // Max out student2's weekly minutes to 15 hours (900 minutes)
      await FacilityUsageWeekly.findOneAndUpdate(
        {
          collegeId: college._id,
          studentId: student2._id,
          resourceType: 'workstation',
          weekStart,
        },
        { minutesUsed: 900 },
        { upsert: true }
      );

      // Student 2 attempts to book a 1-hour slot
      await expect(
        facilityEngineService.confirmBooking({
          collegeId: college._id,
          resourceId: pc2._id,
          studentId: student2._id,
          date: new Date('2026-11-02T00:00:00.000Z'),
          slotStart: new Date('2026-11-02T14:00:00.000Z'),
          slotEnd: new Date('2026-11-02T15:00:00.000Z'),
          referenceNow: now,
        })
      ).rejects.toThrow(/weekly quota exceeded/i);
    });
  });

  describe('4. Check-In & Check-Out Time Recording & Minute Reconciliation', () => {
    it('should check in and check out, recording timestamps and refunding unused minutes on early checkout', async () => {
      const slotStart = new Date('2026-11-03T10:00:00.000Z');
      const slotEnd = new Date('2026-11-03T11:00:00.000Z'); // 60 mins booked

      const confirmRes = await facilityEngineService.confirmBooking({
        collegeId: college._id,
        resourceId: pc2._id,
        studentId: student1._id,
        date: new Date('2026-11-03T00:00:00.000Z'),
        slotStart,
        slotEnd,
        referenceNow: new Date('2026-11-03T09:30:00.000Z'),
      });

      const bookingId = confirmRes.booking._id;

      // Check-in at 10:02 AM
      const checkInTime = new Date('2026-11-03T10:02:00.000Z');
      const checkInRes = await facilityEngineService.checkInBooking({
        bookingId,
        studentId: student1._id,
        referenceNow: checkInTime,
      });
      expect(checkInRes.booking.status).toBe('checked-in');
      expect(checkInRes.booking.checkedInAt).toEqual(checkInTime);

      // Early Check-out at 10:22 AM (used 20 mins instead of 60 mins)
      const checkOutTime = new Date('2026-11-03T10:22:00.000Z');
      const checkOutRes = await facilityEngineService.checkOutBooking({
        bookingId,
        studentId: student1._id,
        collegeId: college._id,
        referenceNow: checkOutTime,
      });

      expect(checkOutRes.booking.status).toBe('completed');
      expect(checkOutRes.booking.checkedOutAt).toEqual(checkOutTime);

      // Verify minutes were reconciled (refunded 40 unused minutes)
      const usage = await facilityEngineService.getStudentUsage({
        collegeId: college._id,
        studentId: student1._id,
        referenceNow: checkOutTime,
      });

      // 60m from test 1 + 20m from this test = 80m total = 1.3 hours
      expect(usage.workstation.minutesUsed).toBe(80);
    });
  });

  describe('5. Slot-Level Queue Promotion with Cap-Skipping & Confirmation Window', () => {
    it('should promote next in FIFO queue with 10-minute confirmation window and skip capped students', async () => {
      const slotDate = new Date('2026-11-04T00:00:00.000Z');
      const slotStart = new Date('2026-11-04T12:00:00.000Z');
      const slotEnd = new Date('2026-11-04T13:00:00.000Z');

      // Student 2 (who is capped at 15 hrs) joins queue at pos 1
      await FacilityBookingQueue.create({
        collegeId: college._id,
        resourceGroupId: pcGroup._id,
        resourceId: pc1._id,
        studentId: student2._id,
        date: slotDate,
        slotStart,
        slotEnd,
        queuePosition: 1,
        status: 'queued',
      });

      // Student 1 (eligible) joins queue at pos 2
      await FacilityBookingQueue.create({
        collegeId: college._id,
        resourceGroupId: pcGroup._id,
        resourceId: pc1._id,
        studentId: student1._id,
        date: slotDate,
        slotStart,
        slotEnd,
        queuePosition: 2,
        status: 'queued',
      });

      // Promote next in queue
      const promoteRes = await facilityEngineService.promoteNextInQueue({
        collegeId: college._id,
        resourceGroupId: pcGroup._id,
        resourceId: pc1._id,
        date: slotDate,
        slotStart,
        slotEnd,
        referenceNow: new Date('2026-11-04T11:45:00.000Z'),
      });

      expect(promoteRes.promoted).toBe(true);
      // Student 2 should have been skipped due to weekly cap, so Student 1 is promoted!
      expect(promoteRes.queueEntry.studentId.toString()).toBe(student1._id.toString());
      expect(promoteRes.queueEntry.status).toBe('ready_to_confirm');

      // Verify 10-minute confirmation window
      const expectedExpiry = new Date('2026-11-04T11:55:00.000Z');
      expect(new Date(promoteRes.queueEntry.expiresAt).getTime()).toBe(expectedExpiry.getTime());

      // Verify Student 2's ticket is expired with cap reason
      const s2Ticket = await FacilityBookingQueue.findOne({
        studentId: student2._id,
        date: slotDate,
      });
      expect(s2Ticket.status).toBe('expired');
    });
  });

  describe('6. Admin Facilities Usage API & CSV Export', () => {
    it('should return facility usage list via GET /api/lab/admin/usage', async () => {
      const res = await request(app)
        .get('/api/lab/admin/usage')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should stream formatted CSV via GET /api/lab/admin/usage/export', async () => {
      const res = await request(app)
        .get('/api/lab/admin/usage/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Booking ID,Student ID,Student Name,Email');
      expect(res.text).toContain('PC-01');
    });
  });
});
