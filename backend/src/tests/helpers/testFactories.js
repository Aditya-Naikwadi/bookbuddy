const mongoose = require('mongoose');
const College = require('../../models/College');
const User = require('../../models/User');
const { generateAccessToken } = require('../../utils/token');

/**
 * Creates a unique test college tenant with multi-tenant enabled features.
 * @param {Object} [overrides]
 * @returns {Promise<Document>}
 */
async function createTestCollege(overrides = {}) {
  const stamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return await College.create({
    name: `Test College ${stamp}`,
    code: `COL_${stamp.toUpperCase()}`,
    slug: `college-${stamp}`,
    subdomain: `college-${stamp}`,
    status: 'active',
    enabledFeatures: [
      'catalog',
      'loans',
      'fines',
      'e-resources',
      'facilities',
      'support',
      'gamification',
    ],
    ...overrides,
  });
}

/**
 * Creates a test user belonging to a specific college tenant.
 * @param {Object} overrides
 * @returns {Promise<Document>}
 */
async function createTestUser(overrides = {}) {
  const stamp = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const collegeId = overrides.collegeId || new mongoose.Types.ObjectId();
  const role = overrides.role || 'student';

  return await User.create({
    name: `User ${stamp}`,
    email: `user_${stamp}@testcollege.edu`,
    password: 'Password123!',
    role,
    collegeId,
    studentId: role === 'student' ? `STU_${stamp}` : undefined,
    status: 'active',
    ...overrides,
  });
}

/**
 * Generates an access token and bearer header for a user.
 * @param {Object} user
 * @returns {{ token: string, authHeader: string }}
 */
function getAuthToken(user) {
  const token = generateAccessToken(user);
  return {
    token,
    authHeader: `Bearer ${token}`,
  };
}

/**
 * Clears specific or all given collections.
 * @param {Array<Model>} models
 */
async function cleanupCollections(models = []) {
  for (const model of models) {
    if (model && model.deleteMany) {
      await model.deleteMany({});
    }
  }
}

module.exports = {
  createTestCollege,
  createTestUser,
  getAuthToken,
  cleanupCollections,
};
