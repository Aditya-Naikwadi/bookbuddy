process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testjwtrealtimesecretkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtrealtimerefreshsecretkey999';
jest.setTimeout(45000);

const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');
const User = require('../models/User');
const College = require('../models/College');
const { generateTokenPair } = require('../utils/token');

// Create test express app with routes
const collegeAdminRoutes = require('../routes/dashboards/collegeAdminRoutes');

const app = express();
app.use(express.json());
app.use('/api/v1/dashboards/college-admin', collegeAdminRoutes);

describe('Domain A - PatronsDesk Server-Side Pagination & Truncation Fix', () => {
  let collegeA;
  let collegeB;
  let adminA;
  let adminAToken;
  let adminB;
  let adminBToken;
  let target120thStudent;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test');
    }
    await User.syncIndexes();

    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Create 2 separate colleges
    collegeA = await College.create({
      name: 'Alpha University',
      code: `ALPH_${unique}`,
      domain: `alpha_${unique}.edu`,
      status: 'active',
    });

    collegeB = await College.create({
      name: 'Beta Institute',
      code: `BETA_${unique}`,
      domain: `beta_${unique}.edu`,
      status: 'active',
    });

    // Create college-admin for College A
    adminA = await User.create({
      studentId: `ADM_A_${unique}`,
      name: 'Admin Alpha',
      email: `admin_a_${unique}@alpha.edu`,
      password: 'HashedPassword123!',
      role: 'college-admin',
      collegeId: collegeA._id,
      isActive: true,
      status: 'active',
    });
    adminAToken = generateTokenPair(adminA).accessToken;

    // Create college-admin for College B
    adminB = await User.create({
      studentId: `ADM_B_${unique}`,
      name: 'Admin Beta',
      email: `admin_b_${unique}@beta.edu`,
      password: 'HashedPassword123!',
      role: 'college-admin',
      collegeId: collegeB._id,
      isActive: true,
      status: 'active',
    });
    adminBToken = generateTokenPair(adminB).accessToken;

    // Seed 150 students in College A
    const studentsToInsert = [];
    for (let i = 1; i <= 150; i++) {
      const isTarget = i === 120;
      studentsToInsert.push({
        studentId: isTarget ? `stu-target-120` : `stu-alpha-${unique}-${i}`,
        prn: isTarget ? `PRN-TARGET-120` : `PRN-ALPHA-${i}`,
        barcode: isTarget ? `BAR-TARGET-120` : `BAR-ALPHA-${i}`,
        name: isTarget ? 'Special Target Patron' : `Alpha Student ${i}`,
        email: isTarget ? `target120_${unique}@alpha.edu` : `student_a_${unique}_${i}@alpha.edu`,
        password: 'HashedPassword123!',
        role: 'student',
        collegeId: collegeA._id,
        department: i % 2 === 0 ? 'Computer Science' : 'Electrical Engineering',
        year: `${(i % 4) + 1}`,
        academicYear: `202${(i % 4) + 3}`,
        isActive: true,
        status: 'active',
      });
    }

    const createdStudents = await User.insertMany(studentsToInsert);
    target120thStudent = createdStudents.find((s) => s.studentId === 'stu-target-120');

    // Create 3 students in College B
    await User.insertMany([
      {
        studentId: `stu-beta-${unique}-1`,
        name: 'Beta Student 1',
        email: `student_b_${unique}_1@beta.edu`,
        password: 'HashedPassword123!',
        role: 'student',
        collegeId: collegeB._id,
        isActive: true,
        status: 'active',
      },
      {
        studentId: `stu-beta-${unique}-2`,
        name: 'Beta Student 2',
        email: `student_b_${unique}_2@beta.edu`,
        password: 'HashedPassword123!',
        role: 'student',
        collegeId: collegeB._id,
        isActive: true,
        status: 'active',
      },
    ]);
  });

  afterAll(async () => {
    if (collegeA?._id) {
      await User.deleteMany({ collegeId: collegeA._id });
      await College.deleteOne({ _id: collegeA._id });
    }
    if (collegeB?._id) {
      await User.deleteMany({ collegeId: collegeB._id });
      await College.deleteOne({ _id: collegeB._id });
    }
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  test('1. Searching for the 120th student out of 150 by name, PRN, and barcode returns them', async () => {
    // Search by Name substring
    const resName = await request(app)
      .get('/api/v1/dashboards/college-admin/patrons?search=Target')
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(resName.status).toBe(200);
    expect(resName.body.success).toBe(true);
    expect(resName.body.data.length).toBe(1);
    expect(resName.body.data[0].name).toBe('Special Target Patron');
    expect(resName.body.data[0]._id.toString()).toBe(target120thStudent._id.toString());

    // Search by PRN prefix
    const resPrn = await request(app)
      .get('/api/v1/dashboards/college-admin/patrons?search=PRN-TARGET')
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(resPrn.status).toBe(200);
    expect(resPrn.body.data.length).toBe(1);
    expect(resPrn.body.data[0].prn).toBe('PRN-TARGET-120');

    // Search by Barcode prefix
    const resBarcode = await request(app)
      .get('/api/v1/dashboards/college-admin/patrons?search=BAR-TARGET')
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(resBarcode.status).toBe(200);
    expect(resBarcode.body.data.length).toBe(1);
    expect(resBarcode.body.data[0].barcode).toBe('BAR-TARGET-120');
  });

  test('2. Page 2 and page 3 return different records, with correct meta.total and meta.totalPages', async () => {
    const resPage2 = await request(app)
      .get('/api/v1/dashboards/college-admin/patrons?page=2&limit=25')
      .set('Authorization', `Bearer ${adminAToken}`);

    const resPage3 = await request(app)
      .get('/api/v1/dashboards/college-admin/patrons?page=3&limit=25')
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(resPage2.status).toBe(200);
    expect(resPage3.status).toBe(200);

    expect(resPage2.body.data.length).toBe(25);
    expect(resPage3.body.data.length).toBe(25);

    expect(resPage2.body.meta.total).toBe(150);
    expect(resPage2.body.meta.totalPages).toBe(6);
    expect(resPage2.body.meta.page).toBe(2);
    expect(resPage3.body.meta.page).toBe(3);

    // Verify disjoint sets of records between page 2 and page 3
    const idsPage2 = new Set(resPage2.body.data.map((p) => p._id.toString()));
    const idsPage3 = new Set(resPage3.body.data.map((p) => p._id.toString()));

    for (const id of idsPage2) {
      expect(idsPage3.has(id)).toBe(false);
    }
  });

  test('3. Multi-tenant isolation: Admin B can never see College A patrons, even with crafted params', async () => {
    // Attempt with crafted query parameter collegeId=collegeA
    const resB = await request(app)
      .get(`/api/v1/dashboards/college-admin/patrons?collegeId=${collegeA._id}`)
      .set('Authorization', `Bearer ${adminBToken}`);

    expect(resB.status).toBe(200);
    expect(resB.body.meta.total).toBe(2); // Only College B's 2 students

    const returnedIds = resB.body.data.map((p) => p._id.toString());
    expect(returnedIds).not.toContain(target120thStudent._id.toString());
  });

  test('4. Special regex input like ".*" or "(" does not error and does not match everything', async () => {
    // Regex wildcard attempt
    const resWildcard = await request(app)
      .get('/api/v1/dashboards/college-admin/patrons?search=.*')
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(resWildcard.status).toBe(200);
    expect(resWildcard.body.data.length).toBe(0);

    // Unclosed parenthesis attempt
    const resParen = await request(app)
      .get('/api/v1/dashboards/college-admin/patrons?search=(')
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(resParen.status).toBe(200);
    expect(resParen.body.data.length).toBe(0);
  });

  test('5. Response contains no sensitive fields', async () => {
    const res = await request(app)
      .get('/api/v1/dashboards/college-admin/patrons?page=1&limit=10')
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);

    for (const patron of res.body.data) {
      expect(patron.password).toBeUndefined();
      expect(patron.cardSecret).toBeUndefined();
      expect(patron.mfaSecret).toBeUndefined();
      expect(patron.refreshTokenHash).toBeUndefined();
      expect(patron.activationTokenHash).toBeUndefined();
      expect(patron.invitationToken).toBeUndefined();
    }
  });

  test('6. Limit above 100 is clamped to 100', async () => {
    const resClamped = await request(app)
      .get('/api/v1/dashboards/college-admin/patrons?limit=500')
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(resClamped.status).toBe(200);
    expect(resClamped.body.meta.limit).toBe(100);
    expect(resClamped.body.data.length).toBe(100);
  });

  test('7. explain() confirms index usage (IXSCAN) on compound indexes', async () => {
    const hasStage = (plan, stageName) => {
      if (!plan) return false;
      if (plan.stage === stageName) return true;
      if (plan.inputStage && hasStage(plan.inputStage, stageName)) return true;
      if (Array.isArray(plan.inputStages)) {
        return plan.inputStages.some((s) => hasStage(s, stageName));
      }
      return false;
    };

    // Test 7A: Default listing query with sorting
    const listExplain = await User.find({
      collegeId: collegeA._id,
      role: 'student',
    })
      .sort({ createdAt: -1 })
      .explain('executionStats');

    const winningPlan = listExplain.queryPlanner.winningPlan;
    expect(hasStage(winningPlan, 'IXSCAN')).toBe(true);

    // Test 7B: Anchored prefix query on email using index
    const emailPrefixExplain = await User.find({
      collegeId: collegeA._id,
      email: 'target120@alpha.edu',
    }).explain('executionStats');

    expect(hasStage(emailPrefixExplain.queryPlanner.winningPlan, 'IXSCAN')).toBe(true);
  });
});
