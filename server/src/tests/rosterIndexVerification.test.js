const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/bookbuddy_test';

jest.setTimeout(30000);

const User = require('../models/User');

function getPlanStages(plan) {
  let current = plan;
  const stages = [];
  while (current) {
    if (current.stage) stages.push(current.stage);
    current = current.inputStage || (current.inputStages && current.inputStages[0]);
  }
  return stages;
}

describe('F15 Index Verification — Scoped Login & Activation Queries', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    // Ensure all schema indexes are synchronized in test DB
    await User.syncIndexes();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it('confirms { collegeId: 1, studentId: 1 } uses IXSCAN (Index Scan) on student login query path', async () => {
    const mockCollegeId = new mongoose.Types.ObjectId();
    const explanation = await User.findOne({
      collegeId: mockCollegeId,
      studentId: 'STU-1001',
    }).explain('executionStats');

    const winningStage = explanation.queryPlanner.winningPlan;
    const stages = getPlanStages(winningStage);

    expect(stages).toContain('IXSCAN');
  });

  it('confirms { collegeId: 1, email: 1 } uses IXSCAN (Index Scan) on email login query path', async () => {
    const mockCollegeId = new mongoose.Types.ObjectId();
    const explanation = await User.findOne({
      collegeId: mockCollegeId,
      email: 'student@springfield.edu',
    }).explain('executionStats');

    const winningStage = explanation.queryPlanner.winningPlan;
    const stages = getPlanStages(winningStage);

    expect(stages).toContain('IXSCAN');
  });

  it('confirms { activationTokenHash: 1 } uses IXSCAN (Index Scan) on activation token verification path', async () => {
    const explanation = await User.findOne({
      activationTokenHash: 'dummy_sha256_hash_value',
    }).explain('executionStats');

    const winningStage = explanation.queryPlanner.winningPlan;
    const stages = getPlanStages(winningStage);

    expect(stages).toContain('IXSCAN');
  });

  it('confirms { collegeId: 1, status: 1 } uses IXSCAN (Index Scan) on admin roster view path', async () => {
    const mockCollegeId = new mongoose.Types.ObjectId();
    const explanation = await User.find({
      collegeId: mockCollegeId,
      status: 'active',
    }).explain('executionStats');

    const winningStage = explanation.queryPlanner.winningPlan;
    const stages = getPlanStages(winningStage);

    expect(stages).toContain('IXSCAN');
  });
});
