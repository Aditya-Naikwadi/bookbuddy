const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_signed_dl_test';

const app = require('../app');
const EResource = require('../models/EResource');
const DownloadLog = require('../models/DownloadLog');
const User = require('../models/User');
const College = require('../models/College');
const { generateAccessToken } = require('../utils/token');

describe('F10.3 — Signed Download-URL Endpoint & Access Control Security', () => {
  let collegeA;
  let adminA, studentA;
  let tokenAdminA, tokenStudentA;
  let nonDownloadableResource, downloadableResource;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await EResource.deleteMany({});
    await DownloadLog.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});

    collegeA = await College.create({
      name: 'College Alpha Signed DL',
      shortName: 'ALPHASDL',
      code: `ALPHASDL_${Date.now()}`,
    });

    adminA = await User.create({
      studentId: `ADM_DL_${Date.now()}`,
      name: 'Admin Alpha',
      email: `admin_dl_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeA._id,
    });

    studentA = await User.create({
      studentId: `STU_DL_${Date.now()}`,
      name: 'Student Alpha',
      email: `student_dl_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    tokenAdminA = generateAccessToken(adminA);
    tokenStudentA = generateAccessToken(studentA);

    // Non-downloadable resource (isDownloadable: false)
    nonDownloadableResource = await EResource.create({
      collegeId: collegeA._id,
      title: 'Restricted Textbook PDF',
      author: 'Academic Press',
      type: 'pdf',
      category: 'Computer Science',
      fileUrl: 'https://storage.example.com/restricted.pdf',
      uploadedBy: adminA._id,
      isDownloadable: false,
    });

    // Downloadable resource (isDownloadable: true)
    downloadableResource = await EResource.create({
      collegeId: collegeA._id,
      title: 'Open Access Research Paper',
      author: 'Open Science Foundation',
      type: 'pdf',
      category: 'Computer Science',
      fileUrl: 'https://storage.example.com/openaccess.pdf',
      uploadedBy: adminA._id,
      isDownloadable: true,
    });
  });

  afterAll(async () => {
    await EResource.deleteMany({});
    await DownloadLog.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});
    await mongoose.connection.close();
  });

  describe('GET /api/v1/eresources/:id/download-url', () => {
    it('Acceptance Criteria: a direct API call against a resource with isDownloadable: false NEVER returns a usable URL, regardless of caller role', async () => {
      // 1. Student caller against non-downloadable resource
      const resStudent = await request(app)
        .get(`/api/v1/eresources/${nonDownloadableResource._id}/download-url`)
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(resStudent.statusCode).toBe(403);
      expect(resStudent.body.downloadUrl).toBeUndefined();

      // 2. Admin caller against non-downloadable resource
      const resAdmin = await request(app)
        .get(`/api/v1/eresources/${nonDownloadableResource._id}/download-url`)
        .set('Authorization', `Bearer ${tokenAdminA}`);

      // ACCEPTANCE CRITERIA: Returns 403, NEVER returns usable download URL regardless of caller's role
      expect(resAdmin.statusCode).toBe(403);
      expect(resAdmin.body.downloadUrl).toBeUndefined();

      // Verify ZERO download log entries created for blocked attempt
      const logsCount = await DownloadLog.countDocuments({
        resourceId: nonDownloadableResource._id,
      });
      expect(logsCount).toBe(0);
    });

    it('returns short-lived signed URL and creates DownloadLog entry when isDownloadable: true', async () => {
      const res = await request(app)
        .get(`/api/v1/eresources/${downloadableResource._id}/download-url`)
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.downloadUrl).toBeDefined();
      expect(res.body.downloadUrl).toContain('token=');

      // ACCEPTANCE CRITERIA: A log entry is created in DownloadLog on signed-URL issuance
      const log = await DownloadLog.findOne({
        userId: studentA._id,
        resourceId: downloadableResource._id,
      });

      expect(log).toBeDefined();
      expect(log.downloadedAt).toBeInstanceOf(Date);
    });
  });
});
