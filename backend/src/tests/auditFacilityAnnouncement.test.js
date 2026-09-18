const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const FacilityBooking = require('../models/FacilityBooking');
const Announcement = require('../models/Announcement');
const College = require('../models/College');
const User = require('../models/User');
const { toggleRSVP } = require('../controllers/announcementController');

describe('Tasks 24, 25, 26: AuditLog dead index, FacilityBooking index optimization, Announcement returnDocument', () => {
  let testCollege;
  let studentUser;
  const unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    testCollege = await College.create({
      name: `Index Test College ${unique}`,
      code: `ITC-${unique}`,
      slug: `itc-${unique}`,
      status: 'active',
    });

    studentUser = await User.create({
      name: `Student Index ${unique}`,
      email: `student_idx_${unique}@test.edu`,
      password: 'Password123!',
      role: 'student',
      studentId: `STU_IDX_${unique}`,
      collegeId: testCollege._id,
      status: 'active',
    });
  });

  afterAll(async () => {
    try {
      if (testCollege?._id) {
        await Announcement.deleteMany({ collegeId: testCollege._id });
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

  describe('Task 24 — Remove Dead AuditLog Index', () => {
    it('confirms no compound index in AuditLog references the non-existent category field', () => {
      const indexes = AuditLog.schema.indexes();
      const hasCategoryIndex = indexes.some(([fields]) => {
        return Object.prototype.hasOwnProperty.call(fields, 'category');
      });

      expect(hasCategoryIndex).toBe(false);
    });
  });

  describe('Task 25 — Remove Redundant FacilityBooking Indexes', () => {
    it('verifies collegeId and resourceId do not have redundant single-field indexes', () => {
      // Check path options
      expect(FacilityBooking.schema.path('collegeId').options.index).toBeUndefined();
      expect(FacilityBooking.schema.path('resourceId').options.index).toBeUndefined();

      // Check explicit schema indexes - verify no single-key { collegeId: 1 } or { resourceId: 1 } index
      const indexes = FacilityBooking.schema.indexes();
      const hasSingleCollegeIndex = indexes.some(([fields]) => {
        const keys = Object.keys(fields);
        return keys.length === 1 && keys[0] === 'collegeId';
      });
      const hasSingleResourceIndex = indexes.some(([fields]) => {
        const keys = Object.keys(fields);
        return keys.length === 1 && keys[0] === 'resourceId';
      });

      expect(hasSingleCollegeIndex).toBe(false);
      expect(hasSingleResourceIndex).toBe(false);

      // Verify leading compound indexes still exist
      const hasCompoundResource = indexes.some(
        ([fields]) => fields.resourceId === 1 && fields.date === 1
      );
      const hasCompoundCollege = indexes.some(
        ([fields]) => fields.collegeId === 1 && fields.status === 1
      );

      expect(hasCompoundResource).toBe(true);
      expect(hasCompoundCollege).toBe(true);
    });
  });

  describe('Task 26 — Replace Deprecated Mongoose Option in announcementController', () => {
    it('uses { returnDocument: "after" } to successfully return the updated announcement document upon RSVP', async () => {
      const eventAnnouncement = await Announcement.create({
        collegeId: testCollege._id,
        title: `Campus Book Fair ${unique}`,
        content: 'Join us for author signings and discussions',
        category: 'Event',
        isEvent: true,
        maxCapacity: 10,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        createdBy: studentUser._id,
        isActive: true,
        rsvpUsers: [],
      });

      // Mock req and res for toggleRSVP
      const req = {
        params: { id: eventAnnouncement._id.toString() },
        user: { id: studentUser._id, _id: studentUser._id },
      };

      let jsonResponse = null;
      const res = {
        json: jest.fn((data) => {
          jsonResponse = data;
          return res;
        }),
      };

      // Execute toggleRSVP to add RSVP
      await toggleRSVP(req, res);

      expect(res.json).toHaveBeenCalled();
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data.hasRSVPd).toBe(true);
      expect(jsonResponse.data.currentRSVPCount).toBe(1);

      // Execute toggleRSVP again to remove RSVP
      await toggleRSVP(req, res);
      expect(jsonResponse.data.hasRSVPd).toBe(false);
      expect(jsonResponse.data.currentRSVPCount).toBe(0);
    });
  });
});
