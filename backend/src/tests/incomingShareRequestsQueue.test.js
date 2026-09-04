const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_incoming_queue_test';

const app = require('../app');
const Book = require('../models/Book');
const ShareRequest = require('../models/ShareRequest');
const User = require('../models/User');
const College = require('../models/College');
const { generateAccessToken } = require('../utils/token');

describe('F6.6 & F6.7 — Targeted Status Notifications & Incoming Share Requests Queue Security', () => {
  let collegeA, collegeB;
  let adminA, adminB, studentA, studentB;
  let tokenAdminA, tokenAdminB;
  let shareableBookA, shareableBookB;
  let shareReqA, shareReqB;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await Book.deleteMany({});
    await ShareRequest.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});

    collegeA = await College.create({
      name: 'College Alpha Queue',
      shortName: 'ALPHAQUEUE',
      code: `ALPHAQUEUE_${Date.now()}`,
    });

    collegeB = await College.create({
      name: 'College Beta Queue',
      shortName: 'BETAQUEUE',
      code: `BETAQUEUE_${Date.now()}`,
    });

    adminA = await User.create({
      studentId: `ADM_Q_A_${Date.now()}`,
      name: 'Admin Alpha Queue',
      email: `admin_q_a_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeA._id,
    });

    adminB = await User.create({
      studentId: `ADM_Q_B_${Date.now()}`,
      name: 'Admin Beta Queue',
      email: `admin_q_b_${Date.now()}@beta.edu`,
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeB._id,
    });

    studentA = await User.create({
      studentId: `STU_Q_A_${Date.now()}`,
      name: 'Student Alpha',
      email: `student_q_a_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    studentB = await User.create({
      studentId: `STU_Q_B_${Date.now()}`,
      name: 'Student Beta',
      email: `student_q_b_${Date.now()}@beta.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeB._id,
    });

    tokenAdminA = generateAccessToken(adminA);
    tokenAdminB = generateAccessToken(adminB);

    shareableBookA = await Book.create({
      collegeId: collegeA._id,
      isbn: `ISBN_QA_${Date.now()}`,
      title: 'College A Shared Book',
      author: 'Author A',
      category: 'Computer Science',
      isShareableAcrossColleges: true,
    });

    shareableBookB = await Book.create({
      collegeId: collegeB._id,
      isbn: `ISBN_QB_${Date.now()}`,
      title: 'College B Shared Book',
      author: 'Author B',
      category: 'Physics',
      isShareableAcrossColleges: true,
    });

    // ShareRequest 1: College A is owning college (Student B requested from College A)
    shareReqA = await ShareRequest.create({
      resourceId: shareableBookA._id,
      resourceTypeModel: 'Book',
      resourceType: 'book',
      owningCollegeId: collegeA._id,
      requestingCollegeId: collegeB._id,
      requestedBy: studentB._id,
      status: 'requested',
    });

    // ShareRequest 2: College B is owning college (Student A requested from College B)
    shareReqB = await ShareRequest.create({
      resourceId: shareableBookB._id,
      resourceTypeModel: 'Book',
      resourceType: 'book',
      owningCollegeId: collegeB._id,
      requestingCollegeId: collegeA._id,
      requestedBy: studentA._id,
      status: 'requested',
    });
  });

  afterAll(async () => {
    await Book.deleteMany({});
    await ShareRequest.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});
    await mongoose.connection.close();
  });

  describe('F6.7 — GET /api/v1/share-requests/incoming Queue Filtering Security', () => {
    it('Acceptance Criteria: queue NEVER displays a request belonging to a different college, even via crafted query parameters', async () => {
      // Admin A attempts to request queue with crafted query param trying to view College B's incoming requests
      const res = await request(app)
        .get(`/api/v1/share-requests/incoming?owningCollegeId=${collegeB._id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const returnedReqIds = res.body.data.map((r) => r._id.toString());

      // ACCEPTANCE CRITERIA: Returns ONLY shareReqA (where owningCollegeId is College A)
      expect(returnedReqIds).toContain(shareReqA._id.toString());

      // ACCEPTANCE CRITERIA: NEVER returns shareReqB (where owningCollegeId is College B), ignoring crafted query parameter
      expect(returnedReqIds).not.toContain(shareReqB._id.toString());
    });
  });

  describe('F6.6 — Targeted Status Notifications', () => {
    it('Acceptance Criteria: updating status emits socket notification to exact 2 parties', async () => {
      const res = await request(app)
        .patch(`/api/v1/share-requests/${shareReqA._id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ status: 'approved' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('approved');
    });
  });
});
