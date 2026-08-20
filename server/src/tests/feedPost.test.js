const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_feed_test';

const FeedPost = require('../models/FeedPost');
const User = require('../models/User');
const College = require('../models/College');
const { createFeedPost, getFeedPosts, rsvpEvent } = require('../controllers/feedController');

describe('FeedPost Schema & Endpoints (F5.1, F5.2, F5.3, F5.4)', () => {
  let collegeA, collegeB;
  let adminUser, studentUser;

  const mockRes = () => {
    let responseData = null;
    let statusCode = 200;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      },
    };
    return { res, getStatus: () => statusCode, getData: () => responseData };
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await FeedPost.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});

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

    adminUser = await User.create({
      studentId: `ADM_${Date.now()}`,
      name: 'Admin User',
      email: `admin_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeA._id,
    });

    studentUser = await User.create({
      studentId: `STU_${Date.now()}`,
      name: 'Student User',
      email: `student_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });
  });

  afterAll(async () => {
    await FeedPost.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});
    await mongoose.connection.close();
  });

  describe('F5.1 — FeedPost Schema Single Discriminator', () => {
    it('Acceptance Criteria: announcement-type posts validate correctly against FeedPost schema', async () => {
      const post = await FeedPost.create({
        collegeId: collegeA._id,
        type: 'announcement',
        title: 'Library Renovation Update',
        body: 'The 2nd floor study wing will open tomorrow.',
        authorId: adminUser._id,
        audience: ['student', 'college-admin'],
      });

      expect(post._id).toBeDefined();
      expect(post.type).toBe('announcement');
      expect(post.title).toBe('Library Renovation Update');
      expect(post.collegeId.toString()).toBe(collegeA._id.toString());
    });

    it('Acceptance Criteria: event-type posts validate correctly against FeedPost schema', async () => {
      const eventDate = new Date(Date.now() + 86400000);
      const post = await FeedPost.create({
        collegeId: collegeA._id,
        type: 'event',
        title: 'Book Club Monthly Meetup',
        body: 'Join us for a discussion on Clean Code.',
        authorId: adminUser._id,
        eventDate,
        audience: ['student'],
      });

      expect(post._id).toBeDefined();
      expect(post.type).toBe('event');
      expect(post.eventDate).toEqual(eventDate);
    });

    it('should reject invalid post type values', async () => {
      await expect(
        FeedPost.create({
          collegeId: collegeA._id,
          type: 'invalid_type',
          title: 'Invalid',
          body: 'Invalid',
          authorId: adminUser._id,
        })
      ).rejects.toThrow();
    });
  });

  describe('F5.2 — Admin-Only Post Creation & Tenant Security', () => {
    it('Acceptance Criteria: a student-role request to post creation endpoint returns 403', async () => {
      const req = {
        user: { id: studentUser._id.toString(), role: 'student', collegeId: collegeA._id },
        body: {
          type: 'announcement',
          title: 'Student Attempt',
          body: 'Should be rejected',
        },
      };

      const { res } = mockRes();
      await expect(createFeedPost(req, res)).rejects.toHaveProperty('statusCode', 403);
    });

    it('Acceptance Criteria: a request with a spoofed collegeId in body is ignored (uses req.user.collegeId)', async () => {
      const req = {
        user: { id: adminUser._id.toString(), role: 'college-admin', collegeId: collegeA._id },
        body: {
          type: 'announcement',
          title: 'Admin Post with Spoofed College',
          body: 'Testing collegeId isolation',
          collegeId: collegeB._id.toString(), // Spoofed collegeId in body
        },
      };

      const { res, getStatus, getData } = mockRes();
      await createFeedPost(req, res);

      expect(getStatus()).toBe(201);
      const createdPost = getData().data;
      expect(createdPost).toBeDefined();
      expect(createdPost.collegeId.toString()).toBe(collegeA._id.toString());
      expect(createdPost.collegeId.toString()).not.toBe(collegeB._id.toString());
    });
  });

  describe('F5.3 — Student Feed Read Endpoint (Tenant + Audience + Expiry Filtered)', () => {
    let expiredPost, activeStudentPost, adminOnlyPost;

    beforeAll(async () => {
      // Past expired post
      expiredPost = await FeedPost.create({
        collegeId: collegeA._id,
        type: 'announcement',
        title: 'Expired Announcement',
        body: 'This event passed yesterday',
        authorId: adminUser._id,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        audience: ['student'],
      });

      // Active student post
      activeStudentPost = await FeedPost.create({
        collegeId: collegeA._id,
        type: 'announcement',
        title: 'Active Student Announcement',
        body: 'Welcome to campus',
        authorId: adminUser._id,
        expiresAt: new Date(Date.now() + 86400000), // 1 day in future
        audience: ['student'],
      });

      // Admin-only post
      adminOnlyPost = await FeedPost.create({
        collegeId: collegeA._id,
        type: 'announcement',
        title: 'Admin Policy Change',
        body: 'Confidential admin note',
        authorId: adminUser._id,
        expiresAt: new Date(Date.now() + 86400000),
        audience: ['admin', 'college-admin'],
      });
    });

    it('Acceptance Criteria: a post whose expiresAt has passed never appears in response, and admin-only post never appears for a student requester', async () => {
      const req = {
        user: { id: studentUser._id.toString(), role: 'student', collegeId: collegeA._id },
        query: {},
      };

      const { res, getData } = mockRes();
      await getFeedPosts(req, res);

      const returnedPosts = getData().data;
      const titles = returnedPosts.map((p) => p.title);

      // Acceptance Criterion 1: Expired post MUST NOT appear
      expect(titles).not.toContain('Expired Announcement');

      // Acceptance Criterion 2: Admin-only post MUST NOT appear for student
      expect(titles).not.toContain('Admin Policy Change');

      // Active student post SHOULD appear
      expect(titles).toContain('Active Student Announcement');
    });
  });

  describe('F5.4 — RSVP Endpoint', () => {
    let eventPost, announcementPost;

    beforeAll(async () => {
      eventPost = await FeedPost.create({
        collegeId: collegeA._id,
        type: 'event',
        title: 'Hackathon 2026',
        body: 'Coding competition',
        authorId: adminUser._id,
        eventDate: new Date(Date.now() + 86400000),
        audience: ['student'],
        rsvps: [],
      });

      announcementPost = await FeedPost.create({
        collegeId: collegeA._id,
        type: 'announcement',
        title: 'General News',
        body: 'No RSVP allowed here',
        authorId: adminUser._id,
        audience: ['student'],
      });
    });

    it('Acceptance Criteria: returns a 400 if the target post type is not event', async () => {
      const req = {
        user: { id: studentUser._id.toString(), role: 'student', collegeId: collegeA._id },
        params: { id: announcementPost._id.toString() },
      };

      const { res } = mockRes();
      await expect(rsvpEvent(req, res)).rejects.toHaveProperty('statusCode', 400);
    });

    it('Acceptance Criteria: RSVP-ing twice by the same user toggles the entry off, rather than creating a duplicate entry', async () => {
      const req = {
        user: { id: studentUser._id.toString(), role: 'student', collegeId: collegeA._id },
        params: { id: eventPost._id.toString() },
      };

      // 1st RSVP call: Should toggle ON
      const { res: res1, getData: getData1 } = mockRes();
      await rsvpEvent(req, res1);

      expect(getData1().isRsvped).toBe(true);
      let updatedPost = await FeedPost.findById(eventPost._id);
      expect(updatedPost.rsvps).toHaveLength(1);
      expect(updatedPost.rsvps[0].userId.toString()).toBe(studentUser._id.toString());

      // 2nd RSVP call: Should toggle OFF
      const { res: res2, getData: getData2 } = mockRes();
      await rsvpEvent(req, res2);

      expect(getData2().isRsvped).toBe(false);
      updatedPost = await FeedPost.findById(eventPost._id);
      // Verified: Toggled off, rsvps length is 0 (no duplicate entries)
      expect(updatedPost.rsvps).toHaveLength(0);
    });
  });
});
