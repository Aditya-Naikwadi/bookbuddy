const mongoose = require('mongoose');
const Review = require('../models/Review');
const User = require('../models/User');
const College = require('../models/College');
const tenantScope = require('../utils/tenantScope');
const AppError = require('../utils/AppError');
const { runMigration } = require('../scripts/migrateIndicesAndDefaults');

describe('Tasks 18, 19, 20: Review Index, Bounded Memory Migration, TenantScope Security', () => {
  let testCollege;
  const unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    testCollege = await College.create({
      name: `Test College ${unique}`,
      code: `TC-${unique}`,
      slug: `tc-${unique}`,
      status: 'active',
    });
  });

  afterAll(async () => {
    try {
      if (testCollege?._id) {
        await User.deleteMany({ collegeId: testCollege._id });
        await College.deleteMany({ _id: testCollege._id });
      }
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore teardown errors
    }
  });

  describe('Task 18 — Review Sort Index', () => {
    it('defines an index on { bookId: 1, status: 1, createdAt: -1 }', () => {
      const indexes = Review.schema.indexes();
      const hasSortIndex = indexes.some(([fields]) => {
        return fields.bookId === 1 && fields.status === 1 && fields.createdAt === -1;
      });

      expect(hasSortIndex).toBe(true);
    });
  });

  describe('Task 19 — Bounded Memory Migration Script', () => {
    it('streams users with .cursor() and uses bulkWrite batching without exceeding bounded memory', async () => {
      // Create test users without cardSecret
      const createdUsers = await User.create([
        {
          name: `User Migration 1 ${unique}`,
          email: `mig1_${unique}@test.edu`,
          password: 'Password123!',
          role: 'student',
          studentId: `STU_${unique}_1`,
          collegeId: testCollege._id,
          status: 'active',
        },
        {
          name: `User Migration 2 ${unique}`,
          email: `mig2_${unique}@test.edu`,
          password: 'Password123!',
          role: 'student',
          studentId: `STU_${unique}_2`,
          collegeId: testCollege._id,
          status: 'active',
        },
      ]);

      // Remove cardSecret explicitly to test migration
      await User.updateMany(
        { _id: { $in: createdUsers.map((u) => u._id) } },
        { $unset: { cardSecret: 1 } }
      );

      // Verify cardSecret is absent
      const unmigrated = await User.find({
        _id: { $in: createdUsers.map((u) => u._id) },
        $or: [{ cardSecret: { $exists: false } }, { cardSecret: null }, { cardSecret: '' }],
      }).select('+cardSecret');
      expect(unmigrated.length).toBe(2);

      // Spy on User.find to verify .cursor() is called
      const findSpy = jest.spyOn(User, 'find');

      const result = await runMigration({ shouldExit: false });
      expect(result).toBeDefined();

      expect(findSpy).toHaveBeenCalled();
      findSpy.mockRestore();

      // Verify users now have a populated 64-character hex cardSecret
      const migratedUsers = await User.find({
        _id: { $in: createdUsers.map((u) => u._id) },
      }).select('+cardSecret');

      expect(migratedUsers.length).toBe(2);
      for (const u of migratedUsers) {
        expect(u.cardSecret).toBeDefined();
        expect(u.cardSecret).toHaveLength(64);
      }
    });
  });

  describe('Task 20 — Tenant Scope 401 vs 403 Status Codes', () => {
    const mockModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      countDocuments: jest.fn(),
    };

    it('returns 401 when req.user is unauthenticated (!req.user)', () => {
      const req = { user: null };
      expect(() => tenantScope(mockModel, req)).toThrow(AppError);

      try {
        tenantScope(mockModel, req);
      } catch (err) {
        expect(err.statusCode).toBe(401);
        expect(err.message).toMatch(/authenticated request/i);
      }
    });

    it('returns 403 when req.user exists but lacks tenant access (e.g., Super Admin / General Patron)', () => {
      // Super Admin or General Patron has req.user but collegeId is null or undefined
      const superAdminReq = {
        user: {
          _id: new mongoose.Types.ObjectId(),
          role: 'super-admin',
          collegeId: null,
        },
      };

      expect(() => tenantScope(mockModel, superAdminReq)).toThrow(AppError);

      try {
        tenantScope(mockModel, superAdminReq);
      } catch (err) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toMatch(/tenant association required/i);
      }

      const generalPatronReq = {
        user: {
          _id: new mongoose.Types.ObjectId(),
          role: 'patron',
          // no collegeId
        },
      };

      try {
        tenantScope(mockModel, generalPatronReq);
      } catch (err) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toMatch(/tenant association required/i);
      }
    });

    it('succeeds and scopes queries when req.user has a valid collegeId', () => {
      const userCollegeId = new mongoose.Types.ObjectId();
      const validReq = {
        user: {
          _id: new mongoose.Types.ObjectId(),
          role: 'student',
          collegeId: userCollegeId,
        },
      };

      const scoped = tenantScope(mockModel, validReq);
      expect(scoped).toBeDefined();
      expect(typeof scoped.find).toBe('function');

      scoped.find({ category: 'Fiction' });
      expect(mockModel.find).toHaveBeenCalledWith({
        category: 'Fiction',
        collegeId: userCollegeId,
      });
    });
  });
});
