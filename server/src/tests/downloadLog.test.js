const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_download_test';

const EResource = require('../models/EResource');
const DownloadLog = require('../models/DownloadLog');
const User = require('../models/User');
const College = require('../models/College');

describe('F10.1 & F10.2 — Offline Download Mode EResource Schema & DownloadLog', () => {
  let collegeA, userA, eResource;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await EResource.deleteMany({});
    await DownloadLog.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});

    collegeA = await College.create({
      name: 'College Alpha Downloads',
      shortName: 'ALPHADL',
      code: `ALPHADL_${Date.now()}`,
    });

    userA = await User.create({
      studentId: `STU_DL_${Date.now()}`,
      name: 'Student DL',
      email: `dl_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });
  });

  afterAll(async () => {
    await EResource.deleteMany({});
    await DownloadLog.deleteMany({});
    await User.deleteMany({});
    await College.deleteMany({});
    await mongoose.connection.close();
  });

  describe('F10.1 — EResource isDownloadable Flag Defaulting', () => {
    it('Acceptance Criteria: every existing/new resource defaults isDownloadable: false', async () => {
      eResource = await EResource.create({
        collegeId: collegeA._id,
        title: 'Introduction to Algorithms PDF',
        author: 'Thomas H. Cormen',
        type: 'pdf',
        category: 'Computer Science',
        fileUrl: 'https://storage.example.com/algorithms.pdf',
        uploadedBy: userA._id,
      });

      expect(eResource._id).toBeDefined();

      // ACCEPTANCE CRITERIA: isDownloadable defaults to false
      expect(eResource.isDownloadable).toBe(false);
    });

    it('allows admin to explicitly toggle isDownloadable to true', async () => {
      eResource.isDownloadable = true;
      await eResource.save();

      const updated = await EResource.findById(eResource._id);
      expect(updated.isDownloadable).toBe(true);
    });
  });

  describe('F10.2 — DownloadLog Schema', () => {
    it('Acceptance Criteria: creates a log entry with userId, resourceId, and downloadedAt timestamp', async () => {
      const log = await DownloadLog.create({
        userId: userA._id,
        resourceId: eResource._id,
      });

      expect(log._id).toBeDefined();
      expect(log.userId.toString()).toBe(userA._id.toString());
      expect(log.resourceId.toString()).toBe(eResource._id.toString());
      expect(log.downloadedAt).toBeInstanceOf(Date);
    });
  });
});
