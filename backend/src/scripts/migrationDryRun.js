const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = require('../config');
const logger = require('../utils/logger');

const Loan = require('../models/Loan');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const College = require('../models/College');

const runMigrationDryRun = async () => {
  const scorecard = {
    totalColleges: 0,
    additiveIndexesStatus: [],
    backfills: {
      paymentsMissingCollegeId: 0,
      notificationsMissingDedupKey: 0,
    },
    duplicateReports: {
      notificationDedupCollisions: 0,
      deviceTokenCollisions: 0,
    },
    uniqueIndexReadiness: 'READY',
    verdict: 'GO',
  };

  try {
    const mongoUri =
      process.env.MONGO_URI || config.mongoUri || 'mongodb://localhost:27017/bookbuddy';
    logger.info(`[DryRun] Connecting to MongoDB: ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    logger.info('[DryRun] Connected to database successfully.');

    // 1. College baseline count
    scorecard.totalColleges = await College.countDocuments({});

    // 2. Check additive index status
    const loanIndexes = await Loan.collection.getIndexes();
    scorecard.additiveIndexesStatus.push({
      collection: 'loans',
      index: 'collegeId_1_status_1_dueDate_1',
      exists: !!loanIndexes['collegeId_1_status_1_dueDate_1'],
    });

    const paymentIndexes = await Payment.collection.getIndexes();
    scorecard.additiveIndexesStatus.push({
      collection: 'payments',
      index: 'collegeId_1_status_1',
      exists: !!paymentIndexes['collegeId_1_status_1'],
    });

    const notifIndexes = await Notification.collection.getIndexes();
    scorecard.additiveIndexesStatus.push({
      collection: 'notifications',
      index: 'userId_1_read_1_createdAt_-1',
      exists: !!notifIndexes['userId_1_read_1_createdAt_-1'],
    });

    // 3. Scan Backfill Misses
    scorecard.backfills.paymentsMissingCollegeId = await Payment.countDocuments({
      $or: [{ collegeId: { $exists: false } }, { collegeId: null }],
    });

    scorecard.backfills.notificationsMissingDedupKey = await Notification.countDocuments({
      $or: [{ dedupKey: { $exists: false } }, { dedupKey: null }],
    });

    // 4. Duplicate scan
    const duplicateNotifs = await Notification.aggregate([
      { $match: { dedupKey: { $exists: true, $ne: null } } },
      { $group: { _id: '$dedupKey', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    scorecard.duplicateReports.notificationDedupCollisions = duplicateNotifs.length;

    const duplicateTokens = await DeviceToken.aggregate([
      { $match: { fcmToken: { $exists: true, $ne: null } } },
      { $group: { _id: '$fcmToken', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    scorecard.duplicateReports.deviceTokenCollisions = duplicateTokens.length;

    if (
      scorecard.duplicateReports.notificationDedupCollisions > 0 ||
      scorecard.duplicateReports.deviceTokenCollisions > 0
    ) {
      scorecard.uniqueIndexReadiness = 'BLOCKED_DUPLICATES_DETECTED';
      scorecard.verdict = 'NO_GO';
    }

    console.log('\n======================================================');
    console.log('       PRODUCTION MIGRATION DRY-RUN SCORECARD         ');
    console.log('======================================================');
    console.log(`Active Colleges Registered: ${scorecard.totalColleges}`);
    console.log('\n[1] Additive Indexes Status:');
    scorecard.additiveIndexesStatus.forEach((idx) => {
      console.log(
        `  - ${idx.collection}: ${idx.index} => ${idx.exists ? 'PRESENT' : 'PENDING_BUILD'}`
      );
    });

    console.log('\n[2] Non-Destructive Backfills:');
    console.log(`  - Payments missing collegeId: ${scorecard.backfills.paymentsMissingCollegeId}`);
    console.log(
      `  - Notifications missing dedupKey: ${scorecard.backfills.notificationsMissingDedupKey}`
    );

    console.log('\n[3] Pre-Unique Index Collision Check:');
    console.log(
      `  - Notification dedupKey collisions: ${scorecard.duplicateReports.notificationDedupCollisions}`
    );
    console.log(`  - DeviceToken collisions: ${scorecard.duplicateReports.deviceTokenCollisions}`);

    console.log('\n[4] Unique Index Gate & Readiness:');
    console.log(`  - Status: ${scorecard.uniqueIndexReadiness}`);

    console.log('\n======================================================');
    console.log(`>>> DRY-RUN FINAL VERDICT: ${scorecard.verdict} <<<`);
    console.log('======================================================\n');

    process.exit(scorecard.verdict === 'GO' ? 0 : 1);
  } catch (err) {
    logger.error(`[DryRun Error]: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
};

runMigrationDryRun();
