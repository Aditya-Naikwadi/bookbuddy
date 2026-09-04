const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_tenant_test';
process.env.JWT_SECRET = 'testjwtlibrarysecretkey999';

jest.setTimeout(30000);

const app = require('../app');
const Annotation = require('../models/Annotation');
const EResource = require('../models/EResource');
const User = require('../models/User');
const College = require('../models/College');
const { generateTokenPair } = require('../utils/token');

describe('Phase 1: Annotation Tenant Isolation & Security Tests', () => {
  let collegeAId, collegeBId;
  let userA, userB, userC;
  let userAToken, userBToken, userCToken;
  let resourceA;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    collegeAId = new mongoose.Types.ObjectId().toString();
    collegeBId = new mongoose.Types.ObjectId().toString();

    // Clean up potential leftover test data across all relevant collections
    await Annotation.deleteMany({});
    await User.deleteMany({
      email: { $in: ['alice.ann@alpha.edu', 'bob.ann@beta.edu', 'charlie.ann@alpha.edu'] },
    });
    await College.deleteMany({ code: { $in: ['ALPHA_UNI', 'BETA_INST'] } });

    await College.create([
      { _id: collegeAId, name: 'Alpha University', code: 'ALPHA_UNI', status: 'active' },
      { _id: collegeBId, name: 'Beta Institute', code: 'BETA_INST', status: 'active' },
    ]);

    userA = await User.create({
      name: 'Alice Student',
      email: 'alice.ann@alpha.edu',
      studentId: 'STU_ANN_001',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeAId,
      isActive: true,
    });

    userB = await User.create({
      name: 'Bob Student',
      email: 'bob.ann@beta.edu',
      studentId: 'STU_ANN_002',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeBId,
      isActive: true,
    });

    userC = await User.create({
      name: 'Charlie Student',
      email: 'charlie.ann@alpha.edu',
      studentId: 'STU_ANN_003',
      password: 'Password123!',
      role: 'student',
      collegeId: collegeAId,
      isActive: true,
    });

    userAToken = generateTokenPair(userA).accessToken;
    userBToken = generateTokenPair(userB).accessToken;
    userCToken = generateTokenPair(userC).accessToken;

    resourceA = await EResource.create({
      collegeId: collegeAId,
      uploadedBy: userA._id,
      category: 'Science',
      type: 'pdf',
      title: 'Physics for Engineers',
      author: 'Dr. Newton',
      fileUrl: 'https://example.com/physics.pdf',
      fileType: 'pdf',
      format: 'pdf',
      accessLevel: 'public',
      status: 'active',
    });
  });

  afterAll(async () => {
    await Annotation.deleteMany({});
    if (resourceA?._id) {
      await EResource.deleteMany({ _id: resourceA._id });
    }
    await User.deleteMany({
      email: { $in: ['alice.ann@alpha.edu', 'bob.ann@beta.edu', 'charlie.ann@alpha.edu'] },
    });
    await College.deleteMany({ _id: { $in: [collegeAId, collegeBId] } });
    await mongoose.connection.close();
  });

  describe('1. Tenant Isolation & Ownership Safeguards', () => {
    let annotationA;

    it('Student A creates an annotation for resourceA', async () => {
      const res = await request(app)
        .post(`/api/v1/books/${resourceA._id}/annotations`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          type: 'highlight',
          page: 5,
          highlightText: 'Quantum entanglement basics',
          color: 'yellow',
          clientId: 'client-uuid-001',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId.toString()).toBe(userA._id.toString());
      expect(res.body.data.collegeId.toString()).toBe(collegeAId.toString());
      annotationA = res.body.data;
    });

    it('Student A posting with spoofed collegeId/userId in body is ignored and forced to token identity', async () => {
      const spoofedCollegeId = new mongoose.Types.ObjectId().toString();
      const spoofedUserId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post(`/api/v1/books/${resourceA._id}/annotations`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          collegeId: spoofedCollegeId,
          userId: spoofedUserId,
          type: 'bookmark',
          page: 10,
          label: 'Chapter 2 Start',
          clientId: 'client-uuid-002',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.collegeId.toString()).toBe(collegeAId.toString());
      expect(res.body.data.userId.toString()).toBe(userA._id.toString());
    });

    it('Student B (different college) cannot see Student A annotations for resourceA', async () => {
      const res = await request(app)
        .get(`/api/v1/books/${resourceA._id}/annotations`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('Student C (same college, different user) cannot see Student A annotations', async () => {
      const res = await request(app)
        .get(`/api/v1/books/${resourceA._id}/annotations`)
        .set('Authorization', `Bearer ${userCToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('Student B cannot PATCH Student A annotation (404/unauthorized)', async () => {
      const res = await request(app)
        .patch(`/api/v1/annotations/${annotationA._id}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ color: 'pink', noteText: 'Malicious update' });

      expect(res.status).toBe(404);
    });

    it('Student C cannot DELETE Student A annotation (404/unauthorized)', async () => {
      const res = await request(app)
        .delete(`/api/v1/annotations/${annotationA._id}`)
        .set('Authorization', `Bearer ${userCToken}`);

      expect(res.status).toBe(404);
    });

    it('Student A can update their own annotation', async () => {
      const res = await request(app)
        .patch(`/api/v1/annotations/${annotationA._id}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ color: 'green', noteText: 'Added study note' });

      expect(res.status).toBe(200);
      expect(res.body.data.color).toBe('green');
      expect(res.body.data.noteText).toBe('Added study note');
    });
  });

  describe('2. Data Caps & Validation', () => {
    it('Note length exceeding 5000 characters is rejected with HTTP 400', async () => {
      const hugeNote = 'A'.repeat(5001);
      const res = await request(app)
        .post(`/api/v1/books/${resourceA._id}/annotations`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          type: 'note',
          page: 1,
          noteText: hugeNote,
        });

      expect(res.status).toBe(400);
    });

    it('Annotation soft cap limit (500/user/book) returns ANNOTATION_COUNT_LIMIT_REACHED error', async () => {
      const countSpy = jest.spyOn(Annotation, 'countDocuments').mockResolvedValue(500);

      const res = await request(app)
        .post(`/api/v1/books/${resourceA._id}/annotations`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          type: 'highlight',
          page: 2,
          highlightText: 'Cap test',
        });

      countSpy.mockRestore();

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ANNOTATION_COUNT_LIMIT_REACHED');
    });
  });
});
