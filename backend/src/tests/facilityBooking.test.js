/**
 * Consolidated Suite: facility Booking
 * Merged from:
 *  - facilities.test.js
 *  - facilityConcurrency.test.js
 *  - facilityEngine.test.js
 *  - facilityQueue.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('facility Booking Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: facilities.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_facilities_test';
    process.env.JWT_SECRET = 'testjwtfacilitiessecretkey999';
    process.env.JWT_REFRESH_SECRET = 'testjwtfacilitiesrefreshsecretkey999';
    process.env.JWT_ACCESS_EXPIRY = '10m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    // raised from default 30s: multi-step integration test, verified slow under coverage instrumentation only, see 2026-07-15 audit
    jest.setTimeout(90000);

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const LabSeat = require('../models/LabSeat');
    const LabBooking = require('../models/LabBooking');
    const BookSuggestion = require('../models/BookSuggestion');
    const Feedback = require('../models/Feedback');
    const Complaint = require('../models/Complaint');
    const { generateTokenPair } = require('../utils/token');

    describe('Phase 4 — Facilities & Engagement Integration Tests', () => {
      let collegeA;
      let collegeB;
      let adminA;
      let studentA;
      let studentB;
      let tokenAdminA;
      let tokenStudentA;
      let tokenStudentB;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }

        // Clean DB
        await College.deleteMany({});
        await User.deleteMany({});
        await LabSeat.deleteMany({});
        await LabBooking.deleteMany({});
        await BookSuggestion.deleteMany({});
        await Feedback.deleteMany({});
        await Complaint.deleteMany({});

        await LabBooking.syncIndexes();

        // Seed Colleges
        collegeA = await College.create({
          name: 'Facilities College A',
          code: 'FCA',
          selectedServices: ['facilities_booking', 'catalog_management'],
          enabledFeatures: ['facilities_booking', 'catalog_management'],
        });
        collegeB = await College.create({
          name: 'Facilities College B',
          code: 'FCB',
          selectedServices: ['facilities_booking', 'catalog_management'],
          enabledFeatures: ['facilities_booking', 'catalog_management'],
        });

        // Seed Admins
        adminA = await User.create({
          studentId: 'ADM_FAC_001',
          name: 'Admin A',
          email: 'admin.a@facilities.com',
          password: 'password123',
          role: 'college-admin',
          collegeId: collegeA._id,
        });
        await User.create({
          studentId: 'ADM_FAC_002',
          name: 'Admin B',
          email: 'admin.b@facilities.com',
          password: 'password123',
          role: 'college-admin',
          collegeId: collegeB._id,
        });

        // Seed Students
        studentA = await User.create({
          studentId: 'STU_FAC_001',
          name: 'Student A',
          email: 'student.a@facilities.com',
          password: 'password123',
          role: 'student',
          collegeId: collegeA._id,
        });
        studentB = await User.create({
          studentId: 'STU_FAC_002',
          name: 'Student B',
          email: 'student.b@facilities.com',
          password: 'password123',
          role: 'student',
          collegeId: collegeB._id,
        });

        // Generate JWTs
        tokenAdminA = generateTokenPair(adminA).accessToken;
        tokenStudentA = generateTokenPair(studentA).accessToken;
        tokenStudentB = generateTokenPair(studentB).accessToken;
      });

      afterAll(async () => {
        await mongoose.connection.db.dropDatabase();
        // await // mongoose.connection.close();
      });

      describe('Lab Seats & Booking Concurrency', () => {
        let seatA;
        let seatMaintenance;

        beforeAll(async () => {
          // Create seats for College A
          seatA = await LabSeat.create({
            collegeId: collegeA._id,
            labName: 'Lab A',
            seatNumber: '01',
            specs: 'i7, 16GB RAM',
            maintenanceStatus: 'operational',
          });

          seatMaintenance = await LabSeat.create({
            collegeId: collegeA._id,
            labName: 'Lab A',
            seatNumber: '02',
            specs: 'Broken specs',
            maintenanceStatus: 'maintenance',
          });
        });

        // 1. THE COLLISION TEST
        it('1. should prove timeslot double-booking race is handled atomically (only one succeeds, returns 409)', async () => {
          const startTime = '2026-08-01T10:00:00.000Z';
          const endTime = '2026-08-01T11:00:00.000Z';

          // Submit 2 concurrent requests for the exact same seat and timeslot
          const req1 = request(app)
            .post('/api/v1/dashboards/student/lab-bookings')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              seatId: seatA._id.toString(),
              startTime,
              endTime,
            });

          const req2 = request(app)
            .post('/api/v1/dashboards/student/lab-bookings')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              seatId: seatA._id.toString(),
              startTime,
              endTime,
            });

          const results = await Promise.all([req1, req2]);

          const successCount = results.filter((r) => r.status === 201).length;
          const collisionCount = results.filter((r) => r.status === 409).length;

          expect(successCount).toBe(1);
          expect(collisionCount).toBe(1);

          // Verify the body of the collision request contains 'slot already booked' or seat collision message
          const collisionResult = results.find((r) => r.status === 409);
          expect(collisionResult.body.message).toMatch(
            /slot already booked|already exists|overlapping time slot/i
          );

          // Verify DB contains exactly 1 booked reservation
          const dbBookings = await LabBooking.find({
            seatId: seatA._id,
            startTime: new Date(startTime),
            status: 'booked',
          });
          expect(dbBookings.length).toBe(1);
        });

        // 2. Non-overlapping bookings on the same day both succeed
        it('2. should allow non-overlapping bookings for the same seat on the same day to both succeed', async () => {
          const startTime1 = '2026-08-01T12:00:00.000Z';
          const endTime1 = '2026-08-01T13:00:00.000Z';
          const startTime2 = '2026-08-01T13:00:00.000Z'; // consecutive slot
          const endTime2 = '2026-08-01T14:00:00.000Z';

          const res1 = await request(app)
            .post('/api/v1/dashboards/student/lab-bookings')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              seatId: seatA._id.toString(),
              startTime: startTime1,
              endTime: endTime1,
            });

          const res2 = await request(app)
            .post('/api/v1/dashboards/student/lab-bookings')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              seatId: seatA._id.toString(),
              startTime: startTime2,
              endTime: endTime2,
            });

          expect(res1.status).toBe(201);
          expect(res2.status).toBe(201);

          const dbBookings = await LabBooking.find({
            seatId: seatA._id,
            date: new Date('2026-08-01T00:00:00.000Z'),
            status: 'booked',
          });
          // 1 from collision test + 2 from this test = 3 bookings
          expect(dbBookings.length).toBe(3);
        });

        // 3. Booking a seat in "maintenance" status is rejected
        it('3. should reject booking a seat that is in maintenance status', async () => {
          const startTime = '2026-08-01T15:00:00.000Z';
          const endTime = '2026-08-01T16:00:00.000Z';

          const res = await request(app)
            .post('/api/v1/dashboards/student/lab-bookings')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              seatId: seatMaintenance._id.toString(),
              startTime,
              endTime,
            });

          expect(res.status).toBe(400);
          expect(res.body.message).toMatch(/currently unavailable/i);
        });

        // 4. Student can cancel their own booking; cannot cancel another student's booking (403)
        it("4. should allow student to cancel own booking but reject cancelling other student's booking with 403", async () => {
          const startTime = '2026-08-01T16:00:00.000Z';
          const endTime = '2026-08-01T17:00:00.000Z';

          // Student A creates booking
          const createRes = await request(app)
            .post('/api/v1/dashboards/student/lab-bookings')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              seatId: seatA._id.toString(),
              startTime,
              endTime,
            });
          expect(createRes.status).toBe(201);
          const bookingId = createRes.body.data._id;

          // Student B tries to cancel Student A's booking (should get 403)
          const cancelByBRes = await request(app)
            .delete(`/api/v1/dashboards/student/lab-bookings/${bookingId}`)
            .set('Authorization', `Bearer ${tokenStudentB}`);
          expect(cancelByBRes.status).toBe(403);

          // Student A cancels own booking (should succeed)
          const cancelByARes = await request(app)
            .delete(`/api/v1/dashboards/student/lab-bookings/${bookingId}`)
            .set('Authorization', `Bearer ${tokenStudentA}`);
          expect(cancelByARes.status).toBe(200);

          // Verify status changed to cancelled in DB
          const dbBooking = await LabBooking.findById(bookingId);
          expect(dbBooking.status).toBe('cancelled');
        });
      });

      describe('BookSuggestions', () => {
        // 5. BookSuggestion status transitions correctly (pending -> under_review -> approved),
        // and student cannot directly set status via API (only admin can change it)
        it('5. should handle BookSuggestion transitions correctly and guard status field on student create', async () => {
          // Student A creates suggestion with status approved injected (should ignore or default to pending)
          const createRes = await request(app)
            .post('/api/v1/dashboards/student/book-suggestions')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              title: 'Design Patterns',
              author: 'Gang of Four',
              reason: 'Essential reading',
              status: 'approved', // try to hack status
            });

          expect(createRes.status).toBe(201);
          expect(createRes.body.data.status).toBe('pending'); // must be pending

          const suggestionId = createRes.body.data._id;

          // Student A tries to update status via PUT (should fail/404/403, Student Dashboard has no PUT /book-suggestions route)
          const studentUpdateRes = await request(app)
            .put(`/api/v1/dashboards/college-admin/book-suggestions/${suggestionId}`)
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              status: 'under_review',
            });
          expect(studentUpdateRes.status).toBe(403); // Student has no access to college-admin dashboard route

          // Admin A transitions: pending -> under_review
          const adminUpdateRes1 = await request(app)
            .put(`/api/v1/dashboards/college-admin/book-suggestions/${suggestionId}`)
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .send({
              status: 'under_review',
              adminNote: 'Checking budget.',
            });
          expect(adminUpdateRes1.status).toBe(200);
          expect(adminUpdateRes1.body.data.status).toBe('under_review');
          expect(adminUpdateRes1.body.data.adminNote).toBe('Checking budget.');

          // Admin A transitions: under_review -> approved
          const adminUpdateRes2 = await request(app)
            .put(`/api/v1/dashboards/college-admin/book-suggestions/${suggestionId}`)
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .send({
              status: 'approved',
              adminNote: 'Approved. Purchasing.',
            });
          expect(adminUpdateRes2.status).toBe(200);
          expect(adminUpdateRes2.body.data.status).toBe('approved');
        });
      });

      describe('Complaints (Helpdesk)', () => {
        // 6. Complaint resolve endpoint sets resolvedBy/resolvedAt correctly and is college-admin only
        it('6. should allow only college-admin to resolve complaints and set metadata correctly', async () => {
          // Student A creates complaint
          const createRes = await request(app)
            .post('/api/v1/dashboards/student/complaints')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              subject: 'Broken AC',
              description: 'The AC in CS Lab is leaking water.',
            });
          expect(createRes.status).toBe(201);
          const complaintId = createRes.body.data._id;

          // Student A tries to resolve own complaint (should get 403)
          const studentResolveRes = await request(app)
            .put(`/api/v1/dashboards/college-admin/helpdesk/${complaintId}/resolve`)
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              resolutionMessage: 'Fixed by myself.',
            });
          expect(studentResolveRes.status).toBe(403);

          // Admin A resolves the complaint
          const adminResolveRes = await request(app)
            .put(`/api/v1/dashboards/college-admin/helpdesk/${complaintId}/resolve`)
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .send({
              resolutionMessage: 'AC unit repaired by technician.',
            });
          expect(adminResolveRes.status).toBe(200);
          expect(adminResolveRes.body.data.status).toBe('resolved');
          expect(adminResolveRes.body.data.resolutionMessage).toBe(
            'AC unit repaired by technician.'
          );
          expect(adminResolveRes.body.data.resolvedBy).toBe(adminA._id.toString());
          expect(adminResolveRes.body.data.resolvedAt).toBeDefined();
        });
      });

      describe('Multi-Tenancy Cross-Tenant Enforcements', () => {
        // 7. Cross-tenant: admin from college A cannot view or modify lab seats/bookings/suggestions/complaints of college B
        it('7. should isolate tenants (Admin A cannot view/edit College B resources)', async () => {
          // Create seat in College B
          const seatB = await LabSeat.create({
            collegeId: collegeB._id,
            labName: 'Lab B',
            seatNumber: '99',
            specs: 'i7, 16GB',
            maintenanceStatus: 'operational',
          });

          // Admin A tries to edit College B seat (should get 404/unauthorized)
          const resEditSeat = await request(app)
            .put(`/api/v1/dashboards/college-admin/lab-seats/${seatB._id}`)
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .send({
              maintenanceStatus: 'maintenance',
            });
          expect(resEditSeat.status).toBe(404);

          // Create booking for College B (Student B)
          await LabBooking.create({
            collegeId: collegeB._id,
            userId: studentB._id,
            seatId: seatB._id,
            date: new Date('2026-08-02T00:00:00.000Z'),
            startTime: new Date('2026-08-02T10:00:00.000Z'),
            endTime: new Date('2026-08-02T11:00:00.000Z'),
            status: 'booked',
          });

          // Admin A tries to get lab bookings filter for College B lab (should return empty or scoped only to College A)
          const resBookings = await request(app)
            .get('/api/v1/dashboards/college-admin/lab-bookings')
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .query({ labName: 'Lab B' });

          // Lab B only exists in College B, so Admin A will find no seats/bookings matching Lab B in College A
          expect(resBookings.status).toBe(200);
          expect(resBookings.body.data.length).toBe(0);

          // Create book suggestion for College B
          const suggestionB = await BookSuggestion.create({
            collegeId: collegeB._id,
            suggestedBy: studentB._id,
            title: 'Math Vol 2',
            author: 'Newton',
            status: 'pending',
          });

          // Admin A tries to update suggestion of College B (should get 404)
          const resUpdateSuggestion = await request(app)
            .put(`/api/v1/dashboards/college-admin/book-suggestions/${suggestionB._id}`)
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .send({
              status: 'approved',
            });
          expect(resUpdateSuggestion.status).toBe(404);

          // Create complaint for College B
          const complaintB = await Complaint.create({
            collegeId: collegeB._id,
            submittedBy: studentB._id,
            subject: 'Wi-Fi slow',
            description: 'Wi-fi speed is less than 1Mbps.',
            status: 'open',
          });

          // Admin A tries to resolve College B complaint (should get 404)
          const resResolveComplaint = await request(app)
            .put(`/api/v1/dashboards/college-admin/helpdesk/${complaintB._id}/resolve`)
            .set('Authorization', `Bearer ${tokenAdminA}`)
            .send({
              resolutionMessage: 'Boosted signal.',
            });
          expect(resResolveComplaint.status).toBe(404);
        });
      });

      describe('Refined Facility Booking Engine — Rules, Horizons, Check-In & Suspensions', () => {
        let seatRefined;

        beforeAll(async () => {
          seatRefined = await LabSeat.create({
            collegeId: collegeA._id,
            labName: 'Lab Refined',
            seatNumber: 'RF-01',
            resourceType: 'workstation',
            maintenanceStatus: 'operational',
          });
        });

        // 8. Advance Booking Horizon
        it('8. should reject bookings beyond the 7-day advance booking horizon (HTTP 400)', async () => {
          const futureDate8d = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
          futureDate8d.setUTCMinutes(0, 0, 0);
          futureDate8d.setUTCHours(10);
          const end8d = new Date(futureDate8d.getTime() + 60 * 60 * 1000);

          const res = await request(app)
            .post('/api/v1/dashboards/student/lab-bookings')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              seatId: seatRefined._id.toString(),
              startTime: futureDate8d.toISOString(),
              endTime: end8d.toISOString(),
            });

          expect(res.status).toBe(400);
          expect(res.body.message).toMatch(
            /advance booking limit exceeded|up to 7 days in advance/i
          );
        });

        it('9. should allow bookings within the 7-day advance booking horizon (HTTP 201)', async () => {
          const futureDate3d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
          futureDate3d.setUTCMinutes(0, 0, 0);
          futureDate3d.setUTCHours(10);
          const end3d = new Date(futureDate3d.getTime() + 60 * 60 * 1000);

          const res = await request(app)
            .post('/api/v1/dashboards/student/lab-bookings')
            .set('Authorization', `Bearer ${tokenStudentA}`)
            .send({
              seatId: seatRefined._id.toString(),
              startTime: futureDate3d.toISOString(),
              endTime: end3d.toISOString(),
            });

          expect(res.status).toBe(201);
          expect(res.body.success).toBe(true);
        });

        // 10. 10-Minute Check-in Grace Period & Auto-Release Worker
        it('10. should auto-release non-checked-in slots past 10 minutes to no_show and free slot', async () => {
          const pastStart = new Date(Date.now() - 15 * 60 * 1000);
          const pastEnd = new Date(pastStart.getTime() + 60 * 60 * 1000);

          // Create raw booking with checkedInAt: null
          const abandonedBooking = await LabBooking.create({
            collegeId: collegeA._id,
            userId: studentA._id,
            seatId: seatRefined._id,
            date: new Date(
              Date.UTC(pastStart.getUTCFullYear(), pastStart.getUTCMonth(), pastStart.getUTCDate())
            ),
            startTime: pastStart,
            endTime: pastEnd,
            resourceType: 'workstation',
            status: 'booked',
            checkedInAt: null,
          });

          const { autoReleaseNoShows } = require('../services/labBookingService');
          const releasedCount = await autoReleaseNoShows();
          expect(releasedCount).toBeGreaterThanOrEqual(1);

          const updated = await LabBooking.findById(abandonedBooking._id);
          expect(updated.status).toBe('no_show');
        });

        // 11. Student Check-in
        it('11. should allow student to check in within grace window, setting checkedInAt', async () => {
          const now = new Date();
          const currentSlotStart = new Date(now.getTime() - 2 * 60 * 1000);
          const currentSlotEnd = new Date(currentSlotStart.getTime() + 60 * 60 * 1000);

          const booking = await LabBooking.create({
            collegeId: collegeA._id,
            userId: studentA._id,
            seatId: seatRefined._id,
            date: new Date(
              Date.UTC(
                currentSlotStart.getUTCFullYear(),
                currentSlotStart.getUTCMonth(),
                currentSlotStart.getUTCDate()
              )
            ),
            startTime: currentSlotStart,
            endTime: currentSlotEnd,
            resourceType: 'workstation',
            status: 'booked',
            checkedInAt: null,
          });

          const res = await request(app)
            .post(`/api/v1/dashboards/student/lab-bookings/${booking._id}/check-in`)
            .set('Authorization', `Bearer ${tokenStudentA}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.data.checkedInAt).toBeDefined();

          // Ensure auto-release does NOT mark it as no_show
          const { autoReleaseNoShows } = require('../services/labBookingService');
          await autoReleaseNoShows();
          const dbBooking = await LabBooking.findById(booking._id);
          expect(dbBooking.status).not.toBe('no_show');
          expect(dbBooking.checkedInAt).toBeDefined();
        });

        // 12. No-Show Penalty & 48-Hour Suspension Engine
        it('12. should reject new booking attempts with HTTP 403 when student has 3 or more no-shows within 14 days', async () => {
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
          await LabBooking.create([
            {
              collegeId: collegeB._id,
              userId: studentB._id,
              seatId: seatRefined._id,
              date: yesterday,
              startTime: new Date(yesterday.getTime() - 3 * 3600000),
              endTime: new Date(yesterday.getTime() - 2 * 3600000),
              status: 'no_show',
              createdAt: yesterday,
              updatedAt: yesterday,
            },
            {
              collegeId: collegeB._id,
              userId: studentB._id,
              seatId: seatRefined._id,
              date: yesterday,
              startTime: new Date(yesterday.getTime() - 2 * 3600000),
              endTime: new Date(yesterday.getTime() - 1 * 3600000),
              status: 'no_show',
              createdAt: yesterday,
              updatedAt: yesterday,
            },
            {
              collegeId: collegeB._id,
              userId: studentB._id,
              seatId: seatRefined._id,
              date: yesterday,
              startTime: new Date(yesterday.getTime() - 1 * 3600000),
              endTime: yesterday,
              status: 'no_show',
              createdAt: yesterday,
              updatedAt: yesterday,
            },
          ]);

          const validFuture = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
          validFuture.setUTCMinutes(0, 0, 0);
          validFuture.setUTCHours(14);
          const validEnd = new Date(validFuture.getTime() + 60 * 60 * 1000);

          const res = await request(app)
            .post('/api/v1/dashboards/student/lab-bookings')
            .set('Authorization', `Bearer ${tokenStudentB}`)
            .send({
              seatId: seatRefined._id.toString(),
              startTime: validFuture.toISOString(),
              endTime: validEnd.toISOString(),
            });

          expect(res.status).toBe(403);
          expect(res.body.message).toMatch(/privileges temporarily suspended|no-show strikes/i);
        });

        // 13. Timezone-Aware Week Range Calculation
        it('13. should compute week ranges starting Monday 00:00 and ending Sunday 23:59:59 in target timezone', () => {
          const { getCollegeTimezoneWeekRange } = require('../services/labBookingService');
          const refDate = new Date('2026-09-09T12:00:00.000Z');
          const { monday, sunday } = getCollegeTimezoneWeekRange('America/New_York', refDate);

          expect(monday).toBeInstanceOf(Date);
          expect(sunday).toBeInstanceOf(Date);
          expect(monday.getTime()).toBeLessThan(sunday.getTime());

          const { DateTime } = require('luxon');
          const dtMonday = DateTime.fromJSDate(monday).setZone('America/New_York');
          const dtSunday = DateTime.fromJSDate(sunday).setZone('America/New_York');

          expect(dtMonday.weekday).toBe(1); // Monday
          expect(dtMonday.hour).toBe(0);
          expect(dtMonday.minute).toBe(0);
          expect(dtSunday.weekday).toBe(7); // Sunday
          expect(dtSunday.hour).toBe(23);
          expect(dtSunday.minute).toBe(59);
        });
      });
    });
  });

  describe('[Source: facilityConcurrency.test.js]', () => {
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
        // await // mongoose.connection.close();
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
  });

  describe('[Source: facilityEngine.test.js]', () => {
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
        // await // mongoose.connection.close();
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
          await new Promise((resolve) => setTimeout(resolve, 100));
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
  });

  describe('[Source: facilityQueue.test.js]', () => {
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
        // await // mongoose.connection.close();
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
  });
});
