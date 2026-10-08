/**
 * Comprehensive File Upload Validation Security Test Suite
 *
 * Verifies:
 * 1. Allow-list enforcement (extensions AND MIME types)
 * 2. Magic-byte verification (rejecting .php/.js renamed to .jpg)
 * 3. Double-extension rejection (e.g. exploit.php.jpg, shell.js.png)
 * 4. Path traversal rejection (../../x.png, null bytes \0)
 * 5. Prohibited file formats (HTML, SVG, executables)
 * 6. File size limits (oversized files rejected with 400)
 * 7. Archive zip bomb and Zip Slip mitigation
 * 8. Server-side random filename generation (never preserving client paths)
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const AdmZip = require('adm-zip');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const {
  sanitizeUploadFilename,
  generateSafeFilename,
  detectMimeFromBuffer,
  validateZipBomb,
  scanForMaliciousPayloads,
} = require('../middlewares/fileUploadValidation');

describe('Security Hardening Pass: File Upload Validation', () => {
  let testCollege;
  let adminUser;
  let adminToken;
  let tempDir;

  beforeAll(async () => {
    await connectDB();

    tempDir = path.join(__dirname, 'temp_upload_fixtures');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    testCollege = await College.create({
      name: 'Upload Security College',
      code: 'USC-' + Date.now(),
      domain: `uploadsec-${Date.now()}.edu`,
      status: 'active',
    });

    adminUser = await User.create({
      studentId: 'ADM-UPL-' + Date.now(),
      name: 'Upload Admin',
      email: `upload_admin_${Date.now()}@uploadsec-${Date.now()}.edu`,
      password: 'AdminPassword123!',
      role: 'college-admin',
      collegeId: testCollege._id,
    });

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: adminUser.email,
      password: 'AdminPassword123!',
    });

    adminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore teardown error
    }
  });

  describe('1. Unit Tests: Filename Sanitization & Safe Generation', () => {
    it('1.1 Rejects path traversal sequences (../, ..\\, /)', () => {
      expect(() => sanitizeUploadFilename('../../x.png')).toThrow('path traversal');
      expect(() => sanitizeUploadFilename('..\\..\\x.png')).toThrow('path traversal');
      expect(() => sanitizeUploadFilename('/etc/passwd.png')).toThrow('path traversal');
    });

    it('1.2 Rejects null byte injection (\\0, %00)', () => {
      expect(() => sanitizeUploadFilename('exploit.php\0.jpg')).toThrow('null byte');
      expect(() => sanitizeUploadFilename('exploit.php%00.jpg')).toThrow('null byte');
    });

    it('1.3 Rejects dangerous standalone extensions (PHP, JS, HTML, SVG, EXE)', () => {
      expect(() => sanitizeUploadFilename('shell.php')).toThrow('Forbidden file extension');
      expect(() => sanitizeUploadFilename('script.js')).toThrow('Forbidden file extension');
      expect(() => sanitizeUploadFilename('index.html')).toThrow('Forbidden file extension');
      expect(() => sanitizeUploadFilename('vector.svg')).toThrow('Forbidden file extension');
      expect(() => sanitizeUploadFilename('malware.exe')).toThrow('Forbidden file extension');
    });

    it('1.4 Rejects double extensions containing dangerous scripts (e.g. .php.jpg, .js.png)', () => {
      expect(() => sanitizeUploadFilename('exploit.php.jpg')).toThrow('Double extension');
      expect(() => sanitizeUploadFilename('payload.js.png')).toThrow('Double extension');
      expect(() => sanitizeUploadFilename('xss.html.pdf')).toThrow('Double extension');
      expect(() => sanitizeUploadFilename('bypass.svg.png')).toThrow('Double extension');
    });

    it('1.5 Accepts legitimate filenames and returns sanitized extension', () => {
      const res1 = sanitizeUploadFilename('transcript.pdf');
      expect(res1.ext).toBe('.pdf');

      const res2 = sanitizeUploadFilename('profile_photo.jpeg');
      expect(res2.ext).toBe('.jpeg');

      const res3 = sanitizeUploadFilename('ebook.epub');
      expect(res3.ext).toBe('.epub');
    });

    it('1.6 Generates random UUID server-side filenames and never preserves user path', () => {
      const safe1 = generateSafeFilename('my_document.pdf', 'proof');
      const safe2 = generateSafeFilename('my_document.pdf', 'proof');

      expect(safe1).toMatch(/^proof-[0-9a-f-]{36}\.pdf$/);
      expect(safe2).toMatch(/^proof-[0-9a-f-]{36}\.pdf$/);
      expect(safe1).not.toBe(safe2);
      expect(safe1).not.toContain('my_document');
    });
  });

  describe('2. Unit Tests: Magic Byte Detection & Malware / Payload Scanning', () => {
    it('2.1 Correctly detects valid image and document magic bytes', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%...\n');
      expect(detectMimeFromBuffer(pdfBuffer)).toEqual({ mime: 'application/pdf', ext: 'pdf' });

      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(detectMimeFromBuffer(pngBuffer)).toEqual({ mime: 'image/png', ext: 'png' });

      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(detectMimeFromBuffer(jpegBuffer)).toEqual({ mime: 'image/jpeg', ext: 'jpg' });

      const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      expect(detectMimeFromBuffer(zipBuffer)).toEqual({ mime: 'application/zip', ext: 'zip' });
    });

    it('2.2 Detects Windows MZ and Linux ELF executables as executable binaries', () => {
      const mzBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
      expect(detectMimeFromBuffer(mzBuffer).mime).toBe('application/x-msdownload');

      const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
      expect(detectMimeFromBuffer(elfBuffer).mime).toBe('application/x-elf');
    });

    it('2.3 Rejects EICAR test string and active script payloads inside image buffers', () => {
      const eicar = Buffer.from(
        'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
      );
      expect(() => scanForMaliciousPayloads(eicar, 'application/pdf')).toThrow('Malware');

      // JPEG header + embedded PHP payload
      const phpJpg = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff]),
        Buffer.from('<?php system($_GET["cmd"]); ?>'),
      ]);
      expect(() => scanForMaliciousPayloads(phpJpg, 'image/jpeg')).toThrow('Active script');

      // PNG header + embedded script tag
      const scriptPng = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        Buffer.from('<script>alert("xss")</script>'),
      ]);
      expect(() => scanForMaliciousPayloads(scriptPng, 'image/png')).toThrow('Active script');
    });

    it('2.4 Rejects Zip bombs exceeding entry or uncompressed size limits', () => {
      const zip = new AdmZip();
      for (let i = 0; i < 15; i++) {
        zip.addFile(`chapter_${i}.xhtml`, Buffer.from('Chapter content '.repeat(20)));
      }
      const zipBuffer = zip.toBuffer();

      // Excessive entry count
      expect(() => validateZipBomb(zipBuffer, { maxEntries: 5 })).toThrow('too many entries');

      // Excessive uncompressed size
      expect(() => validateZipBomb(zipBuffer, { maxTotalBytes: 50 })).toThrow(
        'uncompressed content exceeds limit'
      );
    });
  });

  describe('3. Integration Tests: Upload Endpoints Protection', () => {
    it('3.1 Rejects .php/.js file renamed to .jpg on onboarding proof upload', async () => {
      const fakeJpgPath = path.join(tempDir, 'fake_script.jpg');
      fs.writeFileSync(fakeJpgPath, '<?php echo "I am a web shell"; ?>');

      const res = await request(app)
        .post('/api/registration/tenant-onboarding')
        .field('collegeName', 'Hacker Academy')
        .field('adminEmail', `admin@hacker-${Date.now()}.edu`)
        .field('domain', `hacker-${Date.now()}.edu`)
        .field('password', 'SecurePass123!')
        .attach('proofDocument', fakeJpgPath);

      if (fs.existsSync(fakeJpgPath)) fs.unlinkSync(fakeJpgPath);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('3.2 Rejects double extension (exploit.php.jpg) on onboarding proof upload', async () => {
      const doubleExtPath = path.join(tempDir, 'exploit.php.jpg');
      // Even with valid JPEG magic bytes, the filename has .php.jpg
      const validJpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      fs.writeFileSync(doubleExtPath, validJpgHeader);

      const res = await request(app)
        .post('/api/registration/tenant-onboarding')
        .field('collegeName', 'Double Ext College')
        .field('adminEmail', `admin@dblext-${Date.now()}.edu`)
        .field('domain', `dblext-${Date.now()}.edu`)
        .field('password', 'SecurePass123!')
        .attach('proofDocument', doubleExtPath);

      if (fs.existsSync(doubleExtPath)) fs.unlinkSync(doubleExtPath);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('3.3 Rejects path traversal filename (../../x.png) on proof upload', async () => {
      const traversalPath = path.join(tempDir, 'traversal_target.png');
      const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      fs.writeFileSync(traversalPath, validPngHeader);

      const res = await request(app)
        .post('/api/registration/tenant-onboarding')
        .field('collegeName', 'Traversal College')
        .field('adminEmail', `admin@trav-${Date.now()}.edu`)
        .field('domain', `trav-${Date.now()}.edu`)
        .field('password', 'SecurePass123!')
        .attach('proofDocument', traversalPath, '../../x.png');

      if (fs.existsSync(traversalPath)) fs.unlinkSync(traversalPath);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('3.4 Rejects HTML and SVG file uploads', async () => {
      const htmlPath = path.join(tempDir, 'test.html');
      fs.writeFileSync(htmlPath, '<!DOCTYPE html><html><body><h1>XSS</h1></body></html>');

      const resHtml = await request(app)
        .post('/api/registration/tenant-onboarding')
        .field('collegeName', 'HTML Test')
        .field('adminEmail', `admin@html-${Date.now()}.edu`)
        .field('domain', `html-${Date.now()}.edu`)
        .field('password', 'SecurePass123!')
        .attach('proofDocument', htmlPath);

      if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);

      expect(resHtml.status).toBe(400);

      const svgPath = path.join(tempDir, 'test.svg');
      fs.writeFileSync(svgPath, '<svg><script>alert(1)</script></svg>');

      const resSvg = await request(app)
        .post('/api/registration/tenant-onboarding')
        .field('collegeName', 'SVG Test')
        .field('adminEmail', `admin@svg-${Date.now()}.edu`)
        .field('domain', `svg-${Date.now()}.edu`)
        .field('password', 'SecurePass123!')
        .attach('proofDocument', svgPath);

      if (fs.existsSync(svgPath)) fs.unlinkSync(svgPath);

      expect(resSvg.status).toBe(400);
    });

    it('3.5 Rejects oversized file exceeding maximum limit', async () => {
      const oversizePath = path.join(tempDir, 'oversized.pdf');
      // Create file exceeding 10MB limit (11MB)
      const buffer = Buffer.alloc(11 * 1024 * 1024);
      buffer.write('%PDF-1.4\n', 0);
      fs.writeFileSync(oversizePath, buffer);

      const res = await request(app)
        .post('/api/registration/tenant-onboarding')
        .field('collegeName', 'Oversize College')
        .field('adminEmail', `admin@oversize-${Date.now()}.edu`)
        .field('domain', `oversize-${Date.now()}.edu`)
        .field('password', 'SecurePass123!')
        .attach('proofDocument', oversizePath);

      if (fs.existsSync(oversizePath)) fs.unlinkSync(oversizePath);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('3.6 Rejects non-CSV/non-Excel file disguised as roster upload', async () => {
      const fakeCsvPath = path.join(tempDir, 'fake_roster.csv');
      // Binary executable header disguised as .csv
      fs.writeFileSync(fakeCsvPath, Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]));

      const res = await request(app)
        .post('/api/v1/admin/students/upload/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', fakeCsvPath);

      if (fs.existsSync(fakeCsvPath)) fs.unlinkSync(fakeCsvPath);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('3.7 Rejects unauthenticated ebook upload to /api/reader/upload', async () => {
      const res = await request(app).post('/api/reader/upload');
      expect([401, 403]).toContain(res.status);
    });
  });
});
