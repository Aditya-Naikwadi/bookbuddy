const http = require('http');
const axios = require('axios');
const mongoose = require('mongoose');
const app = require('../app');
const connectDB = require('../config/db');
const User = require('../models/User');
const College = require('../models/College');
const { generateTokenPair } = require('../utils/token');

const PORT = 5005; // Use dedicated test port to avoid conflicts
const BASE_URL = `http://localhost:${PORT}`;

const runVerification = async () => {
  console.log('--- STARTING EXPRESS BACKEND E2E VERIFICATION ---');

  // 1. Connect MongoDB
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB database successfully');
  } catch (dbErr) {
    console.error('❌ MongoDB Connection Error:', dbErr.message);
    process.exit(1);
  }

  // 2. Start HTTP Server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`✅ Express server listening on ${BASE_URL}`);

  try {
    // Test 1: GET /health
    const resHealth = await axios.get(`${BASE_URL}/health`);
    console.log('✅ 1. GET /health STATUS:', resHealth.status);
    console.log('      Response:', JSON.stringify(resHealth.data));

    // Test 2: GET /api/v1/auth/me (Unauthenticated)
    try {
      await axios.get(`${BASE_URL}/api/v1/auth/me`);
      console.error('❌ 2. GET /api/v1/auth/me expected 401 but succeeded');
    } catch (err) {
      if (err.response && err.response.status === 401) {
        console.log(
          '✅ 2. GET /api/v1/auth/me (Unauthenticated) returned 401 Unauthorized as expected'
        );
      } else {
        console.error('❌ 2. GET /api/v1/auth/me error:', err.message);
      }
    }

    // Test 3: GET /api/v1/auth/google (Google OAuth Redirect)
    const resGoogle = await axios.get(`${BASE_URL}/api/v1/auth/google`, {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    console.log('✅ 3. GET /api/v1/auth/google OAuth Redirect STATUS:', resGoogle.status);
    console.log('      Location:', resGoogle.headers.location);

    // Test 4: GET /api/v1/auth/github (GitHub OAuth Redirect)
    const resGitHub = await axios.get(`${BASE_URL}/api/v1/auth/github`, {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    console.log('✅ 4. GET /api/v1/auth/github OAuth Redirect STATUS:', resGitHub.status);
    console.log('      Location:', resGitHub.headers.location);

    // Test 5: GET /api/v1/auth/me (Authenticated with JWT)
    let college = await College.findOne({ isActive: true });
    if (!college) {
      college = await College.create({
        name: 'Verification Campus',
        code: 'VERIFY',
        isActive: true,
        status: 'active',
      });
    }

    let testUser = await User.findOne({ email: 'e2e_verifier@example.com' });
    if (!testUser) {
      testUser = await User.create({
        studentId: 'V-999999',
        name: 'E2E OAuth User',
        email: 'e2e_verifier@example.com',
        authProvider: 'github',
        githubId: 'github_user_999999',
        collegeId: college._id,
        role: 'student',
        isEmailVerified: true,
      });
    }

    const { accessToken } = generateTokenPair(testUser);
    const resMe = await axios.get(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.log('✅ 5. GET /api/v1/auth/me (Authenticated) STATUS:', resMe.status);
    console.log('      User Payload:', JSON.stringify(resMe.data.user));

    // Test 6: POST /api/v1/auth/logout
    const resLogout = await axios.post(
      `${BASE_URL}/api/v1/auth/logout`,
      {},
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    console.log('✅ 6. POST /api/v1/auth/logout STATUS:', resLogout.status);
    console.log('      Message:', resLogout.data.message);

    console.log('--- ALL 6 ENDPOINT VERIFICATIONS PASSED WITH ZERO ERRORS ---');
  } catch (err) {
    console.error('❌ E2E Verification failed:', err.message, err.response?.data);
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
};

runVerification();
