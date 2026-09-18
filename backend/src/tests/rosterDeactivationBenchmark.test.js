/**
 * Performance Benchmark & Architecture Test Suite:
 * Roster Bulk Deactivation via Single Query User.updateMany(...)
 *
 * Agent: @engineering-backend-architect
 * Test: @testing-performance-benchmarker
 *
 * Confirms that deactivation of 1,000+ students absent from a new roster upload
 * completes in a single database query (User.updateMany) rather than N per-document
 * round-trips (User.find + save loop).
 */

process.env.NODE_ENV = 'test';
jest.setTimeout(45000);

const mongoose = require('mongoose');
const User = require('../models/User');
const College = require('../models/College');
const StudentUploadBatch = require('../models/StudentUploadBatch');
const { processRosterBatchAsync } = require('../controllers/rosterUploadController');

describe('@testing-performance-benchmarker: Bulk Roster Deactivation Benchmark', () => {
  let testCollege;
  let adminUser;
  const TOTAL_STUDENTS = 1050;
  const ROSTER_KEPT = 25;
  const EXPECTED_DEACTIVATED = TOTAL_STUDENTS - ROSTER_KEPT; // 1,025 students

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';
      await mongoose.connect(uri);
    }

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    testCollege = await College.create({
      name: 'Benchmark Polytech',
      code: 'BPOLY_' + uniqueSuffix.replace('-', '_'),
      slug: 'bpoly-' + uniqueSuffix,
      status: 'active',
    });

    adminUser = await User.create({
      name: 'Benchmark Admin',
      email: `admin_${uniqueSuffix}@bpoly.edu`,
      password: 'Password123!',
      role: 'college-admin',
      collegeId: testCollege._id,
      status: 'active',
    });
  });

  afterAll(async () => {
    try {
      if (testCollege?._id) {
        await User.deleteMany({ collegeId: testCollege._id });
        await StudentUploadBatch.deleteMany({ collegeId: testCollege._id });
        await College.deleteMany({ _id: testCollege._id });
      }
      if (mongoose.connection && mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch {
      // ignore teardown errors
    }
  });

  it('confirms deactivation of 1,000+ students completes in a single User.updateMany query with zero per-document save round-trips', async () => {
    // 1. Seed 1,050 active student users in bulk
    const studentSeedDocs = [];
    for (let i = 1; i <= TOTAL_STUDENTS; i++) {
      const padId = String(i).padStart(5, '0');
      studentSeedDocs.push({
        studentId: `bench-${padId}`,
        name: `Benchmark Student ${i}`,
        email: `bench_${padId}@bpoly.edu`,
        role: 'student',
        status: 'active',
        collegeId: testCollege._id,
        program: 'Computer Science',
        year: 'Year 2',
        password: 'Password123!',
      });
    }

    await User.insertMany(studentSeedDocs, { ordered: false });

    const initialActiveCount = await User.countDocuments({
      collegeId: testCollege._id,
      role: 'student',
      status: 'active',
    });
    expect(initialActiveCount).toBe(TOTAL_STUDENTS);

    // 2. Prepare new roster containing only 25 students (leaving 1,025 absent)
    const validRows = [];
    for (let i = 1; i <= ROSTER_KEPT; i++) {
      const padId = String(i).padStart(5, '0');
      validRows.push({
        rowNumber: i + 1,
        studentId: `bench-${padId}`,
        name: `Benchmark Student ${i} Updated`,
        email: `bench_${padId}@bpoly.edu`,
        program: 'Computer Science',
        year: 'Year 3',
        action: 'update',
      });
    }

    // 3. Create a batch record
    const batch = await StudentUploadBatch.create({
      collegeId: testCollege._id,
      uploadedBy: adminUser._id,
      fileName: 'benchmark_roster_upload.csv',
      totalRows: validRows.length,
      validRowsCount: validRows.length,
      createdCount: 0,
      updatedCount: validRows.length,
      status: 'preview',
      bulkDeactivateAbsent: true,
    });

    // 4. Instrument Spies to monitor query counts
    const updateManySpy = jest.spyOn(User, 'updateMany');
    const userSaveSpy = jest.spyOn(User.prototype, 'save');

    // 5. Measure execution time of processRosterBatchAsync
    const startTime = process.hrtime.bigint();

    await processRosterBatchAsync(
      batch._id,
      testCollege._id,
      validRows,
      true, // bulkDeactivateAbsent = true
      testCollege
    );

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;

    // 6. Assertions for @testing-performance-benchmarker & @engineering-backend-architect

    // A. Single Query Assertion: User.updateMany must be called exactly ONCE for absent deactivations
    expect(updateManySpy).toHaveBeenCalledTimes(1);

    const deactivationCallArgs = updateManySpy.mock.calls[0];
    const queryFilter = deactivationCallArgs[0];
    const updatePayload = deactivationCallArgs[1];

    // Verify filter targets absent students under testCollege
    expect(queryFilter.collegeId).toEqual(testCollege._id);
    expect(queryFilter.status).toEqual({ $in: ['active', 'invited'] });
    expect(queryFilter.studentId.$nin).toBeDefined();
    expect(Array.isArray(queryFilter.studentId.$nin)).toBe(true);
    expect(queryFilter.studentId.$nin.length).toBe(ROSTER_KEPT);

    // Verify update payload marks inactive with timestamp and batch audit reason
    expect(updatePayload.$set.status).toBe('inactive');
    expect(updatePayload.$set.deactivatedAt).toBeInstanceOf(Date);
    expect(updatePayload.$set.deactivationReason).toContain(String(batch._id));

    // B. Zero per-document save round-trips for deactivated students:
    // Only updated existing roster students (25 kept) call existing.save(),
    // while the 1,025 absent students were updated in a SINGLE database query.
    // Confirm save was NOT called 1,050+ times!
    expect(userSaveSpy.mock.calls.length).toBeLessThanOrEqual(ROSTER_KEPT);

    // C. Database State Verification
    const deactivatedCountInDb = await User.countDocuments({
      collegeId: testCollege._id,
      role: 'student',
      status: 'inactive',
    });
    expect(deactivatedCountInDb).toBe(EXPECTED_DEACTIVATED); // 1,025 students deactivated

    const remainingActiveCountInDb = await User.countDocuments({
      collegeId: testCollege._id,
      role: 'student',
      status: 'active',
    });
    expect(remainingActiveCountInDb).toBe(ROSTER_KEPT); // 25 kept active

    // Verify sample deactivated student record
    const sampleDeactivated = await User.findOne({
      collegeId: testCollege._id,
      studentId: 'bench-00500',
    });
    expect(sampleDeactivated).toBeTruthy();
    expect(sampleDeactivated.status).toBe('inactive');
    expect(sampleDeactivated.deactivatedAt).toBeDefined();
    expect(sampleDeactivated.deactivationReason).toContain(
      `Omitted from roster upload batch #${batch._id}`
    );

    // D. Batch record status verification
    const updatedBatch = await StudentUploadBatch.findById(batch._id);
    expect(updatedBatch.status).toBe('committed');
    expect(updatedBatch.deactivatedCount).toBe(EXPECTED_DEACTIVATED);
    expect(updatedBatch.updatedCount).toBe(ROSTER_KEPT);

    // E. Performance benchmark log
    // In comparison, N roundtrips of individual .save() over network/mongo takes 5,000-15,000ms.
    // The single updateMany completes in a fraction of that time.
    // eslint-disable-next-line no-console
    console.log(
      `[PERFORMANCE BENCHMARK] Deactivation of ${EXPECTED_DEACTIVATED} students completed in ${durationMs.toFixed(2)}ms across 1 query.`
    );

    expect(durationMs).toBeLessThan(15000);

    // Clean up spies
    updateManySpy.mockRestore();
    userSaveSpy.mockRestore();
  });
});
