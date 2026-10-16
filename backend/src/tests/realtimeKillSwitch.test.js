process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testjwtkillswitchsecretkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtkillswitchrefreshsecretkey999';

const http = require('http');
const mongoose = require('mongoose');
const { io: ioClient } = require('socket.io-client');
const { initSockets } = require('../sockets');
const User = require('../models/User');
const College = require('../models/College');
const CollegeFeatureConfig = require('../models/CollegeFeatureConfig');
const AuditLog = require('../models/AuditLog');
const { generateTokenPair } = require('../utils/token');
const {
  getRealtimeMode,
  setRealtimeMode,
  resetFlagCache,
} = require('../services/realtimeFlagService');

describe('Real-Time Layer Kill Switch & Per-College Enablement', () => {
  let server;
  let ioServer;
  let serverPort;
  let college1Id;
  let college2Id;
  let user1;
  let user1Token;

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

    college1Id = new mongoose.Types.ObjectId();
    college2Id = new mongoose.Types.ObjectId();

    await College.create([
      {
        _id: college1Id,
        name: 'Pilot College Alpha',
        code: `PCA_${Date.now()}`,
        domain: 'pca.edu',
      },
      {
        _id: college2Id,
        name: 'Control College Beta',
        code: `CCB_${Date.now()}`,
        domain: 'ccb.edu',
      },
    ]);

    user1 = await User.create({
      name: 'Pilot User',
      studentId: `STU_${Date.now()}`,
      email: `pilot_${Date.now()}@pca.edu`,
      password: 'HashedPassword123!',
      role: 'student',
      collegeId: college1Id,
      isActive: true,
    });

    user1Token = generateTokenPair(user1).accessToken;
  });

  afterAll(async () => {
    await College.deleteMany({ _id: { $in: [college1Id, college2Id] } });
    await User.deleteMany({ _id: user1._id });
    await CollegeFeatureConfig.deleteMany({ collegeId: { $in: [college1Id, college2Id] } });
    await AuditLog.deleteMany({ collegeId: { $in: [college1Id, college2Id] } });

    await new Promise((resolve) => {
      ioServer.close(() => {
        server.close(resolve);
      });
    });
  });

  beforeEach(() => {
    resetFlagCache();
  });

  it('1. Default real-time mode returns "on" when unconfigured', async () => {
    const mode = await getRealtimeMode(college1Id);
    expect(mode).toBe('on');
  });

  it('2. Flipping mode to "polling_only" writes to AuditLog and updates CollegeFeatureConfig', async () => {
    const res = await setRealtimeMode({
      collegeId: college1Id,
      mode: 'polling_only',
      user: { _id: user1._id, role: 'collegeadmin' },
      ip: '10.0.0.1',
    });

    expect(res.mode).toBe('polling_only');

    const config = await CollegeFeatureConfig.findOne({ collegeId: college1Id });
    expect(config.realtimeMode).toBe('polling_only');

    const audit = await AuditLog.findOne({
      collegeId: college1Id.toString(),
      action: 'COLLEGE_REALTIME_MODE_UPDATED',
    });
    expect(audit).toBeDefined();
    expect(audit.metadata.newMode).toBe('polling_only');
  });

  it('3. Socket handshake is refused with REALTIME_DISABLED when college mode is "polling_only"', async () => {
    // Flag is currently polling_only
    const client = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: false,
      reconnection: false,
      auth: { token: user1Token },
    });

    const errorPromise = new Promise((resolve) => {
      client.on('connect_error', (err) => {
        resolve(err.message);
      });
      client.connect();
    });

    const errorMessage = await errorPromise;
    expect(errorMessage).toMatch(/REALTIME_DISABLED/);
    expect(client.connected).toBe(false);
    client.disconnect();
  });

  it('4. Flipping flag back to "on" immediately allows socket handshake to succeed', async () => {
    await setRealtimeMode({
      collegeId: college1Id,
      mode: 'on',
      user: { _id: user1._id, role: 'collegeadmin' },
    });

    const client = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: false,
      reconnection: false,
      auth: { token: user1Token },
    });

    const connectPromise = new Promise((resolve) => {
      client.on('connect', () => {
        resolve(true);
      });
      client.connect();
    });

    const connected = await connectPromise;
    expect(connected).toBe(true);
    expect(client.connected).toBe(true);
    client.disconnect();
  });

  it('5. Global kill switch overrides per-college mode to "off" and emits system:realtime_paused', async () => {
    // Connect user while mode is on
    const client = ioClient(`http://localhost:${serverPort}`, {
      autoConnect: false,
      reconnection: false,
      auth: { token: user1Token },
    });

    await new Promise((resolve) => {
      client.on('connect', resolve);
      client.connect();
    });

    const pausedEventPromise = new Promise((resolve) => {
      client.on('system:realtime_paused', (data) => {
        resolve(data);
      });
    });

    // Flip global flag to off
    await setRealtimeMode({
      isGlobal: true,
      mode: 'off',
      user: { _id: user1._id, role: 'superadmin' },
    });

    const pausedData = await pausedEventPromise;
    expect(pausedData.mode).toBe('off');
    expect(pausedData.isGlobal).toBe(true);

    client.disconnect();

    // Reset global mode to on
    await setRealtimeMode({
      isGlobal: true,
      mode: 'on',
      user: { _id: user1._id, role: 'superadmin' },
    });
  });
});
