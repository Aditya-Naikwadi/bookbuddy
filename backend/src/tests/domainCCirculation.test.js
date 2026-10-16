process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testjwtrealtimesecretkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtrealtimerefreshsecretkey999';
jest.setTimeout(45000);

const http = require('http');
const mongoose = require('mongoose');
const { io: ioClient } = require('socket.io-client');
const { initSockets, events } = require('../sockets');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Reservation = require('../models/Reservation');
const loanService = require('../services/loanService');
const { generateTokenPair } = require('../utils/token');

describe('Domain C (Circulation, Loans, Reservations) & Real-time Invariants', () => {
  let server;
  let ioServer;
  let serverPort;
  let college;
  let librarian;
  let students = [];
  let student1;
  let student1Token;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test');
    }

    server = http.createServer();
    ioServer = initSockets(server);

    await new Promise((resolve) => {
      server.listen(0, () => {
        serverPort = server.address().port;
        resolve();
      });
    });

    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    college = await College.create({
      name: 'Circulation Test College',
      code: `CIRC_${unique}`,
      domain: `circ_${unique}.edu`,
      status: 'active',
    });

    librarian = await User.create({
      studentId: `LIB_${unique}`,
      name: 'Librarian User',
      email: `lib_${unique}@circ.edu`,
      password: 'HashedPassword123!',
      role: 'librarian',
      collegeId: college._id,
      isActive: true,
    });

    // Create 50 student users for concurrency tests
    const studentPromises = Array.from({ length: 50 }).map((_, i) =>
      User.create({
        studentId: `STU_C_${unique}_${i}`,
        name: `Circulation Student ${i}`,
        email: `student_${unique}_${i}@circ.edu`,
        password: 'HashedPassword123!',
        role: 'student',
        collegeId: college._id,
        isActive: true,
      })
    );
    students = await Promise.all(studentPromises);
    student1 = students[0];
    student1Token = generateTokenPair(student1).accessToken;
  });

  afterAll(async () => {
    if (ioServer) {
      await new Promise((resolve) => ioServer.close(resolve));
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (college?._id) {
      await User.deleteMany({ collegeId: college._id });
      await Book.deleteMany({ collegeId: college._id });
      await Loan.deleteMany({ collegeId: college._id });
      await Reservation.deleteMany({ collegeId: college._id });
      await College.deleteOne({ _id: college._id });
    }
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  test('1. Loan issue and return are reflected on the student client socket within 1 s', async () => {
    const book = await Book.create({
      title: 'Real-time Systems Engineering',
      author: 'Distributed Systems Team',
      isbn: `978-${Date.now()}`,
      collegeId: college._id,
      copiesTotal: 2,
      copiesAvailable: 2,
      category: 'Computer Science',
    });

    const client = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: student1Token },
      transports: ['websocket'],
      forceNew: true,
    });

    if (!client.connected) {
      await new Promise((resolve, reject) => {
        client.on('connect', resolve);
        client.on('connect_error', reject);
      });
    }

    // --- Sub-test A: Issue Loan reflected within 1s ---
    const issueStart = Date.now();
    const issuePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Loan issue event timed out after 2000ms')),
        2000
      );
      client.on(events.LOAN_ISSUED, (payload) => {
        clearTimeout(timeout);
        resolve({ payload, elapsedMs: Date.now() - issueStart });
      });
    });

    const issuedLoan = await loanService.checkoutBook(
      student1._id,
      book._id,
      college._id,
      librarian._id
    );
    const { payload: issueEvent, elapsedMs: issueLatency } = await issuePromise;

    expect(issueLatency).toBeLessThan(1000);
    expect(issueEvent.entityId.toString()).toBe(issuedLoan._id.toString());
    expect(issueEvent.changed.status).toBe('active');
    expect(issueEvent.changed.copiesAvailable).toBe(1);

    // --- Sub-test B: Return Loan reflected within 1s ---
    const returnStart = Date.now();
    const returnPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Loan return event timed out after 2000ms')),
        2000
      );
      client.on(events.LOAN_RETURNED, (payload) => {
        clearTimeout(timeout);
        resolve({ payload, elapsedMs: Date.now() - returnStart });
      });
    });

    await loanService.returnBook(issuedLoan._id, college._id);
    const { payload: returnEvent, elapsedMs: returnLatency } = await returnPromise;

    expect(returnLatency).toBeLessThan(1000);
    expect(returnEvent.entityId.toString()).toBe(issuedLoan._id.toString());
    expect(returnEvent.changed.status).toBe('returned');
    expect(returnEvent.changed.copiesAvailable).toBe(2);

    client.disconnect();
  });

  test('2. 50 concurrent checkouts of the last copy yield exactly 1 success with 0 negative stock', async () => {
    // Single copy available
    const singleCopyBook = await Book.create({
      title: 'High Concurrency Invariants & Atomicity',
      author: 'Database Architect',
      isbn: `978-ATOMIC-${Date.now()}`,
      collegeId: college._id,
      copiesTotal: 1,
      copiesAvailable: 1,
      category: 'Computer Science',
    });

    // 50 concurrent checkout attempts simultaneously
    const results = await Promise.allSettled(
      students.map((student) =>
        loanService.checkoutBook(student._id, singleCopyBook._id, college._id, librarian._id)
      )
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(49);

    // Verify rejection reasons
    rejected.forEach((r) => {
      expect(r.reason.message).toMatch(/No copies available/i);
    });

    // Database verification: Exactly 1 active loan exists
    const activeLoans = await Loan.find({ bookId: singleCopyBook._id, status: 'active' });
    expect(activeLoans.length).toBe(1);
    expect(activeLoans[0].userId.toString()).toBe(
      fulfilled[0].value._id
        ? fulfilled[0].value.userId.toString()
        : fulfilled[0].value.loan.userId.toString()
    );

    // Database verification: Book copiesAvailable is exactly 0 and never went negative
    const finalBook = await Book.findById(singleCopyBook._id);
    expect(finalBook.copiesAvailable).toBe(0);
    expect(finalBook.copiesTotal).toBe(1);
  });
});
