#!/usr/bin/env node
/**
 * ==============================================================================
 * CI GATE: Index-Usage & COLLSCAN Verification (Mongoose / MongoDB)
 * ==============================================================================
 * Validates that all critical & expensive query paths (catalog search,
 * audit log filtering, patron directory search, loan/fine oversight, e-resources)
 * utilize index scans (IXSCAN) and do NOT devolve into full collection scans (COLLSCAN)
 * or examine excessive documents (totalDocsExamined > 3 * nReturned).
 *
 * Runs against a realistically-seeded multi-tenant dataset (~900 docs across 3 colleges).
 * ==============================================================================
 */

const path = require('path');

// Ensure correct environment
process.env.NODE_ENV = 'test';

// Resolve mongoose instance from backend workspace to match models' singleton
const mongoose = require(require.resolve('mongoose', { paths: [path.join(__dirname, '../../backend')] }));

const College = require('../../backend/src/models/College');
const Book = require('../../backend/src/models/Book');
const User = require('../../backend/src/models/User');
const Loan = require('../../backend/src/models/Loan');
const Fine = require('../../backend/src/models/Fine');
const AuditLog = require('../../backend/src/models/AuditLog');
const EResource = require('../../backend/src/models/EResource');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bookbuddy_test';

// Recursive helper to inspect execution stages for COLLSCAN
function findStages(stage, stageName) {
  const matches = [];
  if (!stage) return matches;
  if (stage.stage === stageName) {
    matches.push(stage);
  }
  if (stage.inputStage) {
    matches.push(...findStages(stage.inputStage, stageName));
  }
  if (stage.inputStages && Array.isArray(stage.inputStages)) {
    for (const sub of stage.inputStages) {
      matches.push(...findStages(sub, stageName));
    }
  }
  return matches;
}

function extractStageSummary(executionStats) {
  const root = executionStats?.executionStages;
  if (!root) return 'UNKNOWN';
  const collscans = findStages(root, 'COLLSCAN');
  if (collscans.length > 0) return 'COLLSCAN';
  const ixscans = findStages(root, 'IXSCAN');
  if (ixscans.length > 0) return 'IXSCAN';
  return root.stage || 'OPTIMIZED';
}

