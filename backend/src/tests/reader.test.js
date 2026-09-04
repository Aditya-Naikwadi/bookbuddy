const request = require('supertest');
const mongoose = require('mongoose');
const AdmZip = require('adm-zip');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_reader_test';
process.env.JWT_SECRET = 'testjwtsecretreaderkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretreaderkey999';
process.env.JWT_ACCESS_EXPIRY = '10m';
process.env.JWT_REFRESH_EXPIRY = '7d';
jest.setTimeout(30000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const EResource = require('../models/EResource');
const ReadingPosition = require('../models/ReadingPosition');
const { generateTokenPair } = require('../utils/token');

describe('Feature 4: Ebook Reader & Safe Proxy Integration Tests', () => {
  let collegeA;
  let studentA;
  let tokenStudentA;
  let resourceA;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    await College.deleteMany({});
    await User.deleteMany({});
    await EResource.deleteMany({});
    await ReadingPosition.deleteMany({});

    // 1. Create College
    collegeA = await College.create({
      name: 'Ebook Academy',
      code: 'EBA',
      domain: 'academy.edu',
      status: 'active',
      subscriptionTier: 'premium',
    });

    // 2. Create Student
    studentA = await User.create({
      studentId: 'STU_EBOOK_001',
      collegeId: collegeA._id,
      name: 'Lars Reader',
      email: 'lars@academy.edu',
      password: 'password123',
      role: 'student',
      status: 'active',
    });

    tokenStudentA = generateTokenPair(studentA).accessToken;

    // 3. Create a dummy Gutenberg EResource
    resourceA = await EResource.create({
      collegeId: collegeA._id,
      title: 'Frankenstein',
      author: 'Mary Shelley',
      category: 'Science Fiction',
      type: 'epub',
      fileUrl: 'https://www.gutenberg.org/ebooks/84.epub.images',
      uploadedBy: studentA._id,
      moderationStatus: 'approved',
      source: 'gutenberg',
      sourceType: 'gutenberg',
      epubUrl: 'https://www.gutenberg.org/ebooks/84.epub.images',
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/reader/upload', () => {
    it('should reject file upload when no file is attached', async () => {
      const res = await request(app)
        .post('/api/v1/reader/upload')
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('No file was uploaded');
    });

    it('should reject non-EPUB file structures (invalid zip)', async () => {
      const invalidBuffer = Buffer.from('hello world plain text file content');
      const res = await request(app)
        .post('/api/v1/reader/upload')
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .attach('file', invalidBuffer, 'test.epub');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Failed to unpack ZIP structure');
    });

    it('should reject EPUBs missing mimetype entry or invalid mimetype contents', async () => {
      const zip = new AdmZip();
      zip.addFile('content.opf', Buffer.from('<package></package>'));
      const buffer = zip.toBuffer();

      const res = await request(app)
        .post('/api/v1/reader/upload')
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .attach('file', buffer, 'test.epub');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('mimetype file is missing');
    });

    it('should reject EPUB containers containing script tags (mitigating Stored XSS)', async () => {
      const zip = new AdmZip();
      zip.addFile('mimetype', Buffer.from('application/epub+zip'));
      zip.addFile(
        'OEBPS/text.html',
        Buffer.from('<html><body><script>alert(1)</script></body></html>')
      );
      const buffer = zip.toBuffer();

      const res = await request(app)
        .post('/api/v1/reader/upload')
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .attach('file', buffer, 'test.epub');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Malicious active script content detected');
    });

    it('should upload and validate a structurally valid clean EPUB', async () => {
      const zip = new AdmZip();
      zip.addFile('mimetype', Buffer.from('application/epub+zip'));
      zip.addFile(
        'OEBPS/chapter1.html',
        Buffer.from('<html><body><h1>Chapter 1</h1><p>Clean book content</p></body></html>')
      );
      const buffer = zip.toBuffer();

      const res = await request(app)
        .post('/api/v1/reader/upload')
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .field('title', 'Valid Test Book')
        .field('category', 'Test Category')
        .attach('file', buffer, 'clean.epub');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uploadStatus).toBe('available');
      expect(res.body.data.sourceType).toBe('internal-upload');
    });
  });

  describe('GET /api/reader/:resourceId/content', () => {
    it('should proxy Gutenberg resource with strict, non-executable content-type and security headers', async () => {
      const res = await request(app)
        .get(`/api/v1/reader/${resourceA._id}/content`)
        .set('Authorization', `Bearer ${tokenStudentA}`);

      // We might mock axios or allow the network request to gutenberg.org.
      // Since it points to gutenberg.org and is safe, it should pass or return 200/206/502.
      // Let's assert on the headers that the proxy controller sets:
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBe("sandbox; default-src 'none'");
      expect(['application/epub+zip', 'text/plain', 'application/octet-stream']).toContain(
        res.headers['content-type'].split(';')[0]
      );
    });
  });

  describe('Reading Position GET / PUT /api/reader/:resourceId/position', () => {
    it('should return empty string if no position is saved yet', async () => {
      const res = await request(app)
        .get(`/api/v1/reader/${resourceA._id}/position`)
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.position).toBe('');
    });

    it('should upsert and return the updated reading position CFI string', async () => {
      const putRes = await request(app)
        .put(`/api/v1/reader/${resourceA._id}/position`)
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .send({ position: 'epubcfi(/6/4[chap01.xhtml]!/4/2/10/2)' });

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);

      const getRes = await request(app)
        .get(`/api/v1/reader/${resourceA._id}/position`)
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.position).toBe('epubcfi(/6/4[chap01.xhtml]!/4/2/10/2)');
    });
  });
});
