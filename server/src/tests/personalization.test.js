// Integration tests verifying EResource moderation workflows and tenant-isolated ReadingList personalization.
const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_personalization_test';
process.env.JWT_SECRET = 'testjwtpersonalizationsecretkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtpersonalizationrefreshsecretkey999';
process.env.JWT_ACCESS_EXPIRY = '10m';
process.env.JWT_REFRESH_EXPIRY = '7d';
jest.setTimeout(30000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const EResource = require('../models/EResource');
const ReadingList = require('../models/ReadingList');
const ReadingProgress = require('../models/ReadingProgress');
const SavedSearch = require('../models/SavedSearch');
const { generateTokenPair } = require('../utils/token');
const axios = require('axios');

jest.mock('axios');

describe('Digital Assets & Personalization API Integration Tests', () => {
  let collegeA;
  let collegeB;
  let adminA;
  let studentA;
  let studentA2;
  let studentB;
  let tokenAdminA;
  let tokenStudentA;
  let tokenStudentA2;
  let tokenStudentB;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    await College.deleteMany({});
    await User.deleteMany({});
    await EResource.deleteMany({});
    await ReadingList.deleteMany({});
    await ReadingProgress.deleteMany({});
    await SavedSearch.deleteMany({});

    // Seed Colleges
    collegeA = await College.create({ name: 'Personalization College A', code: 'PCA' });
    collegeB = await College.create({ name: 'Personalization College B', code: 'PCB' });

    // Seed Users
    adminA = await User.create({
      studentId: 'ADM_A_001',
      name: 'Admin A',
      email: 'admin.a@test.com',
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeA._id,
    });

    studentA = await User.create({
      studentId: 'STU_A_001',
      name: 'Student A',
      email: 'student.a@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    studentA2 = await User.create({
      studentId: 'STU_A_002',
      name: 'Student A2',
      email: 'student.a2@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    studentB = await User.create({
      studentId: 'STU_B_001',
      name: 'Student B',
      email: 'student.b@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeB._id,
    });

    // Generate JWTs
    tokenAdminA = generateTokenPair(adminA).accessToken;
    tokenStudentA = generateTokenPair(studentA).accessToken;
    tokenStudentA2 = generateTokenPair(studentA2).accessToken;
    tokenStudentB = generateTokenPair(studentB).accessToken;
  });

  afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  // Assertion 1: Newly submitted EResource does not appear in GET /eresources until approved.
  it('1. should not show newly submitted pending EResource in approved lists for uploader or other students', async () => {
    // 1. Submit resource
    const res = await request(app)
      .post('/api/dashboards/student/eresources')
      .set('Authorization', `Bearer ${tokenStudentA}`)
      .send({
        title: 'Pending Math Guide',
        author: 'Professor X',
        type: 'pdf',
        fileUrl: 'https://storage.com/math.pdf',
        category: 'Math',
      });

    expect(res.status).toBe(201);
    const resourceId = res.body.data._id;

    // 2. Fetch approved lists as student A (uploader)
    const listARes = await request(app)
      .get('/api/dashboards/student/eresources')
      .set('Authorization', `Bearer ${tokenStudentA}`);

    const foundInA = listARes.body.data.some((r) => r._id === resourceId);
    expect(foundInA).toBe(false);

    // 3. Fetch approved lists as student A2
    const listA2Res = await request(app)
      .get('/api/dashboards/student/eresources')
      .set('Authorization', `Bearer ${tokenStudentA2}`);

    const foundInA2 = listA2Res.body.data.some((r) => r._id === resourceId);
    expect(foundInA2).toBe(false);
  });

  // Assertion 2: Uploader CAN see pending details; other student gets 404
  it('2. should show pending EResource to uploader, but return 404 to another student', async () => {
    const resource = await EResource.create({
      collegeId: collegeA._id,
      title: 'Pending History Notes',
      author: 'Professor Y',
      type: 'epub',
      fileUrl: 'https://storage.com/history.epub',
      uploadedBy: studentA._id,
      moderationStatus: 'pending',
      category: 'History',
    });

    // Uploader requests details -> should get 200
    const uploadRes = await request(app)
      .get(`/api/dashboards/student/eresources/${resource._id}`)
      .set('Authorization', `Bearer ${tokenStudentA}`);

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.data.title).toBe('Pending History Notes');

    // Other student requests details -> should get 404
    const otherRes = await request(app)
      .get(`/api/dashboards/student/eresources/${resource._id}`)
      .set('Authorization', `Bearer ${tokenStudentA2}`);

    expect(otherRes.status).toBe(404);
  });

  // Assertion 3: Moderation approvals promote EResource visibility
  it('3. should make EResource visible to students once approved by college admin', async () => {
    const resource = await EResource.create({
      collegeId: collegeA._id,
      title: 'Pending Science Journal',
      author: 'Professor Z',
      type: 'journal',
      fileUrl: 'https://storage.com/science.pdf',
      uploadedBy: studentA._id,
      moderationStatus: 'pending',
      category: 'Science',
    });

    // Approve the resource
    const modRes = await request(app)
      .put(`/api/dashboards/college-admin/eresources/${resource._id}/moderate`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ status: 'approved', note: 'Looks good' });

    expect(modRes.status).toBe(200);
    expect(modRes.body.data.moderationStatus).toBe('approved');

    // Fetch approved lists as Student A2 -> should find it
    const listRes = await request(app)
      .get('/api/dashboards/student/eresources')
      .set('Authorization', `Bearer ${tokenStudentA2}`);

    const found = listRes.body.data.some((r) => r._id === resource._id.toString());
    expect(found).toBe(true);
  });

  // Assertion 4: Student cannot moderate (403)
  it('4. should reject moderation attempts by students with 403', async () => {
    const resource = await EResource.create({
      collegeId: collegeA._id,
      title: 'Pending Biology Paper',
      author: 'Professor W',
      type: 'pdf',
      fileUrl: 'https://storage.com/bio.pdf',
      uploadedBy: studentA._id,
      moderationStatus: 'pending',
      category: 'Biology',
    });

    const res = await request(app)
      .put(`/api/dashboards/college-admin/eresources/${resource._id}/moderate`)
      .set('Authorization', `Bearer ${tokenStudentA}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(403);
  });

  // Assertion 5: Private ReadingList is invisible to other users
  it('5. should keep private reading list invisible to non-owners', async () => {
    const list = await ReadingList.create({
      collegeId: collegeA._id,
      ownerId: studentA._id,
      title: 'Secret Math List',
      visibility: 'private',
    });

    // Other student tries to retrieve it -> 404
    const res = await request(app)
      .get(`/api/dashboards/student/reading-lists/${list._id}`)
      .set('Authorization', `Bearer ${tokenStudentA2}`);

    expect(res.status).toBe(404);
  });

  // Assertion 6: Public ReadingList is tenant-bounded
  it('6. should make public reading list visible to same college students but NOT different college students', async () => {
    const list = await ReadingList.create({
      collegeId: collegeA._id,
      ownerId: studentA._id,
      title: 'Public LCA Study List',
      visibility: 'public',
    });

    // Same college student retrieves it -> 200
    const sameRes = await request(app)
      .get(`/api/dashboards/student/reading-lists/${list._id}`)
      .set('Authorization', `Bearer ${tokenStudentA2}`);

    expect(sameRes.status).toBe(200);
    expect(sameRes.body.data.title).toBe('Public LCA Study List');

    // Different college student retrieves it -> 404
    const diffRes = await request(app)
      .get(`/api/dashboards/student/reading-lists/${list._id}`)
      .set('Authorization', `Bearer ${tokenStudentB}`);

    expect(diffRes.status).toBe(404);
  });

  // Assertion 7: Non-owners cannot modify/delete public reading lists
  it("7. should reject modifications/deletions on another user's public reading list", async () => {
    const list = await ReadingList.create({
      collegeId: collegeA._id,
      ownerId: studentA._id,
      title: 'Public LCA Study List 2',
      visibility: 'public',
    });

    // Student A2 tries to update it -> 403
    const updateRes = await request(app)
      .put(`/api/dashboards/student/reading-lists/${list._id}`)
      .set('Authorization', `Bearer ${tokenStudentA2}`)
      .send({ title: 'Hacked Title' });

    expect(updateRes.status).toBe(403);

    // Student A2 tries to delete it -> 403
    const deleteRes = await request(app)
      .delete(`/api/dashboards/student/reading-lists/${list._id}`)
      .set('Authorization', `Bearer ${tokenStudentA2}`);

    expect(deleteRes.status).toBe(403);
  });

  // Assertion 8: ReadingProgress is idempotent-upsert
  it('8. should upsert reading progress idempotently without generating duplicates', async () => {
    const resource = await EResource.create({
      collegeId: collegeA._id,
      title: 'Database Book',
      author: 'Author DB',
      type: 'pdf',
      fileUrl: 'https://storage.com/db.pdf',
      uploadedBy: studentA._id,
      category: 'CS',
      moderationStatus: 'approved',
    });

    // 1st progress update
    const res1 = await request(app)
      .put(`/api/dashboards/student/reading-progress/${resource._id}`)
      .set('Authorization', `Bearer ${tokenStudentA}`)
      .send({ currentPage: 5 });

    expect(res1.status).toBe(200);

    // 2nd progress update
    const res2 = await request(app)
      .put(`/api/dashboards/student/reading-progress/${resource._id}`)
      .set('Authorization', `Bearer ${tokenStudentA}`)
      .send({ currentPage: 10 });

    expect(res2.status).toBe(200);

    // Check count of ReadingProgress records for this user + eresource -> must be exactly 1
    const count = await ReadingProgress.countDocuments({
      userId: studentA._id,
      eresourceId: resource._id,
    });
    expect(count).toBe(1);

    const progressRecord = await ReadingProgress.findOne({
      userId: studentA._id,
      eresourceId: resource._id,
    });
    expect(progressRecord.currentPage).toBe(10);
  });

  // Assertion 9: SavedSearch strict query validation shape
  it('9. should reject malformed queryParams in SavedSearch with 400', async () => {
    const res = await request(app)
      .post('/api/dashboards/student/saved-searches')
      .set('Authorization', `Bearer ${tokenStudentA}`)
      .send({
        queryParams: {
          maliciousKey: 'something_bad',
          category: 'Science',
        },
      });

    expect(res.status).toBe(400);
  });

  // Assertion 10: Proxy content allowed for Gutenberg domains
  it('10. should allow proxying external resource content for whitelisted domains', async () => {
    const resource = await EResource.create({
      collegeId: collegeA._id,
      title: 'Gutenberg Ebook',
      author: 'Author',
      type: 'epub',
      url: 'https://gutenberg.org/ebook.epub',
      source: 'gutenberg',
      externalId: 12345,
      readUrl: 'https://gutenberg.org/ebook.html',
      epubUrl: 'https://gutenberg.org/ebook.epub',
      fileUrl: 'https://gutenberg.org/ebook.epub',
      uploadedBy: studentA._id,
      category: 'Open Access',
      moderationStatus: 'approved',
    });

    const { Readable } = require('stream');
    const mockStream = new Readable();
    mockStream.push('mocked epub data');
    mockStream.push(null);

    axios.mockImplementationOnce(() => Promise.resolve({
      status: 200,
      headers: { 'content-type': 'application/epub+zip' },
      data: mockStream,
    }));

    const res = await request(app)
      .get(`/api/eresources/external/${resource._id}/content?format=epub`)
      .set('Authorization', `Bearer ${tokenStudentA}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/epub+zip');
    expect(res.headers['content-security-policy']).toContain('sandbox');
  });

  // Assertion 11: Proxy content rejected for non-whitelisted domains
  it('11. should block proxying external resource content for non-whitelisted domains', async () => {
    const resource = await EResource.create({
      collegeId: collegeA._id,
      title: 'Malicious Ebook',
      author: 'Attacker',
      type: 'epub',
      url: 'https://malicious-site.com/attack.epub',
      source: 'gutenberg',
      externalId: 67890,
      readUrl: 'https://malicious-site.com/attack.html',
      epubUrl: 'https://malicious-site.com/attack.epub',
      fileUrl: 'https://malicious-site.com/attack.epub',
      uploadedBy: studentA._id,
      category: 'Open Access',
      moderationStatus: 'approved',
    });

    const res = await request(app)
      .get(`/api/eresources/external/${resource._id}/content?format=epub`)
      .set('Authorization', `Bearer ${tokenStudentA}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('untrusted domain');
  });
});
