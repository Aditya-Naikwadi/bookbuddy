/**
 * Consolidated Suite: reader And Reading Lists
 * Merged from:
 *  - reader.test.js
 *  - readingListCrud.test.js
 *  - signedDownloadUrl.test.js
 *  - downloadLog.test.js
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');

describe('reader And Reading Lists Consolidated Suite', () => {
  afterAll(async () => {
    try {
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  describe('[Source: reader.test.js]', () => {
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
          moderationStatus: 'published',
          isPublished: true,
          source: 'gutenberg',
          sourceType: 'gutenberg',
          epubUrl: 'https://www.gutenberg.org/ebooks/84.epub.images',
        });
      });

      afterAll(async () => {
        // await // mongoose.connection.close();
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
  });

  describe('[Source: readingListCrud.test.js]', () => {
    const request = require('supertest');
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_readinglist_crud_test';
    process.env.JWT_SECRET = 'testjwtreadinglistcrudsecretkey999';
    process.env.JWT_REFRESH_SECRET = 'testjwtreadinglistcrudrefreshsecretkey999';
    process.env.JWT_ACCESS_EXPIRY = '10m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    jest.setTimeout(60000);

    const app = require('../app');
    const User = require('../models/User');
    const College = require('../models/College');
    const Book = require('../models/Book');
    const ReadingList = require('../models/ReadingList');
    const { generateTokenPair } = require('../utils/token');

    describe('ReadingList Schema & CRUD Endpoints Integration Tests', () => {
      let collegeA;
      let collegeB;
      let userA1;
      let userA2;
      let userB1;
      let tokenA1;
      let tokenA2;
      let tokenB1;
      let testBook;

      beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
          await mongoose.connect(process.env.MONGO_URI);
        }

        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await ReadingList.deleteMany({});

        // Seed Colleges
        collegeA = await College.create({
          name: 'ReadingList College A',
          code: 'RL_COL_A',
          status: 'active',
        });
        collegeB = await College.create({
          name: 'ReadingList College B',
          code: 'RL_COL_B',
          status: 'active',
        });

        // Seed Users
        userA1 = await User.create({
          studentId: 'STU_RL_A1',
          name: 'User A1',
          email: 'usera1@test.com',
          password: 'password123',
          role: 'student',
          collegeId: collegeA._id,
        });

        userA2 = await User.create({
          studentId: 'STU_RL_A2',
          name: 'User A2',
          email: 'usera2@test.com',
          password: 'password123',
          role: 'student',
          collegeId: collegeA._id,
        });

        userB1 = await User.create({
          studentId: 'STU_RL_B1',
          name: 'User B1',
          email: 'userb1@test.com',
          password: 'password123',
          role: 'student',
          collegeId: collegeB._id,
        });

        tokenA1 = (await generateTokenPair(userA1)).accessToken;
        tokenA2 = (await generateTokenPair(userA2)).accessToken;
        tokenB1 = (await generateTokenPair(userB1)).accessToken;

        testBook = await Book.create({
          collegeId: collegeA._id,
          isbn: '978-0132350884',
          title: 'Clean Code',
          author: 'Robert C. Martin',
          category: 'Software Engineering',
        });
      });

      afterAll(async () => {
        await College.deleteMany({});
        await User.deleteMany({});
        await Book.deleteMany({});
        await ReadingList.deleteMany({});
        // await // mongoose.connection.close();
      });

      describe('POST /api/reading-lists', () => {
        it('should create a private reading list for authorized user', async () => {
          const res = await request(app)
            .post('/api/reading-lists')
            .set('Authorization', `Bearer ${tokenA1}`)
            .send({
              name: 'My Computer Science Essentials',
              description: 'Top CS books to read',
              visibility: 'private',
            });

          expect(res.status).toBe(201);
          expect(res.body.success).toBe(true);
          expect(res.body.data.name).toBe('My Computer Science Essentials');
          expect(res.body.data.visibility).toBe('private');
          expect(res.body.data.collegeId.toString()).toBe(collegeA._id.toString());
          expect(res.body.data.userId.toString()).toBe(userA1._id.toString());
        });

        it('should create a college-visible reading list', async () => {
          const res = await request(app)
            .post('/api/reading-lists')
            .set('Authorization', `Bearer ${tokenA1}`)
            .send({
              name: 'Shared College Tech Stack',
              description: 'Recommended by Computer Science department',
              visibility: 'college',
            });

          expect(res.status).toBe(201);
          expect(res.body.data.visibility).toBe('college');
        });
      });

      describe('GET /api/reading-lists', () => {
        it('should return user own lists plus same-college college-visible lists', async () => {
          const res = await request(app)
            .get('/api/reading-lists')
            .set('Authorization', `Bearer ${tokenA2}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          const listNames = res.body.data.map((l) => l.name);
          expect(listNames).toContain('Shared College Tech Stack');
          expect(listNames).not.toContain('My Computer Science Essentials');
        });

        it('should NOT return college-visible lists of College A to user of College B', async () => {
          const res = await request(app)
            .get('/api/reading-lists')
            .set('Authorization', `Bearer ${tokenB1}`);

          expect(res.status).toBe(200);
          const listNames = res.body.data.map((l) => l.name);
          expect(listNames).not.toContain('Shared College Tech Stack');
        });
      });

      describe('GET /api/reading-lists/:id (Acceptance Criteria: 403 for private/tenant violation)', () => {
        let privateListA1;
        let collegeListA1;

        beforeAll(async () => {
          privateListA1 = await ReadingList.create({
            collegeId: collegeA._id,
            userId: userA1._id,
            ownerId: userA1._id,
            name: 'Private List of A1',
            visibility: 'private',
          });

          collegeListA1 = await ReadingList.create({
            collegeId: collegeA._id,
            userId: userA1._id,
            ownerId: userA1._id,
            name: 'College Shared List of A1',
            visibility: 'college',
          });
        });

        it('should allow owner to GET private list', async () => {
          const res = await request(app)
            .get(`/api/reading-lists/${privateListA1._id}`)
            .set('Authorization', `Bearer ${tokenA1}`);

          expect(res.status).toBe(200);
          expect(res.body.data.name).toBe('Private List of A1');
        });

        it('should return 403 when non-owner attempts to GET a private list', async () => {
          const res = await request(app)
            .get(`/api/reading-lists/${privateListA1._id}`)
            .set('Authorization', `Bearer ${tokenA2}`);

          expect(res.status).toBe(403);
          expect(res.body.message).toMatch(/not authorized|private/i);
        });

        it('should allow same-college user to GET a college-visible list', async () => {
          const res = await request(app)
            .get(`/api/reading-lists/${collegeListA1._id}`)
            .set('Authorization', `Bearer ${tokenA2}`);

          expect(res.status).toBe(200);
          expect(res.body.data.name).toBe('College Shared List of A1');
        });

        it('should return 403 when user from another college attempts to GET a list', async () => {
          const res = await request(app)
            .get(`/api/reading-lists/${collegeListA1._id}`)
            .set('Authorization', `Bearer ${tokenB1}`);

          expect(res.status).toBe(403);
          expect(res.body.message).toMatch(/cross-college|forbidden/i);
        });
      });

      describe('PATCH /api/reading-lists/:id & DELETE /api/reading-lists/:id (Owner Scoped)', () => {
        let editableList;

        beforeEach(async () => {
          editableList = await ReadingList.create({
            collegeId: collegeA._id,
            userId: userA1._id,
            ownerId: userA1._id,
            name: 'Editable List',
            visibility: 'college',
          });
        });

        it('should allow owner to PATCH reading list', async () => {
          const res = await request(app)
            .patch(`/api/reading-lists/${editableList._id}`)
            .set('Authorization', `Bearer ${tokenA1}`)
            .send({ name: 'Updated Editable List', description: 'New description' });

          expect(res.status).toBe(200);
          expect(res.body.data.name).toBe('Updated Editable List');
        });

        it('should return 403 when non-owner in same college attempts to PATCH list', async () => {
          const res = await request(app)
            .patch(`/api/reading-lists/${editableList._id}`)
            .set('Authorization', `Bearer ${tokenA2}`)
            .send({ name: 'Hacked Name' });

          expect(res.status).toBe(403);
        });

        it('should return 403 when cross-college user attempts to PATCH list', async () => {
          const res = await request(app)
            .patch(`/api/reading-lists/${editableList._id}`)
            .set('Authorization', `Bearer ${tokenB1}`)
            .send({ name: 'Cross College Hacked Name' });

          expect(res.status).toBe(403);
        });

        it('should return 403 when non-owner attempts to DELETE list', async () => {
          const res = await request(app)
            .delete(`/api/reading-lists/${editableList._id}`)
            .set('Authorization', `Bearer ${tokenA2}`);

          expect(res.status).toBe(403);
        });

        it('should allow owner to DELETE reading list', async () => {
          const res = await request(app)
            .delete(`/api/reading-lists/${editableList._id}`)
            .set('Authorization', `Bearer ${tokenA1}`);

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);

          const check = await ReadingList.findById(editableList._id);
          expect(check).toBeNull();
        });
      });

      describe('Items Management: POST /:id/items & DELETE /:id/items/:bookId', () => {
        let itemList;

        beforeEach(async () => {
          itemList = await ReadingList.create({
            collegeId: collegeA._id,
            userId: userA1._id,
            ownerId: userA1._id,
            name: 'Item Management Test Shelf',
            visibility: 'college',
          });
        });

        it('should allow owner to add an item to reading list', async () => {
          const res = await request(app)
            .post(`/api/reading-lists/${itemList._id}/items`)
            .set('Authorization', `Bearer ${tokenA1}`)
            .send({
              bookId: testBook._id.toString(),
              note: 'Must read before architecture exam',
            });

          expect(res.status).toBe(200);
          expect(res.body.data.items).toHaveLength(1);
          expect(res.body.data.items[0].bookId.toString()).toBe(testBook._id.toString());
          expect(res.body.data.items[0].note).toBe('Must read before architecture exam');
        });

        it('should return 403 when non-owner attempts to add an item', async () => {
          const res = await request(app)
            .post(`/api/reading-lists/${itemList._id}/items`)
            .set('Authorization', `Bearer ${tokenA2}`)
            .send({ bookId: testBook._id.toString() });

          expect(res.status).toBe(403);
        });

        it('should allow owner to remove an item from reading list', async () => {
          // First add item
          await request(app)
            .post(`/api/reading-lists/${itemList._id}/items`)
            .set('Authorization', `Bearer ${tokenA1}`)
            .send({ bookId: testBook._id.toString() });

          // Then delete item
          const delRes = await request(app)
            .delete(`/api/reading-lists/${itemList._id}/items/${testBook._id}`)
            .set('Authorization', `Bearer ${tokenA1}`);

          expect(delRes.status).toBe(200);
          expect(delRes.body.data.items).toHaveLength(0);
        });

        it('should return 403 when non-owner attempts to remove an item', async () => {
          const delRes = await request(app)
            .delete(`/api/reading-lists/${itemList._id}/items/${testBook._id}`)
            .set('Authorization', `Bearer ${tokenA2}`);

          expect(delRes.status).toBe(403);
        });
      });
    });
  });

  describe('[Source: signedDownloadUrl.test.js]', () => {
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
        // await // mongoose.connection.close();
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
  });

  describe('[Source: downloadLog.test.js]', () => {
    const mongoose = require('mongoose');

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URI =
      process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_download_test';

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
        // await // mongoose.connection.close();
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
  });
});
