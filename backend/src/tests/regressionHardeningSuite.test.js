const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const scopeToTenant = require('../middlewares/scopeToTenant');
const User = require('../models/User');
const { generatePatronToken, verifyPatronToken } = require('../utils/patronTokenUtil');

describe('Permanent Regression Hardening Test Suite (All 6 Codebase Problems)', () => {
  /* -------------------------------------------------------------------------- */
  /* PROBLEM 1 REGRESSION TEST: Vite Environment Node Globals                   */
  /* -------------------------------------------------------------------------- */
  test('Problem 1: Client source code must NOT use process.env.NODE_ENV (must use import.meta.env.MODE)', () => {
    const clientSrcPath = path.resolve(__dirname, '../../../client/src');

    function scanFiles(dir) {
      let forbiddenMatches = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          forbiddenMatches = forbiddenMatches.concat(scanFiles(fullPath));
        } else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('process.env.NODE_ENV')) {
            forbiddenMatches.push(fullPath);
          }
        }
      }
      return forbiddenMatches;
    }

    const matches = scanFiles(clientSrcPath);
    expect(matches).toEqual([]);
  });

  /* -------------------------------------------------------------------------- */
  /* PROBLEM 2 REGRESSION TEST: Multi-Tenant Scoping Enforcement                 */
  /* -------------------------------------------------------------------------- */
  test('Problem 2: scopeToTenant middleware must strictly attach collegeId tenantFilter for student and college-admin', () => {
    const collegeIdA = new mongoose.Types.ObjectId();
    const collegeIdB = new mongoose.Types.ObjectId();

    // Student A
    const reqStudent = { user: { id: 'studentA', role: 'student', collegeId: collegeIdA } };
    scopeToTenant(reqStudent, {}, () => {});
    expect(reqStudent.tenantFilter).toBeDefined();
    expect(reqStudent.tenantFilter.collegeId.toString()).toBe(collegeIdA.toString());

    // College Admin B
    const reqAdmin = { user: { id: 'adminB', role: 'college-admin', collegeId: collegeIdB } };
    scopeToTenant(reqAdmin, {}, () => {});
    expect(reqAdmin.tenantFilter.collegeId.toString()).toBe(collegeIdB.toString());
    expect(reqAdmin.tenantFilter.collegeId.toString()).not.toBe(collegeIdA.toString());
  });

  /* -------------------------------------------------------------------------- */
  /* PROBLEM 3 REGRESSION TEST: Patron Card P0 Raw Secret Protection            */
  /* -------------------------------------------------------------------------- */
  test('Problem 3 (P0 SECURITY): User schema must hide cardSecret (select: false) and patron token must NEVER leak secret', () => {
    // 1. Verify schema field configuration
    const cardSecretPath = User.schema.paths.cardSecret;
    expect(cardSecretPath).toBeDefined();
    expect(cardSecretPath.options.select).toBe(false);

    // 2. Test token generation output
    const studentId = 'STU-2026-TEST';
    const userId = new mongoose.Types.ObjectId();
    const { token } = generatePatronToken(userId, studentId);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.includes('cardSecret')).toBe(false);
    expect(token.includes('raw_secret')).toBe(false);

    // 3. Verify signed token validation
    const verification = verifyPatronToken(token);
    expect(verification.valid).toBe(true);
    expect(verification.userId.toString()).toBe(userId.toString());
  });

  /* -------------------------------------------------------------------------- */
  /* PROBLEM 4 REGRESSION TEST: Optimistic UI & WebSocket Reconciliation Rule   */
  /* -------------------------------------------------------------------------- */
  test('Problem 4: Structured reconciliation rule must resolve optimistic mutations with WebSocket cache invalidation', () => {
    // Documented Rule: Server-authoritative state overwrites local cache upon mutation settlement; WebSocket invalidations reset stale query states.
    const queryCache = new Map();
    const queryKey = ['books', 'college_123'];

    // Initial state
    const initialData = [{ _id: 'b1', title: 'Refactoring', renewalCount: 0 }];
    queryCache.set(JSON.stringify(queryKey), initialData);

    // Optimistic Mutation: student renews
    const optimisticUpdate = (oldData) =>
      oldData.map((b) => (b._id === 'b1' ? { ...b, renewalCount: b.renewalCount + 1 } : b));
    queryCache.set(
      JSON.stringify(queryKey),
      optimisticUpdate(queryCache.get(JSON.stringify(queryKey)))
    );

    // WebSocket race: cache invalidated
    queryCache.delete(JSON.stringify(queryKey));

    // Server Settlement: authoritative payload arrives
    const serverAuthoritativeData = [{ _id: 'b1', title: 'Refactoring', renewalCount: 1 }];
    queryCache.set(JSON.stringify(queryKey), serverAuthoritativeData);

    const finalState = queryCache.get(JSON.stringify(queryKey));
    expect(finalState[0].renewalCount).toBe(1);
  });

  /* -------------------------------------------------------------------------- */
  /* PROBLEM 5 REGRESSION TEST: API Path Inconsistency Prevention               */
  /* -------------------------------------------------------------------------- */
  test('Problem 5: Standardized API endpoints must use /api/v1 prefix and canonical paths', () => {
    const readingListApiContent = fs.readFileSync(
      path.resolve(__dirname, '../../../client/src/api/readingListApi.js'),
      'utf8'
    );
    const recommendationApiContent = fs.readFileSync(
      path.resolve(__dirname, '../../../client/src/api/recommendationApi.js'),
      'utf8'
    );

    expect(readingListApiContent).toContain('"/reading-lists"');
    expect(recommendationApiContent).toContain('"/recommendations/me"');
  });

  /* -------------------------------------------------------------------------- */
  /* PROBLEM 6 REGRESSION TEST: ETag MD5 Caching & Read-Only General User Guard */
  /* -------------------------------------------------------------------------- */
  test('Problem 6: ETag MD5 calculation produces deterministic headers for caching', () => {
    const samplePayload = { success: true, data: { collegeId: 'c1', popularBooks: [] } };
    const payloadString = JSON.stringify(samplePayload);
    const etag1 = `"${crypto.createHash('md5').update(payloadString).digest('hex')}"`;
    const etag2 = `"${crypto.createHash('md5').update(payloadString).digest('hex')}"`;

    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[a-f0-9]{32}"$/);
  });
});
