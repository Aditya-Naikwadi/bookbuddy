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
    await mongoose.connection.close();
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
      expect(collisionResult.body.message).toMatch(/slot already booked|already exists/i);

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
      expect(adminResolveRes.body.data.resolutionMessage).toBe('AC unit repaired by technician.');
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
});
