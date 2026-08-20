process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_socketroom_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testjwtlibrarysecretkey999';

jest.setTimeout(30000);

const http = require('http');
const mongoose = require('mongoose');
const { io: ioClient } = require('socket.io-client');
const app = require('../app');
const connectDB = require('../config/db');
const { initSockets, getIo } = require('../sockets');
const User = require('../models/User');
const College = require('../models/College');
const { generateAccessToken } = require('../utils/token');

describe('Per-College Socket.io Room Join & Broadcast Acceptance Test', () => {
  let server, port;
  let collegeA, collegeB;
  let userA, userB;
  let tokenA, tokenB;

  beforeAll(async () => {
    await connectDB();

    server = http.createServer(app);
    initSockets(server);

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });

    collegeA = await College.create({
      name: 'College Alpha Sockets',
      code: `SOCK_ALPHA_${Date.now()}`,
      status: 'active',
    });

    collegeB = await College.create({
      name: 'College Beta Sockets',
      code: `SOCK_BETA_${Date.now()}`,
      status: 'active',
    });

    userA = await User.create({
      studentId: `STU_SOCK_A_${Date.now()}`,
      name: 'Alice Socket',
      email: `alice_sock_${Date.now()}@alpha.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    userB = await User.create({
      studentId: `STU_SOCK_B_${Date.now()}`,
      name: 'Bob Socket',
      email: `bob_sock_${Date.now()}@beta.edu`,
      password: 'password123',
      role: 'student',
      collegeId: collegeB._id,
    });

    tokenA = generateAccessToken(userA);
    tokenB = generateAccessToken(userB);
  });

  afterAll(async () => {
    try {
      await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
      await College.deleteMany({ _id: { $in: [collegeA._id, collegeB._id] } });
    } catch {
      // Ignore cleanup
    } finally {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    }
  });

  test('Emitting to college:{collegeId} reaches ONLY connected clients from that specific college', (done) => {
    const clientAUrl = `http://localhost:${port}`;
    const clientBUrl = `http://localhost:${port}`;

    const clientA = ioClient(clientAUrl, {
      auth: { token: tokenA },
      transports: ['websocket'],
    });

    const clientB = ioClient(clientBUrl, {
      auth: { token: tokenB },
      transports: ['websocket'],
    });

    let clientAReceived = false;
    let clientBReceived = false;

    let connectedCount = 0;
    const checkConnected = () => {
      connectedCount++;
      if (connectedCount === 2) {
        // Broadcast test message to College A room
        const ioServer = getIo();
        ioServer.to(`college:${collegeA._id.toString()}`).emit('bulletin:new_event', {
          title: 'College A Exclusive Event Announcement',
        });

        // Wait 300ms to verify reception/exclusion
        setTimeout(() => {
          clientA.disconnect();
          clientB.disconnect();

          expect(clientAReceived).toBe(true);
          expect(clientBReceived).toBe(false); // ZERO cross-college leakage
          done();
        }, 300);
      }
    };

    clientA.on('connect', checkConnected);
    clientB.on('connect', checkConnected);

    clientA.on('bulletin:new_event', (data) => {
      if (data.title === 'College A Exclusive Event Announcement') {
        clientAReceived = true;
      }
    });

    clientB.on('bulletin:new_event', () => {
      clientBReceived = true;
    });
  });
});
