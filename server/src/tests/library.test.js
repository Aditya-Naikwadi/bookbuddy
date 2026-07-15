// Operational tests verifying circulation lifecycle, renewals, queues, and race conditions.
const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_library_test';
process.env.JWT_SECRET = 'testjwtlibrarysecretkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtlibraryrefreshsecretkey999';
process.env.JWT_ACCESS_EXPIRY = '10m';
process.env.JWT_REFRESH_EXPIRY = '7d';
// raised from default 30s: multi-step integration test, verified slow under coverage instrumentation only, see 2026-07-15 audit
jest.setTimeout(90000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Reservation = require('../models/Reservation');
const Fine = require('../models/Fine');
const { generateTokenPair } = require('../utils/token');

describe('Library Circulation & Concurrency API Integration Tests', () => {
  let collegeA;
  let collegeB;
  let adminA;
  let adminB;
  let studentA;
  let studentB;
  let bookA;
  let bookB;
  let tokenAdminA;
  let tokenAdminB;
  let tokenStudentA;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    await College.deleteMany({});
    await User.deleteMany({});
    await Book.deleteMany({});
    await Loan.deleteMany({});
    await Reservation.deleteMany({});
    await Fine.deleteMany({});

    // Seed Colleges
    collegeA = await College.create({ name: 'Library College A', code: 'LCA' });
    collegeB = await College.create({ name: 'Library College B', code: 'LCB' });

    // Seed Admins
    adminA = await User.create({
      studentId: 'ADM_A_001',
      name: 'Admin A',
      email: 'admin.a@test.com',
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeA._id,
    });

    adminB = await User.create({
      studentId: 'ADM_B_002',
      name: 'Admin B',
      email: 'admin.b@test.com',
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeB._id,
    });

    // Seed Students
    studentA = await User.create({
      studentId: 'STU_A_001',
      name: 'Student A',
      email: 'student.a@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    studentB = await User.create({
      studentId: 'STU_B_002',
      name: 'Student B',
      email: 'student.b@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeB._id,
    });

    // Seed Books
    bookA = await Book.create({
      collegeId: collegeA._id,
      isbn: '978-1111111111',
      title: 'College A Book',
      author: 'Author A',
      category: 'Science',
      copiesTotal: 2,
      copiesAvailable: 2,
    });

    bookB = await Book.create({
      collegeId: collegeB._id,
      isbn: '978-2222222222',
      title: 'College B Book',
      author: 'Author B',
      category: 'Math',
      copiesTotal: 1,
      copiesAvailable: 1,
    });

    // Generate JWTs
    tokenAdminA = generateTokenPair(adminA).accessToken;
    tokenAdminB = generateTokenPair(adminB).accessToken;
    tokenStudentA = generateTokenPair(studentA).accessToken;
  });

  afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  // Assertion 1: Full lifecycle: checkout -> due date correctly set -> renew (count increments, dueDate extends) -> return (copiesAvailable increments back)
  it('1. should complete the full checkout -> renew -> return lifecycle successfully', async () => {
    // 1. Checkout
    const checkoutRes = await request(app)
      .post('/api/dashboards/college-admin/circulation/checkout')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        userId: studentA._id.toString(),
        bookId: bookA._id.toString(),
      });

    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.success).toBe(true);
    const loan = checkoutRes.body.data;
    expect(loan.status).toBe('active');
    expect(loan.dueDate).toBeDefined();

    // Verify copies decremented
    const bookAfterCheckout = await Book.findById(bookA._id);
    expect(bookAfterCheckout.copiesAvailable).toBe(1);

    // 2. Renew
    const renewRes = await request(app)
      .post(`/api/dashboards/student/loans/${loan._id}/renew`)
      .set('Authorization', `Bearer ${tokenStudentA}`);

    expect(renewRes.status).toBe(200);
    expect(renewRes.body.success).toBe(true);
    expect(renewRes.body.data.renewalCount).toBe(1);
    expect(new Date(renewRes.body.data.dueDate).getTime()).toBeGreaterThan(
      new Date(loan.dueDate).getTime()
    );

    // 3. Return
    const returnRes = await request(app)
      .post('/api/dashboards/college-admin/circulation/return')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        loanId: loan._id.toString(),
      });

    expect(returnRes.status).toBe(200);
    expect(returnRes.body.success).toBe(true);
    expect(returnRes.body.data.status).toBe('returned');

    // Verify copies incremented back
    const bookAfterReturn = await Book.findById(bookA._id);
    expect(bookAfterReturn.copiesAvailable).toBe(2);
  });

  // Assertion 2: Renewal rejected once maxRenewals is hit
  it('2. should reject renewal once maxRenewals is hit', async () => {
    // Checkout again
    const checkoutRes = await request(app)
      .post('/api/dashboards/college-admin/circulation/checkout')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        userId: studentA._id.toString(),
        bookId: bookA._id.toString(),
      });

    const loanId = checkoutRes.body.data._id;

    // Renew 1st time
    await request(app)
      .post(`/api/dashboards/student/loans/${loanId}/renew`)
      .set('Authorization', `Bearer ${tokenStudentA}`);

    // Renew 2nd time (hits maxLimit of 2)
    await request(app)
      .post(`/api/dashboards/student/loans/${loanId}/renew`)
      .set('Authorization', `Bearer ${tokenStudentA}`);

    // Renew 3rd time (must reject)
    const renewRes3 = await request(app)
      .post(`/api/dashboards/student/loans/${loanId}/renew`)
      .set('Authorization', `Bearer ${tokenStudentA}`);

    expect(renewRes3.status).toBe(400);
    expect(renewRes3.body.message).toContain('Maximum renewals reached');

    // Clean return for next tests
    await request(app)
      .post('/api/dashboards/college-admin/circulation/return')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ loanId });
  });

  // Assertion 3: Renewal rejected when a reservation queue exists for that book
  it('3. should reject renewal when a reservation queue exists for that book', async () => {
    // Make book copiesAvailable = 0 (total copies = 2)
    // 1st checkout
    const checkoutRes1 = await request(app)
      .post('/api/dashboards/college-admin/circulation/checkout')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        userId: studentA._id.toString(),
        bookId: bookA._id.toString(),
      });

    // 2nd checkout
    const tempStudent = await User.create({
      studentId: 'STU_A_TEMP',
      name: 'Temp Student',
      email: 'temp@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });
    const tokenTempStudent = generateTokenPair(tempStudent).accessToken;

    const checkoutRes2 = await request(app)
      .post('/api/dashboards/college-admin/circulation/checkout')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        userId: tempStudent._id.toString(),
        bookId: bookA._id.toString(),
      });

    // Verify copies are now 0
    const bookCheck = await Book.findById(bookA._id);
    expect(bookCheck.copiesAvailable).toBe(0);

    // Place a hold to create a queue
    const holdRes = await request(app)
      .post('/api/dashboards/student/reservations')
      .set('Authorization', `Bearer ${tokenTempStudent}`)
      .send({ bookId: bookA._id.toString() });

    expect(holdRes.status).toBe(201);

    // Attempt renewal on checkoutRes1 (must reject because queue exists)
    const renewRes = await request(app)
      .post(`/api/dashboards/student/loans/${checkoutRes1.body.data._id}/renew`)
      .set('Authorization', `Bearer ${tokenStudentA}`);

    expect(renewRes.status).toBe(400);
    expect(renewRes.body.message).toContain('Other users are waiting in the queue');

    // Clean up loans
    await request(app)
      .post('/api/dashboards/college-admin/circulation/return')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ loanId: checkoutRes1.body.data._id });

    await request(app)
      .post('/api/dashboards/college-admin/circulation/return')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ loanId: checkoutRes2.body.data._id });
  });

  // Assertion 4: THE RACE CONDITION TEST: simulate concurrent checkouts
  it('4. should successfully isolate concurrent checkouts to prevent negative copiesAvailable', async () => {
    // 1. Set book copiesAvailable = 1
    const singleCopyBook = await Book.create({
      collegeId: collegeA._id,
      isbn: '978-3333333333',
      title: 'Race Condition Book',
      author: 'Author C',
      category: 'Science',
      copiesTotal: 1,
      copiesAvailable: 1,
    });

    // Create another test student
    const studentC = await User.create({
      studentId: 'STU_A_003',
      name: 'Student C',
      email: 'student.c@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    // Firing concurrent checkouts (Promise.all)
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/dashboards/college-admin/circulation/checkout')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          userId: studentA._id.toString(),
          bookId: singleCopyBook._id.toString(),
        }),
      request(app)
        .post('/api/dashboards/college-admin/circulation/checkout')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          userId: studentC._id.toString(),
          bookId: singleCopyBook._id.toString(),
        }),
    ]);

    // Assert that exactly one checkout succeeded (201) and one failed (400)
    const statusCodes = [res1.status, res2.status];
    expect(statusCodes).toContain(201);
    expect(statusCodes).toContain(400);

    // Verify copiesAvailable is exactly 0 and NOT -1
    const updatedBook = await Book.findById(singleCopyBook._id);
    expect(updatedBook.copiesAvailable).toBe(0);
  });

  // Assertion 5: Hold placement rejected if copies are actually available
  it('5. should reject hold placement if copies are available', async () => {
    const res = await request(app)
      .post('/api/dashboards/student/reservations')
      .set('Authorization', `Bearer ${tokenStudentA}`)
      .send({ bookId: bookA._id.toString() });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Book is currently available');
  });

  // Assertion 6: Return of a book with an active queue correctly promotes the front of the queue to ready_for_pickup
  it('6. should promote front of reservation queue to ready_for_pickup upon return', async () => {
    const queueBook = await Book.create({
      collegeId: collegeA._id,
      isbn: '978-4444444444',
      title: 'Queue Book',
      author: 'Author D',
      category: 'Science',
      copiesTotal: 1,
      copiesAvailable: 0,
    });

    // Create loan
    const loan = await Loan.create({
      collegeId: collegeA._id,
      userId: studentA._id,
      bookId: queueBook._id,
      dueDate: new Date(),
      maxRenewals: 2,
      issuedBy: adminA._id,
    });

    // Create reservation hold
    const hold = await Reservation.create({
      collegeId: collegeA._id,
      userId: studentB._id, // Student B is waiting
      bookId: queueBook._id,
      queuePosition: 1,
      status: 'queued',
    });

    // Return the book
    const returnRes = await request(app)
      .post('/api/dashboards/college-admin/circulation/return')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ loanId: loan._id.toString() });

    expect(returnRes.status).toBe(200);

    // Verify that Student B's hold is now 'ready_for_pickup' and has a 'readyAt' time
    const updatedHold = await Reservation.findById(hold._id);
    expect(updatedHold.status).toBe('ready_for_pickup');
    expect(updatedHold.readyAt).toBeDefined();
  });

  // Assertion 7: Cross-tenant checkout attempt rejected
  it('7. should reject cross-tenant checkout attempt (admin LCA, student LCB)', async () => {
    const res = await request(app)
      .post('/api/dashboards/college-admin/circulation/checkout')
      .set('Authorization', `Bearer ${tokenAdminA}`) // LCA admin
      .send({
        userId: studentB._id.toString(), // LCB student
        bookId: bookA._id.toString(),
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Cross-tenant checkout rejected');
  });

  // Assertion 8: Student cannot access college-admin circulation routes (403)
  it('8. should block student from accessing admin circulation endpoints', async () => {
    const res = await request(app)
      .post('/api/dashboards/college-admin/circulation/checkout')
      .set('Authorization', `Bearer ${tokenStudentA}`)
      .send({
        userId: studentA._id.toString(),
        bookId: bookA._id.toString(),
      });

    expect(res.status).toBe(403);
  });
});
