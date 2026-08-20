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
    await mongoose.connection.close();
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
