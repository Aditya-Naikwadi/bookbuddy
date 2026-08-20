const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_cross_college_sec_test';

const app = require('../app');
const Book = require('../models/Book');
const EResource = require('../models/EResource');
const ShareRequest = require('../models/ShareRequest');
const User = require('../models/User');
const College = require('../models/College');
const { generateAccessToken } = require('../utils/token');

describe('Cross-College Resource Sharing Security Audit (F6.3, F6.4, F6.5)', () => {
  let collegeA, collegeB, collegeC;
  let adminA, adminB, adminC, studentB;
  let tokenAdminA, tokenAdminB, tokenAdminC, tokenStudentB;
  let shareableBook, nonShareableBook, shareableEResource, nonShareableEResource;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await Book.deleteMany({});
    await EResource.deleteMany({});
    await ShareRequest.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});

    // Create 3 Colleges
    collegeA = await College.create({
      name: 'College Alpha',
      shortName: 'ALPHA',
      code: `ALPHA_${Date.now()}`,
    });

    collegeB = await College.create({
      name: 'College Beta',
      shortName: 'BETA',
      code: `BETA_${Date.now()}`,
    });

    collegeC = await College.create({
      name: 'College Gamma (Unrelated Third-Party)',
      shortName: 'GAMMA',
      code: `GAMMA_${Date.now()}`,
    });

    // Create Users
    adminA = await User.create({
      studentId: `ADM_A_${Date.now()}`,
      name: 'Admin Alpha',
      email: `admin_a_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeA._id,
    });

    adminB = await User.create({
      studentId: `ADM_B_${Date.now()}`,
      name: 'Admin Beta',
      email: `admin_b_${Date.now()}@beta.edu`,
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeB._id,
    });

    adminC = await User.create({
      studentId: `ADM_C_${Date.now()}`,
      name: 'Admin Gamma',
      email: `admin_c_${Date.now()}@gamma.edu`,
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeC._id,
    });

    studentB = await User.create({
      studentId: `STU_B_${Date.now()}`,
      name: 'Student Beta',
      email: `student_b_${Date.now()}@beta.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeB._id,
    });

    tokenAdminA = generateAccessToken(adminA);
    tokenAdminB = generateAccessToken(adminB);
    tokenAdminC = generateAccessToken(adminC);
    tokenStudentB = generateAccessToken(studentB);

    // Shareable Book (isShareableAcrossColleges: true)
    shareableBook = await Book.create({
      collegeId: collegeA._id,
      isbn: `ISBN_SH_${Date.now()}`,
      title: 'Shared Algorithms Volume 1',
      author: 'Thomas Cormen',
      category: 'Computer Science',
      isShareableAcrossColleges: true,
    });

    // Non-Shareable Book (isShareableAcrossColleges: false)
    nonShareableBook = await Book.create({
      collegeId: collegeA._id,
      isbn: `ISBN_NSH_${Date.now()}`,
      title: 'Shared Algorithms Volume 2 (Private Campus Edition)',
      author: 'Thomas Cormen',
      category: 'Computer Science',
      isShareableAcrossColleges: false,
    });

    // Shareable EResource
    shareableEResource = await EResource.create({
      collegeId: collegeA._id,
      title: 'Shared Data Science Lab Notes',
      author: 'Alpha Research Lab',
      type: 'pdf',
      category: 'Data Science',
      fileUrl: 'https://storage.example.com/shared.pdf',
      uploadedBy: adminA._id,
      isShareableAcrossColleges: true,
    });

    // Non-Shareable EResource
    nonShareableEResource = await EResource.create({
      collegeId: collegeA._id,
      title: 'Shared Data Science Exam Solutions (Private)',
      author: 'Alpha Research Lab',
      type: 'pdf',
      category: 'Data Science',
      fileUrl: 'https://storage.example.com/private.pdf',
      uploadedBy: adminA._id,
      isShareableAcrossColleges: false,
    });
  });

  afterAll(async () => {
    await Book.deleteMany({});
    await EResource.deleteMany({});
    await ShareRequest.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});
    await mongoose.connection.close();
  });

  describe('F6.3 — GET /api/v1/catalog/cross-college', () => {
    it('Acceptance Criteria: non-shareable resources NEVER appear in cross-college discovery endpoint, even when matching search query', async () => {
      const res = await request(app)
        .get('/api/v1/catalog/cross-college?q=Algorithms')
        .set('Authorization', `Bearer ${tokenStudentB}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const returnedBookIds = res.body.data.books.map((b) => b._id.toString());

      // ACCEPTANCE CRITERIA: Shareable book MUST be included
      expect(returnedBookIds).toContain(shareableBook._id.toString());

      // ACCEPTANCE CRITERIA: Non-shareable book MUST NEVER be included
      expect(returnedBookIds).not.toContain(nonShareableBook._id.toString());
    });
  });

  describe('F6.4 — POST /api/v1/share-requests (Requester Authorization)', () => {
    it('Acceptance Criteria: manipulated request body specifying a different requestingCollegeId is IGNORED by server', async () => {
      const manipulatedCollegeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post('/api/v1/share-requests')
        .set('Authorization', `Bearer ${tokenStudentB}`)
        .send({
          resourceId: shareableBook._id,
          resourceType: 'book',
          requestingCollegeId: manipulatedCollegeId, // Manipulated body payload
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);

      // ACCEPTANCE CRITERIA: requestingCollegeId in DB document matches studentB's actual collegeId (College B), ignoring client body
      const createdReq = await ShareRequest.findById(res.body.data._id);
      expect(createdReq.requestingCollegeId.toString()).toBe(collegeB._id.toString());
      expect(createdReq.requestingCollegeId.toString()).not.toBe(manipulatedCollegeId);
    });

    it('rejects request creation if target resource is not shareable across colleges', async () => {
      const res = await request(app)
        .post('/api/v1/share-requests')
        .set('Authorization', `Bearer ${tokenStudentB}`)
        .send({
          resourceId: nonShareableBook._id,
          resourceType: 'book',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('not enabled for cross-college sharing');
    });
  });

  describe('F6.5 — PATCH /api/v1/share-requests/:id (Owning-Admin Authorization)', () => {
    let activeShareRequest;

    beforeEach(async () => {
      await ShareRequest.deleteMany({});
      activeShareRequest = await ShareRequest.create({
        resourceId: shareableBook._id,
        resourceTypeModel: 'Book',
        resourceType: 'book',
        owningCollegeId: collegeA._id,
        requestingCollegeId: collegeB._id,
        requestedBy: studentB._id,
        status: 'requested',
      });
    });

    it('Acceptance Criteria: Admin of College C CANNOT approve or reject a request between College A and College B', async () => {
      // Admin C (Unrelated third-party) attempts to approve request
      const resAdminC = await request(app)
        .patch(`/api/v1/share-requests/${activeShareRequest._id}`)
        .set('Authorization', `Bearer ${tokenAdminC}`)
        .send({ status: 'approved' });

      // ACCEPTANCE CRITERIA: Returns 403 Forbidden
      expect(resAdminC.statusCode).toBe(403);
      expect(resAdminC.body.message).toContain('Only the administrator of the owning college can approve');

      // Verify request status remains unchanged in DB
      const untouchedReq = await ShareRequest.findById(activeShareRequest._id);
      expect(untouchedReq.status).toBe('requested');
    });

    it('allows Admin of College A (owning college) to approve request and appends statusHistory', async () => {
      const resAdminA = await request(app)
        .patch(`/api/v1/share-requests/${activeShareRequest._id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ status: 'approved' });

      expect(resAdminA.statusCode).toBe(200);
      expect(resAdminA.body.success).toBe(true);

      const updatedReq = await ShareRequest.findById(activeShareRequest._id);
      expect(updatedReq.status).toBe('approved');
      expect(updatedReq.approvedBy.toString()).toBe(adminA._id.toString());
      expect(updatedReq.statusHistory.length).toBeGreaterThan(0);
      expect(updatedReq.statusHistory[updatedReq.statusHistory.length - 1].status).toBe('approved');
    });
  });
});
