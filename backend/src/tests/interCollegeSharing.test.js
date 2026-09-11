/**
 * Consolidated Suite: inter College Sharing
 * Merged from:
 *  - shareRequest.test.js
 *  - shareRequest.security.test.js
 *  - incomingShareRequestsQueue.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('inter College Sharing Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: shareRequest.test.js]', () => {
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_sharereq_test';

    const Book = require('../models/Book');
    const EResource = require('../models/EResource');
    const ShareRequest = require('../models/ShareRequest');
    const User = require('../models/User');
    const College = require('../models/College');
    const { canTransition, validateTransition } = require('../utils/shareRequestStateMachine');

    describe('F6.1 & F6.2 — ILL Cross-College Resource Sharing & State Machine', () => {
      let collegeA, collegeB;
      let adminA, studentB;
      let bookAsset, eresourceAsset;

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
          name: 'College Alpha ILL',
          shortName: 'ALPHAILL',
          code: `ALPHAILL_${Date.now()}`,
        });

        collegeB = await College.create({
          name: 'College Beta ILL',
          shortName: 'BETAILL',
          code: `BETAILL_${Date.now()}`,
        });

        adminA = await User.create({
          studentId: `ADM_A_${Date.now()}`,
          name: 'Admin Alpha',
          email: `admin_ill_${Date.now()}@alpha.edu`,
          password: 'password123',
          role: 'college-admin',
          collegeId: collegeA._id,
        });

        studentB = await User.create({
          studentId: `STU_B_${Date.now()}`,
          name: 'Student Beta',
          email: `student_ill_${Date.now()}@beta.edu`,
          password: 'password123',
          role: 'student',
          collegeId: collegeB._id,
        });
      });

      afterAll(async () => {
        await Book.deleteMany({});
        await EResource.deleteMany({});
        await ShareRequest.deleteMany({});
        await User.deleteMany({});
        await College.deleteMany({});
        // await // mongoose.connection.close();
      });

      describe('F6.1 — isShareableAcrossColleges Opt-In Flag', () => {
        it('Acceptance Criteria: no resource is cross-college shareable by default (defaults to false)', async () => {
          bookAsset = await Book.create({
            collegeId: collegeA._id,
            isbn: `ISBN_ILL_${Date.now()}`,
            title: 'Advanced Operating Systems',
            author: 'Andrew Tanenbaum',
            category: 'Computer Science',
          });

          eresourceAsset = await EResource.create({
            collegeId: collegeA._id,
            title: 'Quantum Computing Foundations',
            author: 'IBM Quantum Team',
            type: 'pdf',
            category: 'Physics',
            fileUrl: 'https://storage.example.com/quantum.pdf',
            uploadedBy: adminA._id,
          });

          // ACCEPTANCE CRITERIA: Both default to false
          expect(bookAsset.isShareableAcrossColleges).toBe(false);
          expect(eresourceAsset.isShareableAcrossColleges).toBe(false);
        });

        it('allows admin to explicitly opt-in resource for cross-college sharing', async () => {
          bookAsset.isShareableAcrossColleges = true;
          await bookAsset.save();

          const updated = await Book.findById(bookAsset._id);
          expect(updated.isShareableAcrossColleges).toBe(true);
        });
      });

      describe('F6.2 — ShareRequest State Machine Validator', () => {
        it('allows valid sequential transitions (requested -> approved -> in_transit -> fulfilled)', () => {
          expect(canTransition('requested', 'approved')).toBe(true);
          expect(canTransition('approved', 'in_transit')).toBe(true);
          expect(canTransition('in_transit', 'fulfilled')).toBe(true);
          expect(canTransition('requested', 'rejected')).toBe(true);
        });

        it('Acceptance Criteria: direct invalid jump (requested -> fulfilled, skipping approval) is rejected by state machine', () => {
          expect(canTransition('requested', 'fulfilled')).toBe(false);

          // ACCEPTANCE CRITERIA: validateTransition throws 400 error
          expect(() => validateTransition('requested', 'fulfilled')).toThrow(
            /Invalid share request status transition/
          );
        });

        it('enforces state machine pre-save validation hook on ShareRequest model instance', async () => {
          const shareReq = await ShareRequest.create({
            resourceId: bookAsset._id,
            resourceTypeModel: 'Book',
            resourceType: 'book',
            owningCollegeId: collegeA._id,
            requestingCollegeId: collegeB._id,
            requestedBy: studentB._id,
            status: 'requested',
          });

          expect(shareReq._id).toBeDefined();

          // Attempt illegal jump from 'requested' directly to 'fulfilled'
          shareReq.status = 'fulfilled';

          // ACCEPTANCE CRITERIA: save() throws validation error via state machine
          await expect(shareReq.save()).rejects.toThrow(/Invalid share request status transition/);
        });
      });
    });
  });

  describe('[Source: shareRequest.security.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_share_req_sec_test';

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
        // await // mongoose.connection.close();
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
  });

  describe('[Source: incomingShareRequestsQueue.test.js]', () => {
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
        // await // mongoose.connection.close();
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
  });
});
