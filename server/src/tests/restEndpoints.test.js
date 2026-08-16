const request = require('supertest');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_rest_endpoints_test';
process.env.JWT_SECRET = 'testjwtsecretrestkey999';
process.env.JWT_REFRESH_SECRET = 'testjwtrefreshsecretrestkey999';
process.env.JWT_ACCESS_EXPIRY = '10m';
process.env.JWT_REFRESH_EXPIRY = '7d';
jest.setTimeout(30000);

const app = require('../app');
const User = require('../models/User');
const College = require('../models/College');
const Book = require('../models/Book');
const EResource = require('../models/EResource');
const ReadingList = require('../models/ReadingList');
const SavedSearch = require('../models/SavedSearch');
const BookSuggestion = require('../models/BookSuggestion');
const Reservation = require('../models/Reservation');
const LabSeat = require('../models/LabSeat');
const LabBooking = require('../models/LabBooking');
const { generateTokenPair } = require('../utils/token');

describe('Direct REST Endpoints Integration Tests', () => {
  let collegeA;
  let studentA;
  let tokenStudentA;
  let bookA;
  let eresourceA;
  let seatA;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    await College.deleteMany({});
    await User.deleteMany({});
    await Book.deleteMany({});
    await EResource.deleteMany({});
    await ReadingList.deleteMany({});
    await SavedSearch.deleteMany({});
    await BookSuggestion.deleteMany({});
    await Reservation.deleteMany({});
    await LabSeat.deleteMany({});
    await LabBooking.deleteMany({});

    collegeA = await College.create({
      name: 'REST Test College A',
      code: 'RTCA',
      selectedServices: ['facilities_booking', 'catalog_management'],
      enabledFeatures: ['facilities_booking', 'catalog_management'],
    });

    // Seed Student
    studentA = await User.create({
      studentId: 'STU_REST_001',
      name: 'REST Student',
      email: 'student.rest@test.com',
      password: 'password123',
      role: 'student',
      collegeId: collegeA._id,
    });

    tokenStudentA = generateTokenPair(studentA).accessToken;

    // Seed Book
    bookA = await Book.create({
      collegeId: collegeA._id,
      title: 'REST Test Book',
      author: 'REST Author',
      isbn: '1234567890123',
      category: 'Science',
      copiesAvailable: 0, // checked out for queue test
      totalCopies: 1,
    });

    // Seed E-Resource
    eresourceA = await EResource.create({
      collegeId: collegeA._id,
      title: 'REST Test EResource',
      author: 'REST EResource Author',
      type: 'pdf',
      fileUrl: 'https://test.com/file.pdf',
      category: 'Science',
      moderationStatus: 'approved',
      uploadedBy: studentA._id,
    });

    // Seed Lab Seat
    seatA = await LabSeat.create({
      collegeId: collegeA._id,
      labName: 'REST Lab 1',
      seatNumber: 'Seat-A1',
      specs: 'i7 CPU, 16GB RAM',
      maintenanceStatus: 'operational',
    });
  });

  afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  });

  describe('Saved Searches API', () => {
    it('should create and retrieve a saved search', async () => {
      const createRes = await request(app)
        .post('/api/v1/saved-searches')
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .send({
          queryParams: {
            category: 'Science',
            keyword: 'physics',
          },
          alertsEnabled: true,
        });

      expect(createRes.status).toBe(200);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.queryParams.category).toBe('Science');
      expect(createRes.body.data.collegeId.toString()).toBe(collegeA._id.toString());

      const getRes = await request(app)
        .get('/api/v1/saved-searches/me')
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.length).toBe(1);
    });
  });

  describe('Book Suggestions API', () => {
    it('should submit a book suggestion', async () => {
      const suggestRes = await request(app)
        .post('/api/v1/book-suggestions')
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .send({
          title: 'Future of AI',
          author: 'John Doe',
          reason: 'Excellent reference on neural nets.',
        });

      expect(suggestRes.status).toBe(201);
      expect(suggestRes.body.success).toBe(true);
      expect(suggestRes.body.data.title).toBe('Future of AI');
      expect(suggestRes.body.data.suggestedBy.toString()).toBe(studentA._id.toString());
      expect(suggestRes.body.data.collegeId.toString()).toBe(collegeA._id.toString());

      const listRes = await request(app)
        .get('/api/v1/book-suggestions')
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.length).toBe(1);
    });
  });

  describe('Reading Lists API', () => {
    it('should create, update, and retrieve reading lists', async () => {
      const createRes = await request(app)
        .post('/api/v1/reading-lists')
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .send({
          title: 'My Custom Reading List',
          description: 'A collection of books.',
          visibility: 'private',
        });

      expect(createRes.status).toBe(200);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.title).toBe('My Custom Reading List');
      expect(createRes.body.data.ownerId.toString()).toBe(studentA._id.toString());
      expect(createRes.body.data.collegeId.toString()).toBe(collegeA._id.toString());

      const listId = createRes.body.data._id;

      const getRes = await request(app)
        .get(`/api/v1/reading-lists/${listId}`)
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.title).toBe('My Custom Reading List');

      const updateRes = await request(app)
        .patch(`/api/v1/reading-lists/${listId}`)
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .send({
          title: 'Updated Reading List Name',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Updated Reading List Name');
    });
  });

  describe('Reservations API', () => {
    it('should join and leave reservation queue', async () => {
      const joinRes = await request(app)
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .send({
          bookId: bookA._id,
        });

      expect(joinRes.status).toBe(200);
      expect(joinRes.body.success).toBe(true);
      expect(joinRes.body.data.status).toBe('queued');
      expect(joinRes.body.data.userId.toString()).toBe(studentA._id.toString());
      expect(joinRes.body.data.collegeId.toString()).toBe(collegeA._id.toString());

      const reservationId = joinRes.body.data._id || joinRes.body.data.id;

      const leaveRes = await request(app)
        .delete(`/api/v1/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${tokenStudentA}`);

      expect(leaveRes.status).toBe(200);
      expect(leaveRes.body.success).toBe(true);
      expect(leaveRes.body.data.status).toBe('cancelled');
    });
  });

  describe('E-Resource Progress API', () => {
    it('should submit reading progress using route params and schema', async () => {
      const progressRes = await request(app)
        .post(`/api/v1/eresources/${eresourceA._id}/progress`)
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .send({
          dailySecondsToday: 240,
        });

      expect(progressRes.status).toBe(200);
      expect(progressRes.body.success).toBe(true);
      expect(progressRes.body.message).toBe('Progress updated');
    });
  });

  describe('Lab Booking API', () => {
    it('should successfully book a seat slot', async () => {
      const now = new Date();
      const startTime = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 0, 0, 0)
      );
      const endTime = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 11, 0, 0, 0)
      );

      const bookRes = await request(app)
        .post('/api/v1/lab/bookings')
        .set('Authorization', `Bearer ${tokenStudentA}`)
        .send({
          seatId: seatA._id,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });

      expect(bookRes.status).toBe(201);
      expect(bookRes.body.success).toBe(true);
      expect(bookRes.body.data.status).toBe('booked');
      expect(bookRes.body.data.collegeId.toString()).toBe(collegeA._id.toString());
    });
  });
});
