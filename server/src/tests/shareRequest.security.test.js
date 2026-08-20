const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_sharereq_sec_audit_test';

const app = require('../app');
const Book = require('../models/Book');
const EResource = require('../models/EResource');
const ShareRequest = require('../models/ShareRequest');
const User = require('../models/User');
const College = require('../models/College');
const { generateAccessToken } = require('../utils/token');

describe('F6.9 — Comprehensive Cross-College Resource Sharing Security Audit', () => {
  let collegeA, collegeB, collegeC;
  let adminA, adminB, adminC, studentB;
  let tokenAdminA, tokenAdminB, tokenAdminC, tokenStudentB;
  let shareableBookA, nonShareableBookA;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await Book.deleteMany({});
    await EResource.deleteMany({});
    await ShareRequest.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});

    collegeA = await College.create({
      name: 'College Alpha Audit',
      shortName: 'ALPHAAUD',
      code: `ALPHAAUD_${Date.now()}`,
    });

    collegeB = await College.create({
      name: 'College Beta Audit',
      shortName: 'BETAAUD',
      code: `BETAAUD_${Date.now()}`,
    });

    collegeC = await College.create({
      name: 'College Gamma (Hostile Third-Party)',
      shortName: 'GAMMAAUD',
      code: `GAMMAAUD_${Date.now()}`,
    });

    adminA = await User.create({
      studentId: `ADM_SEC_A_${Date.now()}`,
      name: 'Admin Alpha Audit',
      email: `admin_sec_a_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeA._id,
    });

    adminB = await User.create({
      studentId: `ADM_SEC_B_${Date.now()}`,
      name: 'Admin Beta Audit',
      email: `admin_sec_b_${Date.now()}@beta.edu`,
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeB._id,
    });

    adminC = await User.create({
      studentId: `ADM_SEC_C_${Date.now()}`,
      name: 'Admin Gamma Audit (Attacker)',
      email: `admin_sec_c_${Date.now()}@gamma.edu`,
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeC._id,
    });

    studentB = await User.create({
      studentId: `STU_SEC_B_${Date.now()}`,
      name: 'Student Beta Audit',
      email: `student_sec_b_${Date.now()}@beta.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeB._id,
    });

    tokenAdminA = generateAccessToken(adminA);
    tokenAdminB = generateAccessToken(adminB);
    tokenAdminC = generateAccessToken(adminC);
    tokenStudentB = generateAccessToken(studentB);

    shareableBookA = await Book.create({
      collegeId: collegeA._id,
      isbn: `ISBN_SECA_${Date.now()}`,
      title: 'Shared Cyber Security Textbook',
      author: 'Bruce Schneier',
      category: 'Computer Science',
      isShareableAcrossColleges: true,
    });

    nonShareableBookA = await Book.create({
      collegeId: collegeA._id,
      isbn: `ISBN_SECA_PRIV_${Date.now()}`,
      title: 'Shared Cyber Security Textbook (Private Exam Key)',
      author: 'Bruce Schneier',
      category: 'Computer Science',
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

  describe('Vector 1: Cross-College Discovery Leakage & Filter Bypass', () => {
    it('prevents non-shareable resources from appearing in GET /api/v1/catalog/cross-college', async () => {
      const res = await request(app)
        .get('/api/v1/catalog/cross-college?q=Cyber')
        .set('Authorization', `Bearer ${tokenStudentB}`);

      expect(res.statusCode).toBe(200);
      const bookIds = res.body.data.books.map((b) => b._id.toString());

      expect(bookIds).toContain(shareableBookA._id.toString());
      expect(bookIds).not.toContain(nonShareableBookA._id.toString());
    });
  });

  describe('Vector 2: Request Body Spoofing (requester-side authorization)', () => {
    it('ignores client-supplied requestingCollegeId in POST /api/v1/share-requests', async () => {
      const spoofedTenantId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post('/api/v1/share-requests')
        .set('Authorization', `Bearer ${tokenStudentB}`)
        .send({
          resourceId: shareableBookA._id,
          resourceType: 'book',
          requestingCollegeId: spoofedTenantId, // Attack Payload
        });

      expect(res.statusCode).toBe(201);
      const created = await ShareRequest.findById(res.body.data._id);
      expect(created.requestingCollegeId.toString()).toBe(collegeB._id.toString());
      expect(created.requestingCollegeId.toString()).not.toBe(spoofedTenantId);
    });
  });

  describe('Vector 3: Cross-Tenant Admin Hijacking & Authorization', () => {
    it('blocks Admin C (College C) from modifying College A & B share requests with 403 Forbidden', async () => {
      const targetReq = await ShareRequest.create({
        resourceId: shareableBookA._id,
        resourceTypeModel: 'Book',
        resourceType: 'book',
        owningCollegeId: collegeA._id,
        requestingCollegeId: collegeB._id,
        requestedBy: studentB._id,
        status: 'requested',
      });

      const res = await request(app)
        .patch(`/api/v1/share-requests/${targetReq._id}`)
        .set('Authorization', `Bearer ${tokenAdminC}`)
        .send({ status: 'approved' });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain(
        'Only the administrator of the owning college can approve'
      );
    });
  });

  describe('Vector 4: State Machine Transition Bypassing', () => {
    it('rejects direct state skipping (requested -> fulfilled) with 400 Bad Request', async () => {
      const targetReq = await ShareRequest.create({
        resourceId: shareableBookA._id,
        resourceTypeModel: 'Book',
        resourceType: 'book',
        owningCollegeId: collegeA._id,
        requestingCollegeId: collegeB._id,
        requestedBy: studentB._id,
        status: 'requested',
      });

      const res = await request(app)
        .patch(`/api/v1/share-requests/${targetReq._id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ status: 'fulfilled' }); // Illegal jump

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Invalid share request status transition');
    });
  });

  describe('Vector 5: Queue Parameter Manipulation', () => {
    it('prevents Admin A from viewing Admin B incoming queue via query params', async () => {
      const res = await request(app)
        .get(`/api/v1/share-requests/incoming?owningCollegeId=${collegeB._id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);

      expect(res.statusCode).toBe(200);
      const returnedIds = res.body.data.map((r) => r.owningCollegeId._id.toString());
      returnedIds.forEach((id) => {
        expect(id).toBe(collegeA._id.toString());
        expect(id).not.toBe(collegeB._id.toString());
      });
    });
  });
});
