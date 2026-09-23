const mongoose = require('mongoose');
const User = require('../models/User');
const StudentJoinRequest = require('../models/StudentJoinRequest');
const RegistrationRequest = require('../models/RegistrationRequest');
const College = require('../models/College');
const { ROLES, CANONICAL_ROLES } = require('@bookbuddy/shared/constants/roles');

describe('Schema-Level Identity & Role Normalization Write Paths Test Suite', () => {
  let collegeId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }
    collegeId = new mongoose.Types.ObjectId();
    // Ensure test college exists
    await College.deleteMany({ code: 'NORM_TEST_COLL' });
    await College.create({
      _id: collegeId,
      name: 'Normalization Test College',
      code: 'NORM_TEST_COLL',
      domain: 'normtest.edu',
      status: 'active',
      isActive: true,
    });
  });

  afterAll(async () => {
    await User.deleteMany({ collegeId });
    await College.deleteMany({ _id: collegeId });
    await StudentJoinRequest.deleteMany({ collegeId });
    await RegistrationRequest.deleteMany({ collegeId });
  });

  describe('1. User.prototype.save() Write Path', () => {
    it('normalizes email, studentId, and role on new User().save()', async () => {
      const user = new User({
        name: 'Save Test Student',
        email: '  Alice.Smith@NORMTEST.EDU  ',
        studentId: '  STU-SAVE-001  ',
        role: 'college-student', // Legacy drifted role value
        collegeId,
        password: 'Password123!',
      });

      const saved = await user.save();
      expect(saved.email).toBe('alice.smith@normtest.edu');
      expect(saved.studentId).toBe('stu-save-001');
      expect(saved.role).toBe(ROLES.STUDENT); // Canonicalized to 'student'
    });

    it('normalizes legacy underscore admin roles on save()', async () => {
      const adminUser = new User({
        name: 'Admin Underscore Test',
        email: '  Admin.One@NormTest.EDU  ',
        role: 'college_admin', // Drifted underscore role
        collegeId,
        password: 'Password123!',
      });

      const saved = await adminUser.save();
      expect(saved.email).toBe('admin.one@normtest.edu');
      expect(saved.role).toBe(ROLES.COLLEGE_ADMIN); // Canonicalized to 'college-admin'
    });
  });

  describe('2. User.create() Write Path', () => {
    it('normalizes email, studentId, and role on User.create()', async () => {
      const created = await User.create({
        name: 'Create Test Student',
        email: '  BOB.JONES@NormTest.EDU  ',
        studentId: '  CS-CREATE-002  ',
        role: 'college-student',
        collegeId,
        password: 'Password123!',
      });

      expect(created.email).toBe('bob.jones@normtest.edu');
      expect(created.studentId).toBe('cs-create-002');
      expect(created.role).toBe(ROLES.STUDENT);

      // Verify from database read directly
      const fetched = await User.findById(created._id).lean();
      expect(fetched.email).toBe('bob.jones@normtest.edu');
      expect(fetched.studentId).toBe('cs-create-002');
      expect(fetched.role).toBe(ROLES.STUDENT);
    });
  });

  describe('3. User.insertMany() Write Path', () => {
    it('normalizes email, studentId, and role across bulk array in User.insertMany()', async () => {
      const docs = [
        {
          name: 'Bulk Student 1',
          email: '  CHARLIE.1@NORMTEST.EDU  ',
          studentId: '  STU-BULK-001  ',
          role: 'college-student',
          collegeId,
          password: 'Password123!',
        },
        {
          name: 'Bulk Student 2',
          email: '  DANIEL.2@NormTest.Edu  ',
          studentId: '  STU-BULK-002  ',
          role: 'student',
          collegeId,
          password: 'Password123!',
        },
      ];

      const inserted = await User.insertMany(docs);
      expect(inserted).toHaveLength(2);

      expect(inserted[0].email).toBe('charlie.1@normtest.edu');
      expect(inserted[0].studentId).toBe('stu-bulk-001');
      expect(inserted[0].role).toBe(ROLES.STUDENT);

      expect(inserted[1].email).toBe('daniel.2@normtest.edu');
      expect(inserted[1].studentId).toBe('stu-bulk-002');
      expect(inserted[1].role).toBe(ROLES.STUDENT);

      // Fetch from DB to ensure persistence is normalized
      const fetched = await User.find({
        collegeId,
        studentId: { $in: ['stu-bulk-001', 'stu-bulk-002'] },
      }).lean();
      expect(fetched).toHaveLength(2);
      for (const u of fetched) {
        expect(u.email).toBe(u.email.toLowerCase().trim());
        expect(u.studentId).toBe(u.studentId.toLowerCase().trim());
        expect(u.role).toBe(ROLES.STUDENT);
      }
    });
  });

  describe('4. User.findOneAndUpdate() & User.updateOne() Write Paths', () => {
    let existingUserId;

    beforeEach(async () => {
      const u = await User.create({
        name: 'Update Target User',
        email: 'original.email@normtest.edu',
        studentId: 'original-id',
        role: ROLES.STUDENT,
        collegeId,
        password: 'Password123!',
      });
      existingUserId = u._id;
    });

    it('normalizes $set updates in User.findOneAndUpdate()', async () => {
      const updated = await User.findOneAndUpdate(
        { _id: existingUserId },
        {
          $set: {
            email: '  UPDATED.EMAIL@NormTest.EDU  ',
            studentId: '  UPDATED-STUDENT-ID  ',
            role: 'college-student',
          },
        },
        { new: true }
      );

      expect(updated.email).toBe('updated.email@normtest.edu');
      expect(updated.studentId).toBe('updated-student-id');
      expect(updated.role).toBe(ROLES.STUDENT);

      const inDb = await User.findById(existingUserId).lean();
      expect(inDb.email).toBe('updated.email@normtest.edu');
      expect(inDb.studentId).toBe('updated-student-id');
      expect(inDb.role).toBe(ROLES.STUDENT);
    });

    it('normalizes direct field updates in User.updateOne()', async () => {
      await User.updateOne(
        { _id: existingUserId },
        {
          email: '  SECOND.UPDATE@NormTest.EDU  ',
          studentId: '  SECOND-ID-999  ',
          role: 'college-student',
        }
      );

      const inDb = await User.findById(existingUserId).lean();
      expect(inDb.email).toBe('second.update@normtest.edu');
      expect(inDb.studentId).toBe('second-id-999');
      expect(inDb.role).toBe(ROLES.STUDENT);
    });
  });

  describe('5. Related Models Normalization on Write', () => {
    it('normalizes StudentJoinRequest email and studentId', async () => {
      const req = await StudentJoinRequest.create({
        name: 'Join Request Student',
        email: '  Join.Student@NormTest.Edu  ',
        studentId: '  REQ-STU-888  ',
        password: 'HashedPassword123!',
        collegeId,
        department: 'Computer Science',
      });

      expect(req.email).toBe('join.student@normtest.edu');
      expect(req.studentId).toBe('req-stu-888');

      const inDb = await StudentJoinRequest.findById(req._id).lean();
      expect(inDb.email).toBe('join.student@normtest.edu');
      expect(inDb.studentId).toBe('req-stu-888');
    });

    it('normalizes RegistrationRequest email and studentId', async () => {
      const reg = await RegistrationRequest.create({
        type: 'student_registration',
        studentData: {
          name: 'Registration Request User',
          email: '  REG.USER@NormTest.Edu  ',
          studentId: '  REG-STU-777  ',
          collegeId,
        },
      });

      expect(reg.studentData.email).toBe('reg.user@normtest.edu');
      expect(reg.studentData.studentId).toBe('reg-stu-777');

      const inDb = await RegistrationRequest.findById(reg._id).lean();
      expect(inDb.studentData.email).toBe('reg.user@normtest.edu');
      expect(inDb.studentData.studentId).toBe('reg-stu-777');
    });

    it('synchronizes College.status and College.isActive bidirectionally', async () => {
      const testCollege = await College.create({
        name: 'Status Sync College',
        code: 'STATUS_SYNC_COLL',
        domain: 'sync.edu',
        status: 'suspended',
        isActive: true, // Contradictory flag passed
      });

      // Hook enforces isActive: false when status is suspended
      expect(testCollege.status).toBe('suspended');
      expect(testCollege.isActive).toBe(false);

      // Now update status to active via findOneAndUpdate
      const activated = await College.findOneAndUpdate(
        { _id: testCollege._id },
        { status: 'active' },
        { new: true }
      );
      expect(activated.status).toBe('active');
      expect(activated.isActive).toBe(true);

      await College.deleteOne({ _id: testCollege._id });
    });
  });
});
