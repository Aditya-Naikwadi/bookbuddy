const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_e2e_test';
process.env.JWT_SECRET = 'testjwtsecretkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretkey999';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';

jest.setTimeout(30000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Fine = require('../models/Fine');
const Streak = require('../models/Streak');
const Notification = require('../models/Notification');
const { runOverdueFineAccrual } = require('../services/cronService');

describe('Phase 8 — End-to-End User Journeys Integration Test', () => {
  let college;
  let adminToken;
  let adminUser;
  let studentToken;
  let studentUser;
  let book;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  });

  beforeEach(async () => {
    // Clear databases
    await College.deleteMany({});
    await User.deleteMany({});
    await Book.deleteMany({});
    await Loan.deleteMany({});
    await Fine.deleteMany({});
    await Streak.deleteMany({});
    await Notification.deleteMany({});

    // 1. Create a College
    college = await College.create({
      name: 'E2E Tech Institute',
      code: 'E2E',
    });

    // 2. Create a College Admin
    adminUser = await User.create({
      studentId: 'ADM_001',
      name: 'College Admin',
      email: 'admin@e2e.edu',
      password: 'password123',
      role: 'college-admin',
      collegeId: college._id,
    });

    // Login Admin to get token
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@e2e.edu', password: 'password123' });
    adminToken = adminLoginRes.body.accessToken;

    // 3. Create a Book via Admin Catalog Endpoint
    const bookRes = await request(app)
      .post('/api/dashboards/college-admin/catalog')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        isbn: '978-3-16-148410-0',
        title: 'Introduction to Agentic Backend Design',
        author: 'Antigravity Creator',
        category: 'Computer Science',
        copiesTotal: 1,
        copiesAvailable: 1,
      });
    book = bookRes.body.data;

    // 4. Register a Student
    const studentRegRes = await request(app).post('/api/auth/register').send({
      studentId: 'STU_E2E_01',
      name: 'John Doe',
      email: 'john.doe@e2e.edu',
      password: 'password123',
      collegeId: college._id.toString(),
    });

    // Login Student
    const studentLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john.doe@e2e.edu', password: 'password123' });

    studentToken = studentLoginRes.body.accessToken;
    studentUser = await User.findOne({ email: 'john.doe@e2e.edu' });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('runs complete e2e journey: checkout -> streak update -> notify -> overdue fine -> fine dashboard check -> return', async () => {
    // Step A: Admin checks out book to student
    const checkoutRes = await request(app)
      .post('/api/dashboards/college-admin/circulation/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: studentUser._id.toString(),
        bookId: book._id.toString(),
      });

    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.success).toBe(true);
    const loan = checkoutRes.body.data;
    expect(loan.status).toBe('active');

    // Step B: Verify student streak gets updated on qualifying action (checkout)
    const streak = await Streak.findOne({ userId: studentUser._id });
    expect(streak).toBeDefined();
    expect(streak.currentStreak).toBe(1);

    // Step D: Simulate book becoming overdue by updating due date to 5 days ago
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 5);
    await Loan.findByIdAndUpdate(loan._id, { dueDate: overdueDate });

    // Step E: Execute fine accrual background cron job
    const affectedFines = await runOverdueFineAccrual();
    expect(affectedFines).toBe(1);

    // Verify Fine entry in Database
    const fine = await Fine.findOne({ loanId: loan._id });
    expect(fine).toBeDefined();
    expect(fine.amount).toBe(25); // $5 per day for 5 days overdue
    expect(fine.status).toBe('unpaid');

    // Verify notification exists in student notification list for fine accrual
    const notifyRes = await request(app)
      .get('/api/dashboards/student/notifications')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(notifyRes.status).toBe(200);
    expect(notifyRes.body.notifications.length).toBeGreaterThan(0);
    expect(notifyRes.body.notifications[0].message).toContain('fine');

    // Step F: Verify student sees the fine in their dashboard
    const studentFinesRes = await request(app)
      .get('/api/dashboards/student/fines')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(studentFinesRes.status).toBe(200);
    expect(studentFinesRes.body.data.length).toBe(1);
    expect(studentFinesRes.body.data[0].amount).toBe(25);

    // Step G: Return the book via Admin
    const returnRes = await request(app)
      .post('/api/dashboards/college-admin/circulation/return')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        loanId: loan._id.toString(),
      });

    expect(returnRes.status).toBe(200);
    expect(returnRes.body.data.status).toBe('returned');

    // Verify book copies are restored
    const updatedBook = await Book.findById(book._id);
    expect(updatedBook.copiesAvailable).toBe(1);
  });
});
