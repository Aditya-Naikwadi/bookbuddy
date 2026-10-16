process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testjwtrealtimesecretkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtrealtimerefreshsecretkey999';

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { io: ioClient } = require('socket.io-client');
const { initSockets, emitRealtimeEvent, events } = require('../sockets');
const User = require('../models/User');
const College = require('../models/College');
const RevokedToken = require('../models/RevokedToken');
const { generateTokenPair, blacklistToken } = require('../utils/token');

describe('Socket Foundation Tests (Part 0)', () => {
  let server;
  let ioServer;
  let serverPort;
  let college1Id;
  let college2Id;
  let user1;
  let user1Token;

  beforeAll(async () => {
    // Connect to test database if not already connected
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

    college1Id = new mongoose.Types.ObjectId();
    college2Id = new mongoose.Types.ObjectId();

    await College.deleteMany({ _id: { $in: [college1Id, college2Id] } });
    await College.create([
      {
        _id: college1Id,
        name: 'Engineering College Alpha',
        code: `ECA_${Date.now()}`,
        domain: 'alpha.edu',
      },
      { _id: college2Id, name: 'Arts College Beta', code: `ACB_${Date.now()}`, domain: 'beta.edu' },
    ]);

    user1 = await User.create({
      name: 'Alice Student',
      studentId: `STU_${Date.now()}`,
      email: `alice_${Date.now()}@alpha.edu`,
      password: 'HashedPassword123!',
      role: 'student',
      collegeId: college1Id,
      isActive: true,
    });

    user1Token = generateTokenPair(user1).accessToken;
  });

  afterAll(async () => {
    if (ioServer) {
      await new Promise((resolve) => ioServer.close(resolve));
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (user1) {
      await User.deleteOne({ _id: user1._id });
    }
    await College.deleteMany({ _id: { $in: [college1Id, college2Id] } });
  });

  test('1. Valid token handshakes successfully and joins college, user and role rooms', (done) => {
    const client = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: user1Token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    client.on('connect', () => {
      expect(client.connected).toBe(true);

      // Verify the rooms on the server socket instance
      const serverSocket = ioServer.sockets.sockets.get(client.id);
      expect(serverSocket).toBeDefined();
      expect(serverSocket.rooms.has(`user:${user1._id}`)).toBe(true);
      expect(serverSocket.rooms.has(`college:${college1Id}`)).toBe(true);
      expect(serverSocket.rooms.has(`role:${college1Id}:student`)).toBe(true);

      client.disconnect();
      done();
    });

    client.on('connect_error', (err) => {
      done(err);
    });
  });

  test('2. Expired token is rejected on handshake', (done) => {
    // Sign an expired token
    const expiredToken = jwt.sign(
      { sub: user1._id.toString(), role: 'student', collegeId: college1Id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '-10s', issuer: 'bookbuddy-api', audience: 'bookbuddy-client' }
    );

    const client = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: expiredToken },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    client.on('connect', () => {
      client.disconnect();
      done(new Error('Connection should have been rejected for expired token'));
    });

    client.on('connect_error', (err) => {
      expect(err.message).toMatch(/expired/i);
      client.disconnect();
      done();
    });
  });

  test('3. Revoked token is rejected on handshake', async () => {
    const revokedToken = jwt.sign(
      {
        sub: user1._id.toString(),
        role: 'student',
        collegeId: college1Id.toString(),
        nonce: `revoked_${Date.now()}_${Math.random()}`,
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m', issuer: 'bookbuddy-api', audience: 'bookbuddy-client' }
    );
    // Revoke the token
    await blacklistToken(revokedToken, null, 'Test revocation');

    await new Promise((resolve, reject) => {
      const client = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: revokedToken },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });

      client.on('connect', () => {
        client.disconnect();
        reject(new Error('Connection should have been rejected for revoked token'));
      });

      client.on('connect_error', (err) => {
        expect(err.message).toMatch(/revoked/i);
        client.disconnect();
        resolve();
      });
    });
  });

  test('4. Room isolation: client is prevented from joining another college room', (done) => {
    const token = generateTokenPair(user1).accessToken;
    const client = ioClient(`http://localhost:${serverPort}`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    client.on('connect_error', (err) => {
      done(new Error(`Test 4 connect_error: ${err.message}`));
    });

    client.on('connect', () => {
      // Attempt to join College 2 room
      client.emit('join:room', `college:${college2Id}`, (response) => {
        try {
          expect(response.success).toBe(false);
          expect(response.error).toMatch(/unauthorized/i);

          const serverSocket = ioServer.sockets.sockets.get(client.id);
          expect(serverSocket.rooms.has(`college:${college2Id}`)).toBe(false);

          client.disconnect();
          done();
        } catch (e) {
          client.disconnect();
          done(e);
        }
      });
    });
  });

  test('5. Reconnect resync: client with lastSeenAt receives missed events', (done) => {
    const pastTime = new Date(Date.now() - 5000).toISOString();

    // Emit an event to college1 room
    emitRealtimeEvent({
      event: events.BOOK_UPDATED,
      rooms: [`college:${college1Id}`],
      entityId: 'book-123',
      collegeId: college1Id.toString(),
      changed: { copiesAvailable: 3 },
    });

    const token = generateTokenPair(user1).accessToken;
    const client = ioClient(`http://localhost:${serverPort}`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });

    client.on('connect_error', (err) => {
      done(new Error(`Test 5 connect_error: ${err.message}`));
    });

    client.on('connect', () => {
      client.emit('resync', { lastSeenAt: pastTime }, (res) => {
        try {
          expect(res.success).toBe(true);
          expect(Array.isArray(res.events)).toBe(true);
          const bookEvent = res.events.find((e) => e.event === events.BOOK_UPDATED);
          expect(bookEvent).toBeDefined();
          expect(bookEvent.payload.entityId).toBe('book-123');
          expect(bookEvent.payload.changed.copiesAvailable).toBe(3);

          client.disconnect();
          done();
        } catch (e) {
          client.disconnect();
          done(e);
        }
      });
    });
  });
});
