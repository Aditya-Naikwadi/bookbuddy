process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testjwtrealtimesecretkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtrealtimerefreshsecretkey999';
jest.setTimeout(45000);

const http = require('http');
const request = require('supertest');
const mongoose = require('mongoose');
const { io: ioClient } = require('socket.io-client');
const app = require('../app');
const { initSockets, emitRealtimeEvent, events } = require('../sockets');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');
const { generateTokenPair } = require('../utils/token');
const {
  executeGeneralSearch,
  getUpstreamCallCount,
  resetUpstreamCallCount,
} = require('../services/generalSearchService');

describe('Domain B (Catalog, Inventory, Search & Indexing) Integration Tests', () => {
  let server;
  let ioServer;
  let serverPort;
  let collegeA;
  let collegeB;
  let studentA;
  let studentB;
  let adminA;
  let studentAToken;
  let studentBToken;
  let adminAToken;
  let clientA;
  let clientB;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test');
    }

    server = http.createServer(app);
    ioServer = initSockets(server);

    await new Promise((resolve) => {
      server.listen(0, () => {
        serverPort = server.address().port;
        resolve();
      });
    });

    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Create 2 distinct colleges for multi-tenant isolation testing
    collegeA = await College.create({
      name: 'College Alpha',
      code: `CA_${unique}`,
      domain: `alpha_${unique}.edu`,
      status: 'active',
    });

    collegeB = await College.create({
      name: 'College Beta',
      code: `CB_${unique}`,
      domain: `beta_${unique}.edu`,
      status: 'active',
    });

    // Create Student at College A
    studentA = await User.create({
      studentId: `STUA_${unique}`,
      name: 'Alice Student',
      email: `alice_${unique}@alpha.edu`,
      password: 'HashedPassword123!',
      role: 'student',
      collegeId: collegeA._id,
      isActive: true,
    });
    studentAToken = generateTokenPair(studentA).accessToken;

    // Create Student at College B
    studentB = await User.create({
      studentId: `STUB_${unique}`,
      name: 'Bob Student',
      email: `bob_${unique}@beta.edu`,
      password: 'HashedPassword123!',
      role: 'student',
      collegeId: collegeB._id,
      isActive: true,
    });
    studentBToken = generateTokenPair(studentB).accessToken;

    // Create College Admin at College A
    adminA = await User.create({
      studentId: `ADMA_${unique}`,
      name: 'Admin Alpha',
      email: `admin_${unique}@alpha.edu`,
      password: 'HashedPassword123!',
      role: 'college_admin',
      collegeId: collegeA._id,
      isActive: true,
    });
    adminAToken = generateTokenPair(adminA).accessToken;

    // Ensure Book indexes are created
    await Book.createIndexes();
  });

  afterAll(async () => {
    if (clientA && clientA.connected) clientA.disconnect();
    if (clientB && clientB.connected) clientB.disconnect();

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. Real-time availability updates to Unavailable within 1s without refetch', async () => {
    // Connect client A
    clientA = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: studentAToken },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      clientA.on('connect', resolve);
      clientA.on('connect_error', reject);
    });

    const book = await Book.create({
      title: 'Realtime Availability Handbook',
      author: 'Test Author',
      isbn: `978012${Date.now().toString().slice(-7)}`,
      category: 'Computer Science',
      genre: 'Computer Science',
      copiesTotal: 1,
      copiesAvailable: 1,
      reservedCopies: 0,
      collegeId: collegeA._id,
      format: 'physical',
      isShareableAcrossColleges: false,
    });

    const receivedPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for book:updated within 1000ms')),
        1000
      );
      clientA.on('book:updated', (payload) => {
        if (
          payload.entityId === book._id.toString() ||
          payload.entityId?.toString() === book._id.toString()
        ) {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });

    const startTime = Date.now();

    // Trigger update
    emitRealtimeEvent({
      event: events.BOOK_UPDATED,
      rooms: [`college:${collegeA._id}`],
      entityId: book._id,
      collegeId: collegeA._id,
      changed: {
        copiesAvailable: 0,
        reservedCopies: 0,
      },
    });

    const payload = await receivedPromise;
    const latency = Date.now() - startTime;

    expect(latency).toBeLessThan(1000);
    expect(payload.changed.copiesAvailable).toBe(0);
  });

  test('2. Multi-tenant privacy: College B student never receives book:updated for private College A books', async () => {
    clientB = ioClient(`http://localhost:${serverPort}`, {
      auth: { token: studentBToken },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      clientB.on('connect', resolve);
      clientB.on('connect_error', reject);
    });

    const privateBookA = await Book.create({
      title: 'Confidential Internal Alpha Research',
      author: 'Dr. Alpha',
      isbn: `978099${Date.now().toString().slice(-7)}`,
      category: 'Research',
      genre: 'Research',
      copiesTotal: 1,
      copiesAvailable: 1,
      collegeId: collegeA._id,
      format: 'physical',
      isShareableAcrossColleges: false,
    });

    let collegeBReceivedPrivateEvent = false;
    clientB.on('book:updated', (payload) => {
      if (payload.entityId === privateBookA._id.toString()) {
        collegeBReceivedPrivateEvent = true;
      }
    });

    emitRealtimeEvent({
      event: events.BOOK_UPDATED,
      rooms: [`college:${collegeA._id}`],
      entityId: privateBookA._id,
      collegeId: collegeA._id,
      changed: { copiesAvailable: 0 },
    });

    // Wait 300ms to verify no leakage
    await new Promise((r) => setTimeout(r, 300));
    expect(collegeBReceivedPrivateEvent).toBe(false);
  });

  test('3. Role-based field redaction: Students querying /api/v1/inventory never receive purchasePrice', async () => {
    const bookWithPrice = await Book.create({
      title: 'Rare Illustrated Manuscript',
      author: 'Antiquarian Society',
      isbn: `978055${Date.now().toString().slice(-7)}`,
      category: 'History',
      genre: 'History',
      deweyDecimal: '090.1',
      shelfLocation: 'Vault-B2',
      callNumber: 'HIST-090-V2',
      purchasePrice: 14500.5,
      copiesTotal: 1,
      copiesAvailable: 1,
      collegeId: collegeA._id,
      format: 'physical',
    });

    // 1. Query as student
    const studentRes = await request(app)
      .get('/api/v1/inventory')
      .set('Authorization', `Bearer ${studentAToken}`);

    expect(studentRes.status).toBe(200);
    expect(studentRes.body.success).toBe(true);

    const studentFoundBook = studentRes.body.data.find(
      (b) => b._id.toString() === bookWithPrice._id.toString()
    );
    expect(studentFoundBook).toBeDefined();
    expect(studentFoundBook.purchasePrice).toBeUndefined();
    expect(studentFoundBook.deweyDecimal).toBeUndefined();
    expect(studentFoundBook.shelfLocation).toBeUndefined();
    expect(studentFoundBook.callNumber).toBeUndefined();

    // 2. Query as college_admin
    const adminRes = await request(app)
      .get('/api/v1/inventory')
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);

    const adminFoundBook = adminRes.body.data.find(
      (b) => b._id.toString() === bookWithPrice._id.toString()
    );
    expect(adminFoundBook).toBeDefined();
    expect(adminFoundBook.purchasePrice).toBe(14500.5);
    expect(adminFoundBook.deweyDecimal).toBe('090.1');
    expect(adminFoundBook.shelfLocation).toBe('Vault-B2');
    expect(adminFoundBook.callNumber).toBe('HIST-090-V2');
  });

  test('4. Request coalescing: 100 concurrent identical GeneralSearch requests execute exactly 1 upstream call', async () => {
    resetUpstreamCallCount();

    const mockSearchFn = jest.fn().mockImplementation(async (params) => {
      // Simulate 50ms network delay
      await new Promise((r) => setTimeout(r, 50));
      return {
        total: 1,
        page: 1,
        pages: 1,
        books: [{ id: 'mock1', title: 'Coalesced Results for ' + params.q }],
      };
    });

    const searchParams = {
      q: 'distributed systems coalescing',
      category: 'computer science',
      page: 1,
      limit: 10,
    };

    // Fire 100 identical concurrent search calls
    const requests = Array.from({ length: 100 }).map(() =>
      executeGeneralSearch(searchParams, mockSearchFn)
    );

    const results = await Promise.all(requests);

    expect(results).toHaveLength(100);
    // All 100 results must match
    results.forEach((res) => {
      expect(res.books[0].title).toBe('Coalesced Results for distributed systems coalescing');
    });

    // Exactly 1 upstream call occurred
    expect(mockSearchFn).toHaveBeenCalledTimes(1);
    expect(getUpstreamCallCount()).toBe(1);
  });

  test('5. Compound indexes on Book show IXSCAN in explain() for catalog and cross-college queries', async () => {
    // Check 1: Cross-college query
    const crossCollegeExplain = await Book.find({
      isShareableAcrossColleges: true,
    })
      .sort({ createdAt: -1 })
      .explain('executionStats');

    const executionStages =
      crossCollegeExplain.executionStats?.executionStages ||
      crossCollegeExplain.queryPlanner?.winningPlan;

    // Check that stage is IXSCAN (or contains an inputStage of IXSCAN)
    const findStage = (stage) => {
      if (!stage) return null;
      if (stage.stage === 'IXSCAN') return stage;
      if (stage.inputStage) return findStage(stage.inputStage);
      if (Array.isArray(stage.inputStages)) {
        for (const s of stage.inputStages) {
          const found = findStage(s);
          if (found) return found;
        }
      }
      return null;
    };

    const ixScanStage = findStage(executionStages);
    expect(ixScanStage).toBeDefined();
    expect(ixScanStage.stage).toBe('IXSCAN');

    // Check 2: Shelf location query with collegeId
    const shelfExplain = await Book.find({
      collegeId: collegeA._id,
      shelfLocation: /^Vault/,
    }).explain('executionStats');

    const shelfIxScan = findStage(
      shelfExplain.executionStats?.executionStages || shelfExplain.queryPlanner?.winningPlan
    );
    expect(shelfIxScan).toBeDefined();
    expect(shelfIxScan.stage).toBe('IXSCAN');
  });
});
