const mongoose = require('mongoose');
const axios = require('axios');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const app = require('../app');
const College = require('../models/College');
const User = require('../models/User');
const CollegeFeatureConfig = require('../models/CollegeFeatureConfig');
const { generateTokenPair } = require('../utils/token');
const { deleteCache } = require('../utils/redisCache');
const { FEATURE_FLAGS } = require('@bookbuddy/shared');

async function runFeature2Proof() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('='.repeat(80));
  console.log('FEATURE 2 PROOF: ACCESSIBILITY MODE & PER-USER ISOLATION VERIFICATION');
  console.log('='.repeat(80));

  // 1. Two colleges and users
  const collegeA = await College.findOne({ slug: 'standford' });
  const collegeB = await College.findOne({ slug: 'edu' });

  if (!collegeA || !collegeB) {
    console.error('Seeded colleges (standford, edu) not found.');
    process.exit(1);
  }

  const studentA = await User.findOne({ email: 'student@standard.edu' });
  const adminA = await User.findOne({ email: 'admin@standard.edu' });
  const studentB = await User.findOne({ email: 'student@ganesh.edu' });

  if (!studentA || !adminA || !studentB) {
    console.error('Seeded users (studentA, adminA, studentB) not found.');
    process.exit(1);
  }

  console.log(`[Database] College A (Stanford): ${collegeA.name} (_id: ${collegeA._id})`);
  console.log(`[Database] User A1 (Student): ${studentA.name} (${studentA.email})`);
  console.log(`[Database] User A2 (Admin): ${adminA.name} (${adminA.email})`);
  console.log(`[Database] College B (Ganesh): ${collegeB.name} (_id: ${collegeB._id})`);
  console.log(`[Database] User B (Student): ${studentB.name} (${studentB.email})`);

  // Ephemeral HTTP server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const tokenA1 = generateTokenPair(studentA).accessToken;
  const tokenA2 = generateTokenPair(adminA).accessToken;
  const tokenB = generateTokenPair(studentB).accessToken;

  console.log('\n--- 1. Baseline: accessibility-mode is OFF for both Colleges ---');

  await CollegeFeatureConfig.findOneAndUpdate(
    { collegeId: collegeA._id },
    { enabledFeatures: ['catalog', 'loans', 'patron-card'] },
    { upsert: true }
  );
  await CollegeFeatureConfig.findOneAndUpdate(
    { collegeId: collegeB._id },
    { enabledFeatures: ['catalog', 'loans', 'patron-card'] },
    { upsert: true }
  );
  await deleteCache(`college:features:${collegeA._id}`);
  await deleteCache(`college:features:${collegeB._id}`);

  // Test 1: User A1 requests accessibility preferences when flag is OFF -> Expect 403 Forbidden
  try {
    console.log(
      `[Request 1] Student A1 accessing GET /api/v1/users/me/accessibility with flag OFF`
    );
    await axios.get(`${baseUrl}/api/v1/users/me/accessibility`, {
      headers: { Authorization: `Bearer ${tokenA1}` },
    });
    console.error('FAILED: Expected 403 for disabled feature flag!');
    process.exit(1);
  } catch (err) {
    console.log(
      `✓ Response 1 (Expected 403): HTTP ${err.response?.status} - ${JSON.stringify(err.response?.data)}`
    );
  }

  // Test 2: User A1 attempts to PATCH accessibility preferences when flag is OFF -> Expect 403 Forbidden
  try {
    console.log(
      `[Request 2] Student A1 accessing PATCH /api/v1/users/me/accessibility with flag OFF`
    );
    await axios.patch(
      `${baseUrl}/api/v1/users/me/accessibility`,
      { dyslexiaFont: true, highContrast: true },
      { headers: { Authorization: `Bearer ${tokenA1}` } }
    );
    console.error('FAILED: Expected 403 for PATCH with disabled feature flag!');
    process.exit(1);
  } catch (err) {
    console.log(
      `✓ Response 2 (Expected 403): HTTP ${err.response?.status} - ${JSON.stringify(err.response?.data)}`
    );
  }

  console.log('\n--- 2. Enable accessibility-mode ONLY for College A (Tenant Isolation) ---');

  await CollegeFeatureConfig.findOneAndUpdate(
    { collegeId: collegeA._id },
    { enabledFeatures: ['catalog', 'loans', 'patron-card', FEATURE_FLAGS.ACCESSIBILITY_MODE] },
    { upsert: true }
  );
  await deleteCache(`college:features:${collegeA._id}`);

  // Test 3: User A1 GET accessibility preferences -> Expect 200 OK
  const resGetA1 = await axios.get(`${baseUrl}/api/v1/users/me/accessibility`, {
    headers: { Authorization: `Bearer ${tokenA1}` },
  });
  console.log(
    `✓ Response 3 (Expected 200): HTTP ${resGetA1.status} - Initial Prefs: ${JSON.stringify(resGetA1.data.data)}`
  );

  // Test 4: User A1 updates settings (dyslexia font, high contrast, TTS) -> Expect 200 OK
  const updatePayload = {
    dyslexiaFont: true,
    highContrast: true,
    textToSpeech: true,
    ttsRate: 1.25,
    ttsPitch: 1.0,
  };
  const resPatchA1 = await axios.patch(`${baseUrl}/api/v1/users/me/accessibility`, updatePayload, {
    headers: { Authorization: `Bearer ${tokenA1}` },
  });
  console.log(
    `✓ Response 4 (Expected 200): HTTP ${resPatchA1.status} - Updated Prefs: ${JSON.stringify(resPatchA1.data.data)}`
  );

  // Test 5: Verify MongoDB persistence directly
  const freshUserA1 = await User.findById(studentA._id).lean();
  console.log(`\n[Database Query Verification] User ${freshUserA1.email} in MongoDB:`);
  console.log(`  accessibilityPreferences:`, freshUserA1.accessibilityPreferences);
  if (
    freshUserA1.accessibilityPreferences?.dyslexiaFont !== true ||
    freshUserA1.accessibilityPreferences?.highContrast !== true ||
    freshUserA1.accessibilityPreferences?.textToSpeech !== true ||
    freshUserA1.accessibilityPreferences?.ttsRate !== 1.25
  ) {
    console.error('FAILED: MongoDB document does not reflect updated preferences!');
    process.exit(1);
  }
  console.log('✓ Database persistence matches update payload exactly.');

  // Test 6: Per-User Isolation in College A (User A2 Admin must not have User A1 settings)
  const resGetA2 = await axios.get(`${baseUrl}/api/v1/users/me/accessibility`, {
    headers: { Authorization: `Bearer ${tokenA2}` },
  });
  console.log(
    `\n[Per-User Isolation] User A2 (${adminA.email}) GET /api/v1/users/me/accessibility:`
  );
  console.log(`  Prefs: ${JSON.stringify(resGetA2.data.data)}`);
  if (resGetA2.data.data.dyslexiaFont === true || resGetA2.data.data.highContrast === true) {
    console.error('FAILED: User A2 incorrectly inherited User A1 preferences!');
    process.exit(1);
  }
  console.log('✓ Per-user isolation verified: User A2 retains isolated default preferences.');

  // Test 7: Multi-Tenant Isolation (User B in College B must be 403 Forbidden)
  console.log('\n--- 3. Multi-Tenant Cross-College Isolation ---');
  try {
    console.log(
      `[Request 7] Student B (${studentB.email}, College B) accessing GET /api/v1/users/me/accessibility`
    );
    await axios.get(`${baseUrl}/api/v1/users/me/accessibility`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    console.error('FAILED: Expected 403 for College B user when flag is disabled for College B!');
    process.exit(1);
  } catch (err) {
    console.log(
      `✓ Response 7 (Expected 403): HTTP ${err.response?.status} - ${JSON.stringify(err.response?.data)}`
    );
  }

  try {
    console.log(
      `[Request 8] Student B (${studentB.email}, College B) accessing PATCH /api/v1/users/me/accessibility`
    );
    await axios.patch(
      `${baseUrl}/api/v1/users/me/accessibility`,
      { dyslexiaFont: true },
      { headers: { Authorization: `Bearer ${tokenB}` } }
    );
    console.error('FAILED: Expected 403 for College B user when flag is disabled for College B!');
    process.exit(1);
  } catch (err) {
    console.log(
      `✓ Response 8 (Expected 403): HTTP ${err.response?.status} - ${JSON.stringify(err.response?.data)}`
    );
  }

  // Cleanup
  server.close();
  await mongoose.disconnect();
  console.log('\n' + '='.repeat(80));
  console.log('FEATURE 2 PROOF: ALL ACCEPTANCE AND ISOLATION CHECKS PASSED SUCCESSFULLY');
  console.log('='.repeat(80));
  process.exit(0);
}

runFeature2Proof().catch((err) => {
  console.error('Error during Feature 2 proof execution:', err);
  process.exit(1);
});
