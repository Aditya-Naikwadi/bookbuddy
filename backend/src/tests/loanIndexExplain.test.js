const mongoose = require('mongoose');
const env = require('../config/env');
const Loan = require('../models/Loan');
const College = require('../models/College');
const Book = require('../models/Book');
const User = require('../models/User');

jest.setTimeout(30000);

describe('Loan Index Verification with explain()', () => {
  let collegeId;
  let bookId;
  let userId;
  let adminId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGO_URI);
    }
    // Ensure all indexes on Loan are synced in MongoDB
    await Loan.syncIndexes();

    const college = await College.create({
      name: 'Index Test College',
      code: `ITC_${Date.now()}`,
    });
    collegeId = college._id;

    const admin = await User.create({
      collegeId,
      studentId: `ADM_${Date.now()}`,
      name: 'Admin User',
      email: `admin_${Date.now()}@test.edu`,
      role: 'college-admin',
      password: 'HashedPassword123!',
      status: 'active',
    });
    adminId = admin._id;

    const user = await User.create({
      collegeId,
      studentId: `STU_${Date.now()}`,
      name: 'Test Student',
      email: `student_${Date.now()}@test.edu`,
      role: 'student',
      password: 'HashedPassword123!',
      status: 'active',
    });
    userId = user._id;

    const book = await Book.create({
      collegeId,
      title: 'Algorithms and Data Structures',
      author: 'Test Author',
      isbn: `978-${Date.now().toString().slice(-10)}`,
      category: 'Computer Science',
      copiesTotal: 5,
      copiesAvailable: 4,
    });
    bookId = book._id;

    // Seed 3 historical loans for this book
    const loans = [];
    for (let i = 0; i < 3; i++) {
      loans.push({
        collegeId,
        userId,
        bookId,
        issuedBy: adminId,
        issueDate: new Date(Date.now() - (i + 1) * 86400000),
        dueDate: new Date(Date.now() + (14 - i) * 86400000),
        renewalCount: 0,
        maxRenewals: 2,
        status: i === 0 ? 'active' : 'returned',
      });
    }
    await Loan.insertMany(loans);
  });

  afterAll(async () => {
    await Loan.deleteMany({ collegeId });
    await Book.deleteMany({ collegeId });
    await User.deleteMany({ collegeId });
    await College.deleteMany({ _id: collegeId });
  });

  it('uses the compound index collegeId_1_bookId_1_createdAt_-1 for { collegeId, bookId, createdAt: -1 }', async () => {
    const explainResult = await Loan.find({ collegeId, bookId })
      .sort({ createdAt: -1 })
      .explain('executionStats');

    expect(explainResult).toBeDefined();

    // Helper to traverse stages
    const findStages = (stage, name) => {
      const matches = [];
      if (!stage) return matches;
      if (stage.stage === name) matches.push(stage);
      if (stage.inputStage) matches.push(...findStages(stage.inputStage, name));
      if (Array.isArray(stage.inputStages)) {
        for (const sub of stage.inputStages) {
          matches.push(...findStages(sub, name));
        }
      }
      return matches;
    };

    const rootStage = explainResult.executionStats?.executionStages;
    expect(rootStage).toBeDefined();

    // Assert zero COLLSCAN
    const collscans = findStages(rootStage, 'COLLSCAN');
    expect(collscans.length).toBe(0);

    // Assert IXSCAN was used
    const ixscans = findStages(rootStage, 'IXSCAN');
    expect(ixscans.length).toBeGreaterThan(0);

    // Assert the specific compound index was selected by query optimizer
    const usedIndex = ixscans[0].indexName;
    expect(usedIndex).toBe('collegeId_1_bookId_1_createdAt_-1');

    // Assert no in-memory SORT stage (index provides sort order)
    const inMemorySorts = findStages(rootStage, 'SORT');
    expect(inMemorySorts.length).toBe(0);

    // Assert execution stats efficiency
    const { nReturned, totalDocsExamined, totalKeysExamined } = explainResult.executionStats;
    expect(nReturned).toBe(3);
    expect(totalDocsExamined).toBe(3);
    expect(totalKeysExamined).toBe(3);
  });
});
