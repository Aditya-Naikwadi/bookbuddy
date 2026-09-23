/**
 * Unit Tests for atomicConditionalUpdate Utility
 *
 * Verifies:
 * 1. Single successful conditional update.
 * 2. Precondition failure (no match).
 * 3. Existence check on failure (NOT_FOUND vs CONDITION_FAILED).
 * 4. High-concurrency stress test: 25 simultaneous atomic updates against a capacity limit of 5.
 *    Guarantees exactly 5 succeed, 20 cleanly rejected, zero overshoot.
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(30000);

const mongoose = require('mongoose');
const { atomicConditionalUpdate } = require('../utils/atomicUpdateHelper');

const capacityTestSchema = new mongoose.Schema({
  name: { type: String, required: true },
  count: { type: Number, default: 0 },
  maxLimit: { type: Number, required: true },
});

const CapacityTestDoc =
  mongoose.models.CapacityTestDoc ||
  mongoose.model('CapacityTestDoc', capacityTestSchema);

describe('atomicConditionalUpdate Unit Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }
  });

  afterAll(async () => {
    try {
      await CapacityTestDoc.deleteMany({});
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore
    }
  });

  beforeEach(async () => {
    await CapacityTestDoc.deleteMany({});
  });

  it('1. Successfully updates when $expr condition is satisfied', async () => {
    const doc = await CapacityTestDoc.create({
      name: 'Event Alpha',
      count: 2,
      maxLimit: 5,
    });

    const result = await atomicConditionalUpdate(
      CapacityTestDoc,
      { _id: doc._id },
      { $lt: ['$count', '$maxLimit'] },
      { $inc: { count: 1 } }
    );

    expect(result.matched).toBe(true);
    expect(result.success).toBe(true);
    expect(result.doc.count).toBe(3);

    const reloaded = await CapacityTestDoc.findById(doc._id);
    expect(reloaded.count).toBe(3);
  });

  it('2. Returns matched: false when condition is not satisfied', async () => {
    const doc = await CapacityTestDoc.create({
      name: 'Event Beta',
      count: 5,
      maxLimit: 5,
    });

    const result = await atomicConditionalUpdate(
      CapacityTestDoc,
      { _id: doc._id },
      { $lt: ['$count', '$maxLimit'] },
      { $inc: { count: 1 } }
    );

    expect(result.matched).toBe(false);
    expect(result.success).toBe(false);
    expect(result.doc).toBeNull();

    const reloaded = await CapacityTestDoc.findById(doc._id);
    expect(reloaded.count).toBe(5); // unchanged
  });

  it('3. Distinguishes NOT_FOUND from CONDITION_FAILED when checkExistenceOnFailure is enabled', async () => {
    const doc = await CapacityTestDoc.create({
      name: 'Event Gamma',
      count: 10,
      maxLimit: 10,
    });

    // Condition fails on existing document
    const condFailedResult = await atomicConditionalUpdate(
      CapacityTestDoc,
      { _id: doc._id },
      { $lt: ['$count', '$maxLimit'] },
      { $inc: { count: 1 } },
      { checkExistenceOnFailure: true }
    );

    expect(condFailedResult.matched).toBe(false);
    expect(condFailedResult.reason).toBe('CONDITION_FAILED');

    // Document does not exist
    const nonExistentId = new mongoose.Types.ObjectId();
    const notFoundResult = await atomicConditionalUpdate(
      CapacityTestDoc,
      { _id: nonExistentId },
      { $lt: ['$count', '$maxLimit'] },
      { $inc: { count: 1 } },
      { checkExistenceOnFailure: true }
    );

    expect(notFoundResult.matched).toBe(false);
    expect(notFoundResult.reason).toBe('NOT_FOUND');
  });

  it('4. Concurrent updates: exactly N succeed, remainder rejected with zero overshoot', async () => {
    const maxLimit = 5;
    const doc = await CapacityTestDoc.create({
      name: 'Constrained Resource',
      count: 0,
      maxLimit,
    });

    const totalRequests = 25;
    const promises = Array.from({ length: totalRequests }).map(() =>
      atomicConditionalUpdate(
        CapacityTestDoc,
        { _id: doc._id },
        { $lt: ['$count', '$maxLimit'] },
        { $inc: { count: 1 } }
      )
    );

    const results = await Promise.all(promises);

    const succeeded = results.filter((r) => r.matched);
    const rejected = results.filter((r) => !r.matched);

    expect(succeeded.length).toBe(maxLimit);
    expect(rejected.length).toBe(totalRequests - maxLimit);

    const reloaded = await CapacityTestDoc.findById(doc._id);
    expect(reloaded.count).toBe(maxLimit); // Indivisible ceiling guarantee
  });
});
