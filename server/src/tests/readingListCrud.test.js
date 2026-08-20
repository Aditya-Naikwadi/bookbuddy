const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_readinglist_crud_test';
process.env.JWT_SECRET = 'testjwtreadinglistcrudsecretkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtreadinglistcrudrefreshsecretkey999';
process.env.JWT_ACCESS_EXPIRY = '10m';
process.env.JWT_REFRESH_EXPIRY = '7d';
jest.setTimeout(30000);

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
    await mongoose.connection.close();
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