async function runIndexAudit(options = {}) {
  const shouldSimulateFailure = options.simulateFailure || process.argv.includes('--simulate-fail');

  console.log('='.repeat(80));
  console.log('⚡ RUNNING DATABASE INDEX-USAGE & COLLSCAN CI GATE');
  console.log('='.repeat(80));
  console.log(`Connecting to MongoDB at: ${MONGO_URI.replace(/\/\/.*@/, '//***:***@')}...`);

  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected to MongoDB.\n');

  const testRunId = `idx_gate_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  console.log(`Seeding realistic multi-tenant dataset (Run ID: ${testRunId})...`);

  // Ensure all schema indexes are synced in MongoDB
  await Promise.all([
    College.syncIndexes(),
    Book.syncIndexes(),
    User.syncIndexes(),
    Loan.syncIndexes(),
    Fine.syncIndexes(),
    AuditLog.syncIndexes(),
    EResource.syncIndexes(),
  ]);

  // Seed 3 Colleges
  const colleges = await College.insertMany([
    { name: `Campus Alpha ${testRunId}`, code: `ALP_${testRunId.slice(-6)}` },
    { name: `Campus Beta ${testRunId}`, code: `BET_${testRunId.slice(-6)}` },
    { name: `Campus Gamma ${testRunId}`, code: `GAM_${testRunId.slice(-6)}` },
  ]);

  const [colA, colB, colC] = colleges;
  const targetCollegeId = colA._id;

  // Seed Users (~150 docs across 3 colleges)
  const usersToInsert = [];
  const roles = ['student', 'faculty', 'librarian'];
  const depts = ['Computer Science', 'Electrical', 'Mechanical', 'BioTech'];
  const statuses = ['active', 'inactive', 'disabled'];

  for (let i = 0; i < 150; i++) {
    const col = i % 3 === 0 ? colA : i % 3 === 1 ? colB : colC;
    usersToInsert.push({
      collegeId: col._id,
      name: `User ${testRunId} #${i}`,
      email: `user_${testRunId}_${i}@testcollege.edu`,
      studentId: `stu-${testRunId.slice(-4)}-${String(i).padStart(4, '0')}`,
      role: roles[i % roles.length],
      department: depts[i % depts.length],
      status: statuses[i % statuses.length],
      password: 'HashedPassword123!',
      cardSecret: 'card_secret_sample',
    });
  }
  const seededUsers = await User.insertMany(usersToInsert);

  // Seed Books (~240 docs across 3 colleges)
  const booksToInsert = [];
  const categories = ['Engineering', 'Mathematics', 'Literature', 'History', 'Physics'];
  for (let i = 0; i < 240; i++) {
    const col = i % 3 === 0 ? colA : i % 3 === 1 ? colB : colC;
    booksToInsert.push({
      collegeId: col._id,
      title: `Book Title ${testRunId} Vol ${i}`,
      author: `Author ${i % 15}`,
      isbn: `978-${String(i).padStart(10, '0')}`,
      category: categories[i % categories.length],
      copiesTotal: 10,
      copiesAvailable: i % 7 === 0 ? 0 : 5,
      language: 'English',
    });
  }
  const seededBooks = await Book.insertMany(booksToInsert);

  // Seed Loans (~150 docs)
  const loansToInsert = [];
  const loanStatuses = ['active', 'returned', 'overdue'];
  for (let i = 0; i < 150; i++) {
    const col = i % 3 === 0 ? colA : i % 3 === 1 ? colB : colC;
    const user = seededUsers[i % seededUsers.length];
    const book = seededBooks[i % seededBooks.length];
    loansToInsert.push({
      collegeId: col._id,
      userId: user._id,
      bookId: book._id,
      issuedBy: seededUsers[0]._id,
      issueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * (i + 1)),
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * (i % 2 === 0 ? -5 : 5)),
      status: loanStatuses[i % loanStatuses.length],
      maxRenewals: 3,
    });
  }
  const seededLoans = await Loan.insertMany(loansToInsert);

  // Seed Fines (~150 docs)
  const finesToInsert = [];
  const fineStatuses = ['unpaid', 'paid', 'waived'];
  for (let i = 0; i < 150; i++) {
    const loan = seededLoans[i % seededLoans.length];
    finesToInsert.push({
      collegeId: loan.collegeId,
      userId: loan.userId,
      loanId: loan._id,
      overdueDays: (i % 10) + 1,
      amount: ((i % 10) + 1) * 5,
      status: fineStatuses[i % fineStatuses.length],
    });
  }
  await Fine.insertMany(finesToInsert);

  // Seed AuditLogs (~200 docs)
  const auditLogsToInsert = [];
  const actions = ['BOOK_CREATED', 'USER_LOGIN', 'LOAN_ISSUED', 'FINE_WAIVED', 'SETTINGS_UPDATED'];
  const severities = ['info', 'warning', 'critical', 'routine'];
  for (let i = 0; i < 200; i++) {
    const col = i % 3 === 0 ? colA : i % 3 === 1 ? colB : colC;
    const user = seededUsers[i % seededUsers.length];
    auditLogsToInsert.push({
      collegeId: col._id,
      actorId: user._id,
      actorRole: user.role,
      action: actions[i % actions.length],
      severity: severities[i % severities.length],
      details: { sample: `Audit log record ${i}` },
      createdAt: new Date(Date.now() - i * 60000),
    });
  }
  await AuditLog.insertMany(auditLogsToInsert);

  // Seed EResources (~90 docs)
  const eResourcesToInsert = [];
  for (let i = 0; i < 90; i++) {
    const col = i % 3 === 0 ? colA : i % 3 === 1 ? colB : colC;
    eResourcesToInsert.push({
      collegeId: col._id,
      title: `E-Resource ${testRunId} Doc ${i}`,
      author: `E-Author ${i}`,
      category: categories[i % categories.length],
      type: 'pdf',
      fileUrl: `https://example.com/resources/${testRunId}/${i}.pdf`,
      uploadedBy: seededUsers[0]._id,
      moderationStatus: i % 2 === 0 ? 'published' : 'pending',
      isPublished: i % 2 === 0,
      source: 'internal',
    });
  }
  await EResource.insertMany(eResourcesToInsert);

  console.log(`✓ Seeded ~980 realistic documents across 3 colleges for index validation.\n`);

  // Define Curated Critical Queries
  const queriesToTest = [
    {
      name: '1. Catalog Search: Category filter with copiesAvailable sorting',
      model: Book,
      run: () =>
        Book.find({ collegeId: targetCollegeId, category: 'Engineering' })
          .sort({ copiesAvailable: -1, title: 1 })
          .explain('executionStats'),
    },
    {
      name: '2. Catalog Search: ISBN Direct Lookup',
      model: Book,
      run: () =>
        Book.find({ collegeId: targetCollegeId, isbn: '978-0000000000' }).explain('executionStats'),
    },
    {
      name: '3. Audit Log: Scoped Action Filtering by Creation Date',
      model: AuditLog,
      run: () =>
        AuditLog.find({ collegeId: targetCollegeId, action: 'BOOK_CREATED' })
          .sort({ createdAt: -1 })
          .explain('executionStats'),
    },
    {
      name: '4. Audit Log: Scoped Severity Filtering by Creation Date',
      model: AuditLog,
      run: () =>
        AuditLog.find({ collegeId: targetCollegeId, severity: 'high' })
          .sort({ createdAt: -1 })
          .explain('executionStats'),
    },
    {
      name: '5. Patron Directory: Scoped Role & Status Lookup',
      model: User,
      run: () =>
        User.find({ collegeId: targetCollegeId, role: 'student', status: 'active' })
          .sort({ createdAt: -1 })
          .explain('executionStats'),
    },
    {
      name: '6. Patron Directory: Unique Student ID Lookup',
      model: User,
      run: () =>
        User.find({ collegeId: targetCollegeId, studentId: `STU-${testRunId.slice(-4)}-0000` }).explain(
          'executionStats'
        ),
    },
    {
      name: '7. Loan Oversight: Scoped Overdue Loans Sorted by Due Date',
      model: Loan,
      run: () =>
        Loan.find({ collegeId: targetCollegeId, status: 'overdue' })
          .sort({ dueDate: 1 })
          .explain('executionStats'),
    },
    {
      name: '8. Fine Oversight: Scoped Unpaid Fines by Creation Date',
      model: Fine,
      run: () =>
        Fine.find({ collegeId: targetCollegeId, status: 'unpaid' })
          .sort({ createdAt: -1 })
          .explain('executionStats'),
    },
    {
      name: '9. E-Resource Catalog: Published & Approved Resources',
      model: EResource,
      run: () =>
        EResource.find({ collegeId: targetCollegeId, moderationStatus: 'published', isPublished: true }).explain(
          'executionStats'
        ),
    },
  ];

  if (shouldSimulateFailure) {
    queriesToTest.push({
      name: '10. [SIMULATED VIOLATION]: Unindexed Field Query',
      model: Book,
      run: () =>
        Book.find({ dummyUnindexedField: 'unindexed_value_12345' }).explain('executionStats'),
    });
  }

  const results = [];
  let violationsCount = 0;

  console.log('Running .explain("executionStats") against curated query suite...\n');

  for (const q of queriesToTest) {
    const rawExplanation = await q.run();
    const stats = rawExplanation.executionStats || {};
    const nReturned = stats.nReturned ?? 0;
    const totalDocsExamined = stats.totalDocsExamined ?? 0;
    const totalKeysExamined = stats.totalKeysExamined ?? 0;
    const stageSummary = extractStageSummary(stats);

    const hasCollscan = stageSummary === 'COLLSCAN';
    const excessiveDocsExamined =
      totalDocsExamined > 5 && totalDocsExamined > 3 * Math.max(nReturned, 1);

    const isViolation = hasCollscan || excessiveDocsExamined;
    if (isViolation) violationsCount++;

    results.push({
      name: q.name,
      stage: stageSummary,
      nReturned,
      totalDocsExamined,
      totalKeysExamined,
      isViolation,
      reason: hasCollscan
        ? 'COLLSCAN detected (missing compound or field index)'
        : excessiveDocsExamined
        ? `totalDocsExamined (${totalDocsExamined}) > 3 * nReturned (${nReturned})`
        : 'OK',
    });
  }

  // Clean up seeded data
  console.log('Cleaning up seeded test fixtures...');
  await Promise.all([
    College.deleteMany({ _id: { $in: colleges.map((c) => c._id) } }),
    User.deleteMany({ collegeId: { $in: colleges.map((c) => c._id) } }),
    Book.deleteMany({ collegeId: { $in: colleges.map((c) => c._id) } }),
    Loan.deleteMany({ collegeId: { $in: colleges.map((c) => c._id) } }),
    Fine.deleteMany({ collegeId: { $in: colleges.map((c) => c._id) } }),
    AuditLog.deleteMany({ collegeId: { $in: colleges.map((c) => c._id) } }),
    EResource.deleteMany({ collegeId: { $in: colleges.map((c) => c._id) } }),
  ]);
  await mongoose.disconnect();
  console.log('✓ Teardown complete.\n');

  // Print Report
  console.log('='.repeat(80));
  console.log('📊 INDEX-USAGE AUDIT REPORT');
  console.log('='.repeat(80));

  for (const res of results) {
    const icon = res.isViolation ? '❌ FAIL' : '✅ PASS';
    console.log(`${icon} [${res.stage}] ${res.name}`);
    console.log(
      `     nReturned: ${res.nReturned} | totalDocsExamined: ${res.totalDocsExamined} | totalKeysExamined: ${res.totalKeysExamined}`
    );
    if (res.isViolation) {
      console.log(`     ⚠️  VIOLATION: ${res.reason}`);
    }
  }

  console.log('='.repeat(80));
  if (violationsCount > 0) {
    console.error(`❌ CI GATE FAILED: ${violationsCount} query path(s) violated index performance constraints.`);
    console.error(`Remediation: Add appropriate compound indexes in models/ or refine query filter predicates.`);
    process.exit(1);
  } else {
    console.log(`✅ CI GATE PASSED: All ${results.length} query paths verified as index-optimized (IXSCAN).`);
    process.exit(0);
  }
}

runIndexAudit().catch((err) => {
  console.error('Fatal error during index audit gate:', err);
  process.exit(1);
});
