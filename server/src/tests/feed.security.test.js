const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_feed_security_test';

const app = require('../app');
const FeedPost = require('../models/FeedPost');
const User = require('../models/User');
const College = require('../models/College');
const { generateAccessToken } = require('../utils/token');

describe('F5.6 & F5.5 — Cross-College Feed Security Isolation & Socket Broadcasting', () => {
  let collegeA, collegeB;
  let adminA, studentA, studentB;
  let tokenStudentA, tokenAdminA;
  let postA1, postA2, postB1_event;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await FeedPost.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});

    // Create College A and College B
    collegeA = await College.create({
      name: 'College Alpha',
      shortName: 'ALPHA',
      code: `ALPHA_SEC_${Date.now()}`,
    });

    collegeB = await College.create({
      name: 'College Beta',
      shortName: 'BETA',
      code: `BETA_SEC_${Date.now()}`,
    });

    // Create Users for College A and College B
    adminA = await User.create({
      studentId: `ADM_A_${Date.now()}`,
      name: 'Admin Alpha',
      email: `admin_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeA._id,
    });

    studentA = await User.create({
      studentId: `STU_A_${Date.now()}`,
      name: 'Student Alpha',
      email: `student_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    studentB = await User.create({
      studentId: `STU_B_${Date.now()}`,
      name: 'Student Beta',
      email: `student_${Date.now()}@beta.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeB._id,
    });

    tokenAdminA = generateAccessToken(adminA);
    tokenStudentA = generateAccessToken(studentA);

    // Populate posts for College A and College B
    postA1 = await FeedPost.create({
      collegeId: collegeA._id,
      type: 'announcement',
      title: 'College A Official Announcement',
      body: 'Welcome students of College Alpha',
      authorId: adminA._id,
      audience: ['student'],
    });

    postA2 = await FeedPost.create({
      collegeId: collegeA._id,
      type: 'event',
      title: 'College A Hackathon',
      body: 'Coding event for Alpha students',
      authorId: adminA._id,
      eventDate: new Date(Date.now() + 86400000),
      audience: ['student'],
    });

    postB1_event = await FeedPost.create({
      collegeId: collegeB._id,
      type: 'event',
      title: 'College B Secret Event',
      body: 'Private event for Beta students only',
      authorId: new mongoose.Types.ObjectId(),
      eventDate: new Date(Date.now() + 86400000),
      audience: ['student'],
    });
  });

  afterAll(async () => {
    await FeedPost.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});
    await mongoose.connection.close();
  });

  describe('F5.6 — Cross-College Feed Isolation Attack Vectors', () => {
    it('Attack Vector 1: Query-param manipulation — Student A attempting to fetch College B feed via ?collegeId= returns empty / College A posts only', async () => {
      const res = await request(app)
        .get(`/api/v1/feed?collegeId=${collegeB._id}`)
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const returnedPostIds = res.body.data.map((p) => p._id.toString());

      // STRICT ISOLATION ACCEPTANCE CRITERIA:
      // Must NOT leak College B's post
      expect(returnedPostIds).not.toContain(postB1_event._id.toString());
      // Must contain College A's post
      expect(returnedPostIds).toContain(postA1._id.toString());
    });

    it('Attack Vector 2: Header spoofing — Student A passing spoofed x-college-id / x-tenant-id headers receives ZERO College B data', async () => {
      const res = await request(app)
        .get('/api/v1/feed')
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .set('x-college-id', collegeB._id.toString())
        .set('x-tenant-id', collegeB._id.toString())
        .set('x-requested-college', collegeB._id.toString());

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const returnedPostIds = res.body.data.map((p) => p._id.toString());

      // STRICT ISOLATION ACCEPTANCE CRITERIA:
      // Spoofed headers MUST be ignored, zero College B records returned
      expect(returnedPostIds).not.toContain(postB1_event._id.toString());
      expect(returnedPostIds).toContain(postA1._id.toString());
    });

    it('Attack Vector 3: Direct post-ID guessing — Student A RSVPing to College B post returns 404 / 403 and does not modify College B post', async () => {
      const res = await request(app)
        .post(`/api/v1/feed/${postB1_event._id}/rsvp`)
        .set('Authorization', `Bearer ${tokenStudentA}`);

      // STRICT ISOLATION ACCEPTANCE CRITERIA: Returns 404/403, never modifies College B data
      expect([403, 404]).toContain(res.statusCode);

      // Verify DB state: College B post rsvps remains empty
      const freshPostB = await FeedPost.findById(postB1_event._id);
      expect(freshPostB.rsvps).toHaveLength(0);
    });

    it('Attack Vector 3b: Admin A attempting to create post for College B via spoofed body collegeId forces College A binding', async () => {
      const res = await request(app)
        .post('/api/v1/feed')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          type: 'announcement',
          title: 'Spoofed Tenant Post',
          body: 'Attempting to inject post into College B',
          collegeId: collegeB._id.toString(),
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.collegeId.toString()).toBe(collegeA._id.toString());
      expect(res.body.data.collegeId.toString()).not.toBe(collegeB._id.toString());
    });
  });

  describe('F5.5 — Socket.io College Room Broadcast Isolation', () => {
    it('Acceptance Criteria: broadcasting feed:new sends only to matching college room', async () => {
      const emittedEvents = [];
      const mockIo = {
        to: (room) => ({
          emit: (event, payload) => {
            emittedEvents.push({ room, event, payload });
          },
        }),
      };

      app.set('io', mockIo);

      const res = await request(app)
        .post('/api/v1/feed')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          type: 'event',
          title: 'Live College A Hackathon Announcement',
          body: 'Broadcast test for Alpha room',
          eventDate: new Date(Date.now() + 86400000),
          audience: ['student'],
        });

      expect(res.statusCode).toBe(201);
      expect(emittedEvents).toHaveLength(1);

      // ACCEPTANCE CRITERIA: Live event emitted strictly to college:collegeA._id room
      expect(emittedEvents[0].room).toBe(`college:${collegeA._id}`);
      expect(emittedEvents[0].event).toBe('feed:new');
      expect(emittedEvents[0].payload.title).toBe('Live College A Hackathon Announcement');

      // Verified: No message emitted to collegeB room
      expect(emittedEvents[0].room).not.toBe(`college:${collegeB._id}`);
    });
  });
});
