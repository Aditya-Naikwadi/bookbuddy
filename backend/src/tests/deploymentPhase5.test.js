const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const app = require('../app');
const storage = require('../utils/storage');
const User = require('../models/User');
const College = require('../models/College');
const EResource = require('../models/EResource');
const DownloadLog = require('../models/DownloadLog');

describe('Deployment Phase 5: File Delivery, Storage Abstraction & Uploads', () => {
  let college;
  let studentUser;
  let studentToken;
  let adminUser;
  let adminToken;
  let testFileKey;
  let testFilePath;

  beforeAll(async () => {
    // Connect to test database if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test_phase5',
        { serverSelectionTimeoutMS: 2000 }
      );
    }

    // Clean up test collections
    await College.deleteMany({ code: 'PHASE5-COL' });
    await User.deleteMany({ email: { $regex: /@phase5\.edu$/ } });
    await EResource.deleteMany({ title: { $regex: /Phase5/ } });
    await DownloadLog.deleteMany({});

    // Create test college
    college = await College.create({
      name: 'Phase 5 Engineering College',
      code: 'PHASE5-COL',
      slug: 'phase5-eng',
      status: 'active',
      isActive: true,
      domain: 'phase5.edu',
      tierLimits: {
        maxStorageBytes: 100 * 1024 * 1024, // 100MB
      },
    });

    // Create test student
    studentUser = await User.create({
      name: 'Phase5 Student',
      email: 'student@phase5.edu',
      password: 'password123',
      role: 'student',
      studentId: 'STU-PHASE5-001',
      collegeId: college._id,
      isVerified: true,
      status: 'active',
    });

    // Create test college admin
    adminUser = await User.create({
      name: 'Phase5 Admin',
      email: 'admin@phase5.edu',
      password: 'password123',
      role: 'college-admin',
      staffId: 'STAFF-PHASE5-001',
      collegeId: college._id,
      isVerified: true,
      status: 'active',
    });

    // Generate JWT tokens
    const { generateTokenPair } = require('../utils/token');
    const studentTokens = generateTokenPair(studentUser);
    studentToken = studentTokens.accessToken;

    const adminTokens = generateTokenPair(adminUser);
    adminToken = adminTokens.accessToken;

    // Create a temporary test file in uploads with valid EPUB structure
    testFileKey = `ebooks/test_phase5_${Date.now()}.epub`;
    testFilePath = storage.resolveStorageLocalPath(testFileKey);
    const parentDir = path.dirname(testFilePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('mimetype', Buffer.from('application/epub+zip'));
    zip.writeZip(testFilePath);
  });

  afterAll(async () => {
    // Clean up temporary test files
    if (testFilePath && fs.existsSync(testFilePath)) {
      try {
        fs.unlinkSync(testFilePath);
      } catch {
        // ignore cleanup error
      }
    }
    await College.deleteMany({ code: 'PHASE5-COL' });
    await User.deleteMany({ email: { $regex: /@phase5\.edu$/ } });
    await EResource.deleteMany({ title: { $regex: /Phase5/ } });
    await DownloadLog.deleteMany({});
  });

  describe('1. Storage Provider Abstraction (Step 33)', () => {
    it('should determine the active storage provider correctly based on environment', () => {
      // Default with no env overrides is local
      expect(storage.getStorageProvider()).toBe('local');

      // Honors explicit STORAGE_PROVIDER
      expect(storage.getStorageProvider('gcs')).toBe('gcs');
      expect(storage.getStorageProvider('vercel-blob')).toBe('vercel-blob');
    });

    it('should generate valid presigned upload URL with HMAC token and expiry', async () => {
      const result = await storage.generatePresignedUploadUrl({
        fileName: 'sample_physics.epub',
        fileType: 'application/epub+zip',
        folder: 'ebooks',
        expiresInSeconds: 600,
      });

      expect(result.provider).toBe('local');
      expect(result.fileKey).toMatch(/^ebooks\/\d+_[a-f0-9]+\.epub$/);
      expect(result.uploadUrl).toContain('/api/v1/uploads/direct/');
      expect(result.uploadUrl).toContain('token=');
      expect(result.uploadUrl).toContain('expires=');
      expect(result.expiresInSeconds).toBe(600);
      expect(result.maxSizeBytes).toBe(50 * 1024 * 1024);
    });

    it('should generate valid presigned download URL with HMAC token and filename', async () => {
      const result = await storage.generatePresignedDownloadUrl({
        fileKey: 'ebooks/textbook123.epub',
        fileName: 'Textbook Physics',
        expiresInSeconds: 900,
      });

      expect(result.provider).toBe('local');
      expect(result.downloadUrl).toContain('/api/v1/storage/download/');
      expect(result.downloadUrl).toContain('token=');
      expect(result.downloadUrl).toContain('expires=');
      expect(result.downloadUrl).toContain('filename=Textbook+Physics');
    });

    it('should correctly verify valid storage tokens and reject tampered or expired tokens', () => {
      const fileKey = 'ebooks/secure_test.epub';
      const { token, expires } = storage.createStorageToken({
        operation: 'download',
        fileKey,
        expiresInSeconds: 300,
      });

      // Valid token passes
      expect(storage.verifyStorageToken({ operation: 'download', fileKey, token, expires })).toBe(
        true
      );

      // Tampered operation fails
      expect(storage.verifyStorageToken({ operation: 'upload', fileKey, token, expires })).toBe(
        false
      );

      // Tampered fileKey fails
      expect(
        storage.verifyStorageToken({
          operation: 'download',
          fileKey: 'ebooks/other.epub',
          token,
          expires,
        })
      ).toBe(false);

      // Tampered signature token fails
      expect(
        storage.verifyStorageToken({
          operation: 'download',
          fileKey,
          token: 'invalidhexsignature1234567890abcdef',
          expires,
        })
      ).toBe(false);

      // Expired timestamp fails
      const pastExpires = String(Date.now() - 10000);
      expect(
        storage.verifyStorageToken({
          operation: 'download',
          fileKey,
          token,
          expires: pastExpires,
        })
      ).toBe(false);
    });

    it('should strictly reject path traversal attempts when resolving local paths', () => {
      expect(() => storage.resolveStorageLocalPath('../../etc/passwd')).toThrow(
        /Directory traversal or absolute paths are strictly prohibited/
      );
      expect(() => storage.resolveStorageLocalPath('/etc/shadow')).toThrow(
        /Directory traversal or absolute paths are strictly prohibited/
      );
      expect(() => storage.resolveStorageLocalPath('ebooks/../../../windows/system32')).toThrow(
        /Directory traversal or absolute paths are strictly prohibited/
      );
    });
  });

  describe('2. Direct Presigned Upload Receiver (Step 32)', () => {
    it('should reject direct upload when token is missing or invalid', async () => {
      const res = await request(app)
        .put('/api/v1/uploads/direct/ebooks/unauthorized.epub')
        .send('sample payload');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Presigned upload token is invalid or has expired/);
    });

    it('should accept direct stream upload with valid presigned HMAC token', async () => {
      const fileKey = `ebooks/direct_stream_${Date.now()}.epub`;
      const { token, expires } = storage.createStorageToken({
        operation: 'upload',
        fileKey,
        expiresInSeconds: 300,
      });

      const res = await request(app)
        .put(
          `/api/v1/uploads/direct/${encodeURIComponent(fileKey)}?token=${token}&expires=${expires}`
        )
        .set('Content-Type', 'application/epub+zip')
        .send('Binary streaming textbook content');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fileKey).toBe(fileKey);
      expect(res.body.data.publicUrl).toBe(`/uploads/${fileKey}`);
      expect(res.body.data.sizeBytes).toBeGreaterThan(0);

      // Verify file written to disk
      const diskPath = storage.resolveStorageLocalPath(fileKey);
      expect(fs.existsSync(diskPath)).toBe(true);

      // Clean up
      try {
        fs.unlinkSync(diskPath);
      } catch {
        // ignore
      }
    });

    it('should reject uploads exceeding the configured maximum size limit (413 Payload Too Large)', async () => {
      const fileKey = `ebooks/oversized_${Date.now()}.epub`;
      const { token, expires } = storage.createStorageToken({
        operation: 'upload',
        fileKey,
        expiresInSeconds: 300,
      });

      // Claim content-length above 50MB
      const fakeLength = 55 * 1024 * 1024; // 55MB
      const res = await request(app)
        .put(
          `/api/v1/uploads/direct/${encodeURIComponent(fileKey)}?token=${token}&expires=${expires}`
        )
        .set('Content-Type', 'application/epub+zip')
        .set('Content-Length', String(fakeLength))
        .send('a');

      expect(res.status).toBe(413);
      expect(res.body.message).toMatch(/File size exceeds maximum allowed upload limit/);
    });
  });

  describe('3. Direct Presigned Download Endpoint (Step 31)', () => {
    it('should reject direct download if token is missing or expired', async () => {
      const res = await request(app).get(
        `/api/v1/storage/download/${encodeURIComponent(testFileKey)}`
      );

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Presigned download token is invalid or has expired/);
    });

    it('should serve file directly with security headers when token is valid', async () => {
      const { token, expires } = storage.createStorageToken({
        operation: 'download',
        fileKey: testFileKey,
        expiresInSeconds: 300,
      });

      const res = await request(app).get(
        `/api/v1/storage/download/${encodeURIComponent(testFileKey)}?token=${token}&expires=${expires}&filename=PhysicsBook.epub`
      );

      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBe("sandbox; default-src 'none'");
      expect(res.headers['content-disposition']).toContain('PhysicsBook.epub');
      expect(res.text).toContain('mimetype');
    });

    it('should support HTTP 206 Partial Content Range requests on direct storage download', async () => {
      const { token, expires } = storage.createStorageToken({
        operation: 'download',
        fileKey: testFileKey,
        expiresInSeconds: 300,
      });

      const res = await request(app)
        .get(
          `/api/v1/storage/download/${encodeURIComponent(testFileKey)}?token=${token}&expires=${expires}`
        )
        .set('Range', 'bytes=0-10');

      expect(res.status).toBe(206);
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.headers['content-range']).toMatch(/^bytes 0-10\//);
    });
  });

  describe('4. E-Resource Delivery, Access Checks & Download Logging (Step 31)', () => {
    let publishedResource;
    let unpublishedResource;

    beforeAll(async () => {
      publishedResource = await EResource.create({
        collegeId: college._id,
        title: 'Phase5 Approved Textbook',
        author: 'Prof. Test',
        category: 'Engineering',
        type: 'epub',
        fileUrl: `/uploads/${testFileKey}`,
        storageKey: testFileKey,
        uploadedBy: adminUser._id,
        moderationStatus: 'published',
        isPublished: true,
        isDownloadable: true,
        source: 'internal',
        fileSizeBytes: 1024,
      });

      unpublishedResource = await EResource.create({
        collegeId: college._id,
        title: 'Phase5 Draft Book',
        author: 'Prof. Draft',
        category: 'Engineering',
        type: 'epub',
        fileUrl: `/uploads/${testFileKey}`,
        storageKey: testFileKey,
        uploadedBy: adminUser._id,
        moderationStatus: 'pending',
        isPublished: false,
        isDownloadable: false,
        source: 'internal',
        fileSizeBytes: 1024,
      });
    });

    it('should block unauthorized access to unpublished resources for normal students', async () => {
      const res = await request(app)
        .get(`/api/v1/reader/${unpublishedResource._id}/content`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/This e-resource is not published yet/);
    });

    it('should log an audit record in DownloadLog on resource access', async () => {
      const beforeCount = await DownloadLog.countDocuments({ resourceId: publishedResource._id });

      const res = await request(app)
        .get(`/api/v1/reader/${publishedResource._id}/content`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-Forwarded-For', '203.0.113.42');

      expect(res.status).toBe(200);

      const afterCount = await DownloadLog.countDocuments({ resourceId: publishedResource._id });
      expect(afterCount).toBe(beforeCount + 1);

      const log = await DownloadLog.findOne({ resourceId: publishedResource._id }).sort({
        createdAt: -1,
      });
      expect(log.userId.toString()).toBe(studentUser._id.toString());
      expect(log.collegeId.toString()).toBe(college._id.toString());
      expect(log.ipAddress).toBeDefined();
    });

    it('should return short-lived signed download URL when requested with format=json', async () => {
      const res = await request(app)
        .get(`/api/v1/reader/${publishedResource._id}/content?format=json`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.downloadUrl).toContain('/api/v1/storage/download/');
      expect(res.body.downloadUrl).toContain('token=');
      expect(res.body.expiresInSeconds).toBe(900);
    });

    it('should return 302 redirect to signed URL when redirect=true query parameter is passed', async () => {
      const res = await request(app)
        .get(`/api/v1/reader/${publishedResource._id}/content?redirect=true`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/api/v1/storage/download/');
    });

    it('should return signed storage URL via getSignedDownloadUrl endpoint', async () => {
      const res = await request(app)
        .get(`/api/v1/eresources/${publishedResource._id}/download-url`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.downloadUrl).toContain('/api/v1/storage/download/');
    });
  });

  describe('5. Direct-to-Storage Registration Flow (Step 32)', () => {
    it('should allow registering a pre-uploaded e-resource using fileKey', async () => {
      const res = await request(app)
        .post('/api/v1/reader/register-upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Phase5 Direct Registered Book',
          author: 'Dr. Storage',
          category: 'Computer Science',
          fileKey: testFileKey,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.storageKey).toBe(testFileKey);
      expect(res.body.data.uploadStatus).toBe('available');
    });

    it('should allow student material submission with pre-uploaded fileKey', async () => {
      const res = await request(app)
        .post('/api/v1/eresources/submit')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Phase5 Student Notes Direct Upload',
          category: 'Mathematics',
          description: 'Calculus lecture notes',
          fileKey: testFileKey,
          fileSizeBytes: 2048,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.storageKey).toBe(testFileKey);
      expect(res.body.data.moderationStatus).toBe('pending');
    });
  });
});
