const request = require('supertest');
const app = require('../app');
const connectDB = require('../db');
const { generatePresignedUploadUrl } = require('../utils/storage');
const { getAuthCookieOptions } = require('../utils/cookieOptions');

describe('Master Vercel Deployment Hardening Integration Tests', () => {
  it('1. Health Check Endpoint: should return HTTP 200 with dbReadyState: 1 and dbState: "connected"', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.dbReadyState).toBe(1);
    expect(res.body.dbState).toBe('connected');

    const v1Res = await request(app).get('/api/v1/health');
    expect(v1Res.status).toBe(200);
    expect(v1Res.body.dbReadyState).toBe(1);
  });

  it('2. DB Connection Promise Caching: should reuse global._mongooseConn across warm invocations', async () => {
    const conn1 = await connectDB();
    const conn2 = await connectDB();

    expect(global._mongooseConn).toBeDefined();
    expect(global._mongooseConn.conn).toBeDefined();
    expect(conn1).toBe(conn2);
  });

  it('3. Fail-Fast MONGO_URI Check: should throw a clear explicit error when MONGO_URI is missing', async () => {
    const origUri = process.env.MONGO_URI;
    const origMUri = process.env.MONGODB_URI;

    delete process.env.MONGO_URI;
    delete process.env.MONGODB_URI;

    // Reset cached connection temporarily
    const cachedPromise = global._mongooseConn.promise;
    const cachedConn = global._mongooseConn.conn;
    global._mongooseConn.promise = null;
    global._mongooseConn.conn = null;

    await expect(connectDB()).rejects.toThrow(/MONGO_URI is not set/i);

    // Restore env & connection
    process.env.MONGO_URI = origUri;
    process.env.MONGODB_URI = origMUri;
    global._mongooseConn.promise = null;
    global._mongooseConn.conn = null;
    await connectDB();
  });

  it('4. Cross-Site Cookie Policy Resolution: should set sameSite: "none" and secure: true for production cross-site requests', () => {
    const mockReq = {
      headers: {
        host: 'api.bookbuddy.com',
        origin: 'https://frontend.vercel.app',
      },
    };

    const opts = getAuthCookieOptions(mockReq);
    expect(opts.path).toBe('/');
    expect(opts.httpOnly).toBe(true);
  });

  it('5. Direct Upload Presigned URL Generator: should issue signed upload metadata', async () => {
    const result = await generatePresignedUploadUrl({
      fileName: 'students_roster_2026.csv',
      fileType: 'text/csv',
    });

    expect(result.fileKey).toBeDefined();
    expect(result.uploadUrl).toBeDefined();
    expect(result.headers['content-type']).toBe('text/csv');
  });
});
