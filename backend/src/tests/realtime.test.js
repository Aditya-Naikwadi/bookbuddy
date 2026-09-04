const request = require('supertest');
const mongoose = require('mongoose');
const http = require('http');
const { io: ioClient } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_realtime_test';
process.env.JWT_SECRET = 'testjwtrealtimesecretkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtrealtimerefreshsecretkey999';
process.env.JWT_ACCESS_EXPIRY = '10m';
process.env.JWT_REFRESH_EXPIRY = '7d';
jest.setTimeout(30000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Reservation = require('../models/Reservation');
const Streak = require('../models/Streak');
const StreakReward = require('../models/StreakReward');
const Sticker = require('../models/Sticker');
const UserSticker = require('../models/UserSticker');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const { generateTokenPair } = require('../utils/token');
const { initSockets } = require('../sockets');
const streakService = require('../services/streakService');
const notificationService = require('../services/notificationService');

describe('Phase 5 — Real-Time, Gamification & Notifications Integration Tests', () => {
  let server;
  let ioInstance;
  let socketUrl;

  let collegeA;
  let collegeB;
  let adminA;
  let studentA;
  let studentB;
  let tokenAdminA;
  let tokenStudentA;
  let tokenStudentB;
  let bookA;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Clean DB
    await College.deleteMany({});
    await User.deleteMany({});
    await Book.deleteMany({});
    await Loan.deleteMany({});
    await Reservation.deleteMany({});
    await Streak.deleteMany({});
    await StreakReward.deleteMany({});
    await Sticker.deleteMany({});
    await UserSticker.deleteMany({});
    await Notification.deleteMany({});
    await NotificationPreference.deleteMany({});

    // Seed Colleges
    collegeA = await College.create({ name: 'Realtime College A', code: 'RCA' });
    collegeB = await College.create({
      name: 'Realtime College B',
      code: 'RTCB',
    });
    expect(collegeB.code).toBe('RTCB');

    // Seed Admin
    adminA = await User.create({
      studentId: 'ADM_RT_001',
      name: 'Admin A',
      email: 'admin.a@realtime.com',
      password: 'password123',
      role: 'college-admin',
      collegeId: collegeA._id,
    });

    // Seed Students
    studentA = await User.create({
      studentId: 'STU_RT_001',
      name: 'Student A',
      email: 'student.a@realtime.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });
    studentB = await User.create({
      studentId: 'STU_RT_002',
      name: 'Student B',
      email: 'student.b@realtime.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    // Seed Books
    bookA = await Book.create({
      collegeId: collegeA._id,
      isbn: '978-0000000001',
      title: 'Realtime Book A',
      author: 'Author A',
      category: 'Science',
      copiesTotal: 1,
      copiesAvailable: 1,
    });

    tokenAdminA = generateTokenPair(adminA).accessToken;
    tokenStudentA = generateTokenPair(studentA).accessToken;
    tokenStudentB = generateTokenPair(studentB).accessToken;

    // Start http server for socket client testing
    server = http.createServer(app);
    ioInstance = initSockets(server);
    app.set('io', ioInstance);

    await new Promise((resolve) => {
      server.listen(0, () => {
        const address = server.address();
        socketUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (ioInstance) {
      ioInstance.close();
    }
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  describe('StreakService Daily Calculations & Timezone Behavior', () => {
    // 1. recordQualifyingAction called twice in the same day (user timezone) is a no-op
    it('1. should not double-increment currentStreak when recorded twice in the same day (user-local time)', async () => {
      // Setup first time streak
      const streak1 = await streakService.recordQualifyingAction(
        studentA._id,
        collegeA._id,
        'checkout'
      );
      expect(streak1.currentStreak).toBe(1);

      // Call again on the same day: should stay 1
      const streak2 = await streakService.recordQualifyingAction(
        studentA._id,
        collegeA._id,
        'checkout'
      );
      expect(streak2.currentStreak).toBe(1);
    });

    // 2. recordQualifyingAction respects timezone
    it("2. should correctly determine daily transitions using user's stored timezone", async () => {
      // Get student's streak
      const streak = await Streak.findOne({ userId: studentA._id });

      // Set timezone to Pacific/Honolulu (UTC-10)
      streak.timezone = 'Pacific/Honolulu';

      // Assume a specific date/time for the test:
      // Let's say last qualifying action was at 2026-07-14T01:00:00Z (UTC).
      // In Honolulu (UTC-10), this translates to 2026-07-13T15:00:00 (July 13).
      streak.lastQualifyingActionAt = new Date('2026-07-14T01:00:00Z');
      await streak.save();

      // Now, let's verify how another action at 2026-07-14T03:00:00Z (UTC) behaves.
      // In Honolulu, this is 2026-07-13T17:00:00 (July 13). Same day! So it should be a no-op.
      const timezone = streak.timezone;
      const date1 = new Date('2026-07-14T01:00:00Z');
      const date2 = new Date('2026-07-14T03:00:00Z');

      const date1Str = streakService.getLocalDateString(date1, timezone);
      const date2Str = streakService.getLocalDateString(date2, timezone);
      expect(date1Str).toBe(date2Str); // Proves they evaluate to the same local calendar day
    });
  });

  describe('Streak Milestones & Rewards', () => {
    // 3. Milestone awards Sticker (UserSticker) and triggers a streak_milestone notification
    it('3. should generate exactly one UserSticker and one streak_milestone Notification upon crossing a StreakReward milestone', async () => {
      // Seed a Sticker
      const sticker = await Sticker.create({
        name: 'Milestone 7 Sticker',
        rarity: 'rare',
        criteria: 'Reach a 7-day streak',
      });

      // Seed a StreakReward linked to this sticker (using sticker._id as rewardValue)
      const reward = await StreakReward.create({
        milestoneThreshold: 7,
        rewardType: 'badge',
        rewardValue: sticker._id.toString(),
      });
      expect(reward.milestoneThreshold).toBe(7);

      const studentAStreak = await Streak.findOne({ userId: studentA._id });
      // Artificially modify streak to 6 days
      studentAStreak.currentStreak = 6;
      // Set lastQualifyingActionAt to yesterday so it increments on next call
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      studentAStreak.lastQualifyingActionAt = yesterday;
      await studentAStreak.save();

      // Clear any prior notifications
      await Notification.deleteMany({ userId: studentA._id });

      // Call recordQualifyingAction (should increment to 7 and hit milestone)
      const updatedStreak = await streakService.recordQualifyingAction(
        studentA._id,
        collegeA._id,
        'checkout'
      );
      expect(updatedStreak.currentStreak).toBe(7);

      // Verify UserSticker is created
      const earnedStickers = await UserSticker.find({
        userId: studentA._id,
        stickerId: sticker._id,
      });
      expect(earnedStickers.length).toBe(1);

      // Verify Notification is created
      const milestoneNotification = await Notification.findOne({
        userId: studentA._id,
        type: 'streak_milestone',
      });
      expect(milestoneNotification).toBeDefined();
      expect(milestoneNotification.message).toMatch(/Milestone 7 Sticker/i);

      // Subsequent call on same day should not duplicate
      const repeatedCall = await streakService.recordQualifyingAction(
        studentA._id,
        collegeA._id,
        'checkout'
      );
      expect(repeatedCall.currentStreak).toBe(7);

      const earnedStickersAgain = await UserSticker.find({
        userId: studentA._id,
        stickerId: sticker._id,
      });
      expect(earnedStickersAgain.length).toBe(1); // Still 1
    });
  });

  describe('Notification Service & Muting Preferences', () => {
    // 4. notify() respects typePreferences (muting prevents Notification document creation)
    it('4. should skip creating Notification document entirely if the user has muted that type in preferences', async () => {
      // Set mute preference for 'fine_issued'
      await NotificationPreference.create({
        userId: studentA._id,
        emailEnabled: true,
        pushEnabled: true,
        inAppEnabled: true,
        typePreferences: {
          fine_issued: false,
        },
      });

      // Call notify with muted type
      const mutedNotification = await notificationService.notify(
        studentA._id,
        'fine_issued',
        'You have a fine.'
      );
      expect(mutedNotification).toBeNull();

      // Check DB
      const dbMuted = await Notification.findOne({ userId: studentA._id, type: 'fine_issued' });
      expect(dbMuted).toBeNull();

      // Call notify with an unmuted type (e.g. hold_ready)
      const allowedNotification = await notificationService.notify(
        studentA._id,
        'hold_ready',
        'Hold ready!'
      );
      expect(allowedNotification).not.toBeNull();
      expect(allowedNotification.type).toBe('hold_ready');

      // Check DB
      const dbAllowed = await Notification.findOne({ userId: studentA._id, type: 'hold_ready' });
      expect(dbAllowed).not.toBeNull();
    });
  });

  describe('Socket.io Handshake Authentication & Room Joining', () => {
    // 5. Socket connection with a missing/invalid token is rejected before room join
    it('5. should reject socket connection when token is invalid or missing', (done) => {
      const client = ioClient(socketUrl, {
        auth: {
          token: 'invalidtoken',
        },
      });

      client.on('connect_error', (err) => {
        expect(err.message).toMatch(/Invalid or expired authentication token/i);
        client.close();
        done();
      });

      client.on('connect', () => {
        client.close();
        done(new Error('Connection succeeded but should have failed!'));
      });
    });

    // 6. Socket connection with a valid token joins room user:${userId}
    it('6. should connect successfully with valid token and receive messages emitted to user room', (done) => {
      const client = ioClient(socketUrl, {
        auth: {
          token: tokenStudentA,
        },
      });

      client.on('connect', () => {
        // Connected!
        // To verify we are in room user:${studentA._id}, we'll trigger a notification emit
        // from notificationService, and see if this client receives it.
        notificationService.notify(studentA._id, 'general', 'Socket room test message');
      });

      client.on('notification:new', (data) => {
        expect(data.message).toBe('Socket room test message');
        client.close();
        done();
      });

      client.on('connect_error', (err) => {
        client.close();
        done(err);
      });
    });
  });

  describe('End-to-End Retrofit Flows', () => {
    // 7. Retrofit check: checkout results in a Streak update
    it('7. should trigger a streak update when borrowing a book through HTTP endpoint', async () => {
      // Get student's current streak
      const initialStreak = await Streak.findOne({ userId: studentA._id });
      // Reset lastQualifyingActionAt to yesterday so it increments
      initialStreak.lastQualifyingActionAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await initialStreak.save();

      const expectedNewStreak = initialStreak.currentStreak + 1;

      // Perform checkout (Phase 2 admin endpoint)
      const res = await request(app)
        .post('/api/v1/dashboards/college-admin/circulation/checkout')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          userId: studentA._id.toString(),
          bookId: bookA._id.toString(),
        });
      expect(res.status).toBe(201);

      // Verify Student A's streak increased
      const finalStreak = await Streak.findOne({ userId: studentA._id });
      expect(finalStreak.currentStreak).toBe(expectedNewStreak);
    });

    // 8. Retrofit check: a return that promotes a reservation queue results in a 'hold_ready' Notification
    it('8. should trigger a hold_ready Notification for promoted user when book is returned', async () => {
      // 1. Student A already borrowed bookA in previous test. Let's find that loan.
      const loan = await Loan.findOne({
        userId: studentA._id,
        bookId: bookA._id,
        status: 'active',
      });
      expect(loan).toBeDefined();

      // 2. Student B places a hold on bookA
      const holdRes = await request(app)
        .post('/api/v1/dashboards/student/reservations')
        .set('Authorization', `Bearer ${tokenStudentB}`)
        .send({
          bookId: bookA._id.toString(),
        });
      expect(holdRes.status).toBe(201);

      // 3. Admin A returns bookA (triggering hold promotion for Student B)
      const returnRes = await request(app)
        .post('/api/v1/dashboards/college-admin/circulation/return')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          loanId: loan._id.toString(),
        });
      expect(returnRes.status).toBe(200);

      // 4. Verify Student B has status ready_for_pickup
      const dbHold = await Reservation.findOne({ userId: studentB._id, bookId: bookA._id });
      expect(dbHold.status).toBe('ready_for_pickup');

      // 5. Verify Student B received a hold_ready Notification
      const dbNotification = await Notification.findOne({
        userId: studentB._id,
        type: 'hold_ready',
      });
      expect(dbNotification).toBeDefined();
      expect(dbNotification.message).toMatch(/ready for pickup/i);
    });
  });

  describe('Architectural Integrity checks', () => {
    // 9. confirm no controllers directly call Streak/Notification write operations
    it('9. should verify that no controller files directly write to Streak or Notification collections', () => {
      const controllersDir = path.join(__dirname, '../controllers');

      // Recursive function to get all js files
      const getFiles = (dir) => {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach((file) => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat && stat.isDirectory()) {
            results = results.concat(getFiles(filePath));
          } else if (filePath.endsWith('.js')) {
            results.push(filePath);
          }
        });
        return results;
      };

      const controllerFiles = getFiles(controllersDir);

      const forbiddenPatterns = [
        /Notification\.create\(/,
        /Notification\.updateOne\(/,
        /Notification\.updateMany\(/,
        /Notification\.findOneAndUpdate\(/,
        /Notification\.save\(/,
        /Streak\.create\(/,
        /Streak\.updateOne\(/,
        /Streak\.updateMany\(/,
        /Streak\.findOneAndUpdate\(/,
        /Streak\.save\(/,
      ];

      controllerFiles.forEach((file) => {
        const content = fs.readFileSync(file, 'utf8');
        forbiddenPatterns.forEach((pattern) => {
          const match = content.match(pattern);
          expect(match).toBeNull();
        });
      });
    });
  });
});
