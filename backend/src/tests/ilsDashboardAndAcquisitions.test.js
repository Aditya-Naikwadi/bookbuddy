const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_ils_test';
process.env.JWT_SECRET = 'testjwtlibrarysecretkey999';

jest.setTimeout(30000);

const app = require('../app');
const College = require('../models/College');
const User = require('../models/User');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Reservation = require('../models/Reservation');
const AcquisitionOrder = require('../models/AcquisitionOrder');
const { generateTokenPair } = require('../utils/token');

describe('ILS Dashboard & Acquisitions Module Integration Tests', () => {
  let college;
  let adminUser;
  let adminToken;
  let studentUser;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Clean up collections
    await Promise.all([
      College.deleteMany({ code: 'ILS_TEST_COL' }),
      User.deleteMany({ email: /@ilstest\.edu/ }),
      AcquisitionOrder.deleteMany({}),
    ]);

    college = await College.create({
      name: 'ILS Test College',
      code: 'ILS_TEST_COL',
      status: 'active',
    });

    adminUser = await User.create({
      name: 'Head Librarian',
      email: 'librarian@ilstest.edu',
      studentId: 'STAFF_LIB_01',
      password: 'Password123!',
      role: 'college-admin',
      collegeId: college._id,
      isActive: true,
      permissions: [
        'canManageAcquisitions',
        'canViewAnalytics',
        'canManagePatrons',
        'canManageCirculation',
        'canManageCatalog',
      ],
    });

    const tokens = generateTokenPair(adminUser);
    adminToken = tokens.accessToken;

    studentUser = await User.create({
      name: 'ILS Student',
      email: 'student@ilstest.edu',
      password: 'Password123!',
      role: 'student',
      studentId: 'ILS_STU_01',
      collegeId: college._id,
      isActive: true,
    });

    // Seed a sample book and loan
    const testBook = await Book.create({
      title: 'Database Systems Implementation',
      author: 'Hector Garcia-Molina',
      isbn: '9780130319951',
      category: 'Computer Science',
      shelfLocation: 'Stacks A-12',
      copies: 5,
      copiesAvailable: 1, // Low stock <= 2
      collegeId: college._id,
    });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await Loan.create({
      collegeId: college._id,
      userId: studentUser._id,
      bookId: testBook._id,
      status: 'active',
      issuedBy: adminUser._id,
      maxRenewals: 2,
      borrowDate: new Date(Date.now() - 15 * 86400000),
      dueDate: yesterday, // Overdue
    });

    await Reservation.create({
      collegeId: college._id,
      userId: studentUser._id,
      bookId: testBook._id,
      status: 'queued',
      queuePosition: 1,
    });
  });

  afterAll(async () => {
    await Promise.all([
      College.deleteMany({ code: 'ILS_TEST_COL' }),
      User.deleteMany({ email: /@ilstest\.edu/ }),
      AcquisitionOrder.deleteMany({}),
      Book.deleteMany({ collegeId: college._id }),
      Loan.deleteMany({ collegeId: college._id }),
      Reservation.deleteMany({ collegeId: college._id }),
    ]);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  describe('1. Acquisitions & Serials Endpoints', () => {
    let createdOrderId;

    it('POST /api/v1/acquisitions - should create a new purchase order with multi-item array', async () => {
      const res = await request(app)
        .post('/api/v1/acquisitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorName: 'Pearson Academic Press',
          budgetCode: 'CS-DEPT-2026',
          priority: 'high',
          status: 'submitted',
          items: [
            {
              title: 'Operating Systems: Three Easy Pieces',
              author: 'Remzi Arpaci-Dusseau',
              isbn: '9781985086593',
              quantity: 10,
              unitPrice: 45.0,
            },
            {
              title: 'Computer Networking: A Top-Down Approach',
              author: 'James Kurose',
              isbn: '9780133594140',
              quantity: 5,
              unitPrice: 80.0,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendorName).toBe('Pearson Academic Press');
      expect(res.body.data.totalAmount).toBe(850.0); // (10*45) + (5*80) = 450 + 400 = 850
      expect(res.body.data.status).toBe('submitted');
      createdOrderId = res.body.data._id;
    });

    it('GET /api/v1/acquisitions - should list acquisition orders scoped to tenant college', async () => {
      const res = await request(app)
        .get('/api/v1/acquisitions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].vendorName).toBe('Pearson Academic Press');
    });

    it('GET /api/v1/acquisitions/stats - should aggregate totalSpent and order counts', async () => {
      const res = await request(app)
        .get('/api/v1/acquisitions/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalOrders).toBeGreaterThanOrEqual(1);
      expect(res.body.data.byStatus.submitted).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/acquisitions/:id/status - should transition order status to approved', async () => {
      const res = await request(app)
        .patch(`/api/v1/acquisitions/${createdOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('approved');
      expect(res.body.data.approvedBy).toBeDefined();
    });
  });

  describe('2. Staff Dashboard Widgets & Reports Endpoints', () => {
    it('GET /api/v1/dashboards/college-admin/staff-widgets - should return overdue, holds, low stock, and today activity', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/college-admin/staff-widgets')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('overdue');
      expect(res.body.data).toHaveProperty('holds');
      expect(res.body.data).toHaveProperty('lowStock');
      expect(res.body.data).toHaveProperty('todayActivity');

      expect(res.body.data.overdue.count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.holds.count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.lowStock.count).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/dashboards/college-admin/reports/circulation - should generate circulation report records', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/college-admin/reports/circulation')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('circulation');
      expect(res.body.data.summary).toBeDefined();
      expect(Array.isArray(res.body.data.records)).toBe(true);
    });

    it('GET /api/v1/dashboards/college-admin/reports/inventory - should generate physical inventory report', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/college-admin/reports/inventory')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('inventory');
      expect(res.body.data.summary.uniqueTitles).toBeGreaterThanOrEqual(1);
    });
  });
});
