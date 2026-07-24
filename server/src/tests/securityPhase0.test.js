const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_security_phase0_test';
process.env.JWT_SECRET = 'testjwtsecretsecurityphase0key999';
process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretsecurityphase0key999';

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');
const Reservation = require('../models/Reservation');
const { generateTokenPair } = require('../utils/token');

describe('Phase 0 Emergency Security Patch Integration Tests', () => {
  let college;
  let userA;
  let userB;
  let tokenUserA;
  let tokenUserB;
  let outOfStockBook;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  afterAll(async () => {
    await College.deleteMany({});
    await User.deleteMany({});
    await Book.deleteMany({});
    await Reservation.deleteMany({});
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await College.deleteMany({});
    await User.deleteMany({});
    await Book.deleteMany({});
    await Reservation.deleteMany({});

    college = await College.create({
      name: 'Security Test College',
      code: 'STC',
      domain: 'security.edu',
      status: 'active',
      isActive: true,
    });

    userA = await User.create({
      studentId: 'STU_SEC_A',
      name: 'User A',
      email: 'usera@security.edu',
      password: 'password123',
      collegeId: college._id,
      role: 'student',
      isActive: true,
    });

    userB = await User.create({
      studentId: 'STU_SEC_B',
      name: 'User B',
      email: 'userb@security.edu',
      password: 'password123',
      collegeId: college._id,
      role: 'student',
      isActive: true,
    });

    tokenUserA = generateTokenPair(userA).accessToken;
    tokenUserB = generateTokenPair(userB).accessToken;

    outOfStockBook = await Book.create({
      collegeId: college._id,
      isbn: '9780000000001',
      title: 'Out of Stock Security Book',
      author: 'Security Author',
      category: 'Computer Science',
      copiesTotal: 1,
      copiesAvailable: 0,
    });
  });

  test('1. IDOR Prevention: User B cannot cancel User A reservation (returns 404 and leaves hold active)', async () => {
    // User A creates a reservation
    const createRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({ bookId: outOfStockBook._id.toString() });

    expect(createRes.status).toBe(200);
    const reservationId = createRes.body.data._id;

    // User B attempts to DELETE User A's reservation
    const deleteRes = await request(app)
      .delete(`/api/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${tokenUserB}`);

    expect(deleteRes.status).toBe(404);
    expect(deleteRes.body.message).toMatch(/Reservation not found/i);

    // Verify reservation remains queued in DB
    const dbReservation = await Reservation.findById(reservationId);
    expect(dbReservation).not.toBeNull();
    expect(dbReservation.status).toBe('queued');
    expect(dbReservation.userId.toString()).toBe(userA._id.toString());
  });

  test('2. Strict CORS: Requests from unlisted origin are rejected', async () => {
    const corsRes = await request(app)
      .get('/api/registration/colleges')
      .set('Origin', 'http://malicious-unlisted-site.com');

    // CORS rejection by express cors middleware suppresses Access-Control-Allow-Origin header
    expect(corsRes.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('3. Strict CORS: Requests from allowed origin (localhost:5173) are accepted', async () => {
    const corsRes = await request(app)
      .get('/api/registration/colleges')
      .set('Origin', 'http://localhost:5173');

    expect(corsRes.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
