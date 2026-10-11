/**
 * Test Suite: Broken Object Level Authorization (BOLA / IDOR)
 *
 * Verifies that all endpoints operating on object IDs strictly enforce
 * server-side authorization:
 * 1. User A cannot read, edit, or delete User B's objects.
 * 2. Cross-tenant access is rejected with uniform 404 (or 403).
 * 3. Query scoping by owner / tenant prevents resource existence leakage.
 * 4. Role bypass is restricted strictly to authorized administrative scopes.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testjwtsecretbolakey999';
process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretbolakey999';
process.env.JWT_ACCESS_EXPIRY = '10m';
process.env.JWT_REFRESH_EXPIRY = '7d';

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');

const User = require('../models/User');
const College = require('../models/College');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const Book = require('../models/Book');
const Bookmark = require('../models/Bookmark');
const SavedSearch = require('../models/SavedSearch');
const ReadingList = require('../models/ReadingList');
const EResource = require('../models/EResource');
const RegistrationRequest = require('../models/RegistrationRequest');

const { generateTokenPair } = require('../utils/token');
const { assertOwner, checkObjectAuthorization } = require('../services/ownershipService');
const AppError = require('../utils/AppError');

describe('BOLA / IDOR Security Hardening Suite', () => {
  let collegeA;
  let collegeB;
  let userA;
  let userB;
  let collegeAdminA;
  let collegeAdminB;
  let superAdmin;

  let tokenUserA;
  let tokenUserB;
  let tokenCollegeAdminA;
  let tokenCollegeAdminB;
  let tokenSuperAdmin;

  const unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const slugA = `cola-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
  const slugB = `colb-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    // 1. Create Colleges
    collegeA = await College.create({
      name: `College Alpha ${unique}`,
      code: `CA-${unique}`,
      slug: slugA,
      status: 'active',
    });

    collegeB = await College.create({
      name: `College Beta ${unique}`,
      code: `CB-${unique}`,
      slug: slugB,
      status: 'active',
    });

    // 2. Create Users
    userA = await User.create({
      name: `User Alpha ${unique}`,
      email: `user_a_${unique}@alpha.edu`,
      password: 'Password123!',
      role: 'student',
      collegeId: collegeA._id,
      studentId: `STU-A-${unique}`,
      status: 'active',
    });

    userB = await User.create({
      name: `User Beta ${unique}`,
      email: `user_b_${unique}@beta.edu`,
      password: 'Password123!',
      role: 'student',
      collegeId: collegeB._id,
      studentId: `STU-B-${unique}`,
      status: 'active',
    });

    collegeAdminA = await User.create({
      name: `Admin Alpha ${unique}`,
      email: `admin_a_${unique}@alpha.edu`,
      password: 'Password123!',
      role: 'college-admin',
      collegeId: collegeA._id,
      status: 'active',
    });

    collegeAdminB = await User.create({
      name: `Admin Beta ${unique}`,
      email: `admin_b_${unique}@beta.edu`,
      password: 'Password123!',
      role: 'college-admin',
      collegeId: collegeB._id,
      status: 'active',
    });

    superAdmin = await User.create({
      name: `Super Admin ${unique}`,
      email: `super_${unique}@bookbuddy.com`,
      password: 'Password123!',
      role: 'super-admin',
      status: 'active',
    });

    // 3. Generate tokens
    tokenUserA = (await generateTokenPair(userA)).accessToken;
    tokenUserB = (await generateTokenPair(userB)).accessToken;
    tokenCollegeAdminA = (await generateTokenPair(collegeAdminA)).accessToken;
    tokenCollegeAdminB = (await generateTokenPair(collegeAdminB)).accessToken;
    tokenSuperAdmin = (await generateTokenPair(superAdmin)).accessToken;
  });

  afterAll(async () => {
    try {
      await User.deleteMany({
        _id: { $in: [userA._id, userB._id, collegeAdminA._id, collegeAdminB._id, superAdmin._id] },
      });
      await College.deleteMany({ _id: { $in: [collegeA._id, collegeB._id] } });
      await Bookmark.deleteMany({ userId: { $in: [userA._id, userB._id] } });
      await SavedSearch.deleteMany({ userId: { $in: [userA._id, userB._id] } });
      await ReadingList.deleteMany({ userId: { $in: [userA._id, userB._id] } });
      await Payment.deleteMany({ userId: { $in: [userA._id, userB._id] } });
      await Review.deleteMany({ userId: { $in: [userA._id, userB._id] } });
      await EResource.deleteMany({ collegeId: { $in: [collegeA._id, collegeB._id] } });
      await RegistrationRequest.deleteMany({ 'tenantData.legalName': new RegExp(unique) });
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore teardown error
    }
  });

  describe('1. Centralized Ownership Service (assertOwner & checkObjectAuthorization)', () => {
    it('assertOwner allows access when user is the resource owner', () => {
      const resource = { userId: userA._id };
      expect(() => assertOwner(resource, userA._id)).not.toThrow();
    });

    it('assertOwner throws AppError when caller is not the owner (defaults to 403 or custom code)', () => {
      const resource = { userId: userB._id };
      expect(() => assertOwner(resource, userA._id)).toThrow(AppError);

      try {
        assertOwner(resource, userA._id, { statusCode: 404, message: 'Not found' });
      } catch (err) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe('Not found');
      }
    });

    it('checkObjectAuthorization allows resource owner', () => {
      const resource = { userId: userA._id, collegeId: collegeA._id };
      const req = {
        user: { id: userA._id.toString(), role: 'student', collegeId: collegeA._id.toString() },
      };
      expect(() => checkObjectAuthorization(resource, req)).not.toThrow();
    });

    it('checkObjectAuthorization denies different student even in same college with 404', () => {
      const resource = { userId: userB._id, collegeId: collegeB._id };
      const req = {
        user: { id: userA._id.toString(), role: 'student', collegeId: collegeB._id.toString() },
      };
      expect(() => checkObjectAuthorization(resource, req)).toThrow(AppError);

      try {
        checkObjectAuthorization(resource, req);
      } catch (err) {
        expect(err.statusCode).toBe(404);
      }
    });

    it('checkObjectAuthorization allows super-admin to manage any object', () => {
      const resource = { userId: userB._id, collegeId: collegeB._id };
      const req = { user: { id: superAdmin._id.toString(), role: 'super-admin' } };
      expect(() => checkObjectAuthorization(resource, req)).not.toThrow();
    });

    it('checkObjectAuthorization allows college-admin within the same tenant', () => {
      const resource = { userId: userA._id, collegeId: collegeA._id };
      const req = {
        user: {
          id: collegeAdminA._id.toString(),
          role: 'college-admin',
          collegeId: collegeA._id.toString(),
        },
      };
      expect(() => checkObjectAuthorization(resource, req)).not.toThrow();
    });

    it('checkObjectAuthorization denies college-admin across different tenants with 404', () => {
      const resource = { userId: userA._id, collegeId: collegeA._id };
      const req = {
        user: {
          id: collegeAdminB._id.toString(),
          role: 'college-admin',
          collegeId: collegeB._id.toString(),
        },
      };
      expect(() => checkObjectAuthorization(resource, req)).toThrow(AppError);

      try {
        checkObjectAuthorization(resource, req);
      } catch (err) {
        expect(err.statusCode).toBe(404);
      }
    });
  });

  describe('2. Payment Endpoints BOLA / IDOR Protection', () => {
    let paymentOrderB;

    beforeAll(async () => {
      paymentOrderB = await Payment.create({
        gatewayOrderId: `order_gw_${unique}_b`,
        userId: userB._id,
        collegeId: collegeB._id,
        amount: 250,
        currency: 'INR',
        status: 'created',
      });
    });

    it("User A querying User B's order status by orderId fails with uniform 404", async () => {
      const res = await request(app)
        .get(`/api/v1/payments/${paymentOrderB.gatewayOrderId}/status`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('User B querying their own order status succeeds', async () => {
      const res = await request(app)
        .get(`/api/v1/payments/${paymentOrderB.gatewayOrderId}/status`)
        .set('Authorization', `Bearer ${tokenUserB}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBe(paymentOrderB.gatewayOrderId);
    });

    it("User A verifying payment using User B's order fails with 404", async () => {
      const crypto = require('crypto');
      const keySecret = process.env.RAZORPAY_KEY_SECRET || 'test_razorpay_key_secret_12345';
      const paymentId = 'pay_mock_12345';
      const validSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${paymentOrderB.gatewayOrderId}|${paymentId}`)
        .digest('hex');

      const res = await request(app)
        .post('/api/v1/payments/verify-payment')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          razorpay_order_id: paymentOrderB.gatewayOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  describe('3. Reviews BOLA / IDOR Protection', () => {
    let bookA;
    let reviewB;

    beforeAll(async () => {
      bookA = await Book.create({
        title: `Test Book ${unique}`,
        author: 'Security Tester',
        category: 'Computer Science',
        isbn: `97800000${Math.floor(Math.random() * 100000)}`,
        collegeId: collegeA._id,
        totalCopies: 5,
        copiesAvailable: 5,
      });

      reviewB = await Review.create({
        bookId: bookA._id,
        userId: userB._id,
        collegeId: collegeB._id,
        rating: 4,
        comment: 'Initial review by User B',
      });
    });

    it("User A updating User B's review by ID fails with uniform 404 (does not leak existence)", async () => {
      const res = await request(app)
        .put(`/api/v1/reviews/${reviewB._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          rating: 1,
          comment: 'Tampered by User A',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it("User A deleting User B's review by ID fails with uniform 404", async () => {
      const res = await request(app)
        .delete(`/api/v1/reviews/${reviewB._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('Cross-tenant college admin B cannot delete Review B if it was created under college A scope', async () => {
      const reviewInCollegeA = await Review.create({
        bookId: bookA._id,
        userId: userA._id,
        collegeId: collegeA._id,
        rating: 5,
        comment: 'Review inside College A',
      });

      const res = await request(app)
        .delete(`/api/v1/reviews/${reviewInCollegeA._id}`)
        .set('Authorization', `Bearer ${tokenCollegeAdminB}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Student Dashboard Bookmarks & Saved Searches BOLA Protection', () => {
    let eresourceB;
    let bookmarkB;
    let savedSearchB;

    beforeAll(async () => {
      eresourceB = await EResource.create({
        title: `Resource for Bookmark ${unique}`,
        author: 'Security Author',
        category: 'Computer Science',
        type: 'epub',
        fileUrl: 'https://example.com/test-bm.epub',
        uploadedBy: userB._id,
        collegeId: collegeB._id,
      });

      bookmarkB = await Bookmark.create({
        userId: userB._id,
        eresourceId: eresourceB._id,
        locationRef: 'page-42',
        note: 'User B private note',
      });

      savedSearchB = await SavedSearch.create({
        userId: userB._id,
        collegeId: collegeB._id,
        queryParams: { q: 'algorithms' },
        alertsEnabled: true,
      });
    });

    it("User A attempting to delete User B's bookmark fails with uniform 404", async () => {
      const res = await request(app)
        .delete(`/api/v1/dashboards/student/bookmarks/${bookmarkB._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/bookmark not found/i);
    });

    it("User A attempting to delete User B's saved search fails with uniform 404", async () => {
      const res = await request(app)
        .delete(`/api/v1/dashboards/student/saved-searches/${savedSearchB._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/saved search not found/i);
    });

    it("User A attempting to toggle alerts on User B's saved search fails with uniform 404", async () => {
      const res = await request(app)
        .patch(`/api/v1/dashboards/student/saved-searches/${savedSearchB._id}/alerts`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ alertsEnabled: false });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('5. Reading List BOLA & Visibility Checks', () => {
    let readingListB;

    beforeAll(async () => {
      readingListB = await ReadingList.create({
        userId: userB._id,
        collegeId: collegeB._id,
        name: `User B Private List ${unique}`,
        isPublic: false,
        books: [],
      });
    });

    it("User A fetching User B's private reading list fails with 403 or 404", async () => {
      const res = await request(app)
        .get(`/api/v1/reading-lists/${readingListB._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it("User A updating User B's reading list fails with 403 or 404", async () => {
      const res = await request(app)
        .put(`/api/v1/reading-lists/${readingListB._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ name: 'Hacked Name' });

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it("User A deleting User B's reading list fails with 403 or 404", async () => {
      const res = await request(app)
        .delete(`/api/v1/reading-lists/${readingListB._id}`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('6. Cross-Tenant EResource External Proxy Protection', () => {
    let resourceB;

    beforeAll(async () => {
      resourceB = await EResource.create({
        title: `Resource in College B ${unique}`,
        author: 'External Author',
        category: 'Literature',
        type: 'epub',
        fileUrl: 'https://example.com/gutenberg.epub',
        uploadedBy: userB._id,
        collegeId: collegeB._id,
        gutenbergId: 1342,
      });
    });

    it('User A (College A) attempting to proxy Gutenberg resource in College B fails with uniform 404', async () => {
      const res = await request(app)
        .get(`/api/v1/eresources/external/${resourceB._id}/content`)
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  describe('7. Tenant Onboarding Resubmission IDOR Protection', () => {
    let regRequest;

    beforeAll(async () => {
      regRequest = await RegistrationRequest.create({
        type: 'tenant_onboarding',
        status: 'rejected',
        tenantData: {
          legalName: `Rejected University ${unique}`,
          adminEmail: `founder_${unique}@rejected.edu`,
          domain: `rejected-${unique}.edu`,
          rejectionReason: 'Missing registration certificate',
        },
      });
    });

    it('Attacker attempting to resubmit without matching adminEmail fails with 400 or 404', async () => {
      const res = await request(app)
        .put(`/api/v1/registration/tenant-onboarding/${regRequest._id}/resubmit`)
        .send({
          adminEmail: 'attacker@evil.com',
          legalName: 'Evil Hijack Corp',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('Legitimate applicant providing matching adminEmail succeeds in resubmitting', async () => {
      const res = await request(app)
        .put(`/api/v1/registration/tenant-onboarding/${regRequest._id}/resubmit`)
        .send({
          adminEmail: `founder_${unique}@rejected.edu`,
          legalName: `Fixed University ${unique}`,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await RegistrationRequest.findById(regRequest._id);
      expect(updated.status).toBe('pending_review');
      expect(updated.tenantData.legalName).toBe(`Fixed University ${unique}`);
    });
  });
});
