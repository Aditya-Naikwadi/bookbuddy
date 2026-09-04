const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { backupDatabase } = require('./backupDatabase');

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Production-Safe Database Clearing Script with Mandatory Safety Gates:
 * 1. Target Environment Check (blocks execution if pointed at production unless --force-prod)
 * 2. Full Automatic Streaming Database Backup prior to execution
 * 3. Dry-Run Mode support (--dry-run or missing --confirm preview)
 * 4. Post-Execution Summary Logging (Collection Name + Documents Deleted)
 */

// Ordered array of model names (child / dependent collections first to respect schema references)
const DEPENDENCY_ORDERED_COLLECTIONS = [
  // Activity, Transaction & Log Collections
  'checkinlogs',
  'readingactivitylogs',
  'readingpositions',
  'readingprogresses',
  'cronrunlogs',
  'auditlogs',
  'platformmetricsnapshots',
  'dashboardstatssnapshots',
  'notificationlogs',
  'paymentattempts',
  'payments',

  // Patron Interaction Collections
  'labbookings',
  'loans',
  'fines',
  'reservations',
  'bookmarks',
  'savedsearches',
  'readinglists',
  'annotations',
  'feedbacks',
  'complaints',
  'booksuggestions',
  'userstickers',
  'streaks',

  // User Session & System State Collections
  'notifications',
  'notificationpreferences',
  'devicetokens',
  'refreshtokens',
  'eresourcesubmissions',
  'registrationrequests',
  'csvimportjobs',
  'uploadjobs',
  'pendingadminsetups',

  // Inventory & Catalog Collections
  'books',
  'openlibrarybooks',
  'unifiedbooks',
  'eresources',
  'labseats',
  'stickers',
  'streakrewards',

  // Core Organizational & User Collections
  'users',
  'collegefeatureconfigs',
  'librarysettings',
  'announcements',
  'colleges',
  'featurecatalogs',
  'services',
];

const isProductionEnvironment = (mongoUri) => {
  const nodeEnv = process.env.NODE_ENV || '';
  const uri = mongoUri.toLowerCase();

  const isProdEnv = nodeEnv.toLowerCase() === 'production';
  const isProdUri =
    uri.includes('prod') ||
    uri.includes('production') ||
    uri.includes('mongodb.net') ||
    uri.includes('cluster0') ||
    uri.includes('aws') ||
    uri.includes('azure') ||
    uri.includes('gcp');

  return isProdEnv || isProdUri;
};

const clearDatabase = async () => {
  try {
    const args = process.argv.slice(2);
    const hasConfirm = args.includes('--confirm');
    const isDryRun = args.includes('--dry-run') || !hasConfirm;
    const forceProd = args.includes('--force-prod');

    const mongoUri =
      process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookbuddy';

    console.log('\n======================================================');
    console.log('🛡️  BOOKBUDDY SAFE DATABASE CLEARING UTILITY');
    console.log('======================================================');
    console.log(`🔌 Target Database URI: ${mongoUri.replace(/:([^@]+)@/, ':****@')}`);

    // SAFETY GATE 1: Target Environment Protection
    const isProd = isProductionEnvironment(mongoUri);
    if (isProd && !forceProd) {
      console.error('\n❌ EXECUTION BLOCKED BY SAFETY GATE 1: PRODUCTION GUARD');
      console.error('   The target database URI or NODE_ENV indicates a PRODUCTION environment!');
      console.error('   Running data clearing on production requires explicit --force-prod flag.');
      process.exit(1);
    }

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
    const db = mongoose.connection.db;

    // Retrieve all existing collection names from MongoDB
    const collectionsList = await db.listCollections().toArray();
    const existingCollectionNames = collectionsList
      .map((c) => c.name)
      .filter((name) => !name.startsWith('system.'));

    // Order collections (ordered listed collections first, then any unlisted remaining)
    const sortedCollectionNames = [
      ...DEPENDENCY_ORDERED_COLLECTIONS.filter((name) => existingCollectionNames.includes(name)),
      ...existingCollectionNames.filter((name) => !DEPENDENCY_ORDERED_COLLECTIONS.includes(name)),
    ];

    // Collect pre-clear document counts per table
    const tableCounts = [];
    let totalDocsToDelete = 0;

    for (const collectionName of sortedCollectionNames) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments({});
      tableCounts.push({ collectionName, count });
      totalDocsToDelete += count;
    }

    // SAFETY GATE 3: Dry-Run Mode
    if (isDryRun) {
      console.log('\n======================================================');
      console.log('🔍 SAFETY GATE 3: DRY-RUN MODE (NO DATA ALTERED)');
      console.log('======================================================');
      console.log('Summary of row/document counts per table that WOULD be deleted:\n');
      console.table(
        tableCounts.map((t) => ({
          'Table / Collection Name': t.collectionName,
          'Rows To Delete': t.count,
        }))
      );
      console.log(`Total Documents Flagged for Deletion: ${totalDocsToDelete}`);
      console.log('\nℹ️  To execute actual database clearing with backup creation, run:');
      console.log('   node src/scripts/clearDatabase.js --confirm\n');

      await mongoose.disconnect();
      process.exit(0);
    }

    // SAFETY GATE 2: Mandatory Full Database Backup Dump Before Execution
    console.log('\n======================================================');
    console.log('📦 SAFETY GATE 2: CREATING PRE-CLEARING DATABASE BACKUP');
    console.log('======================================================');
    const backupDir = await backupDatabase();
    console.log(`\n✅ Database backup snapshot saved to: ${backupDir}`);
    console.log(`💡 Rollback Command:\n   node src/scripts/restoreDatabase.js "${backupDir}"\n`);

    // EXECUTION: Clear All Rows preserving schema, tables, columns, constraints & indexes
    console.log('======================================================');
    console.log('🧹 EXECUTING SAFE DOCUMENT DELETION Across Collections');
    console.log('======================================================');

    const deletionSummary = [];
    let totalDocsDeleted = 0;

    for (const collectionName of sortedCollectionNames) {
      const collection = db.collection(collectionName);
      const res = await collection.deleteMany({});
      deletionSummary.push({
        'Table / Collection Name': collectionName,
        'Rows Deleted': res.deletedCount,
      });
      totalDocsDeleted += res.deletedCount;
      console.log(`  ✓ Cleared table '${collectionName}': ${res.deletedCount} rows deleted.`);
    }

    // Reset sequence / counter collections if present
    if (existingCollectionNames.includes('counters')) {
      await db.collection('counters').deleteMany({});
      console.log('  ✓ Reset auto-increment sequence counters collection.');
    }

    // SAFETY GATE 4: Post-Execution Summary Logging
    console.log('\n======================================================');
    console.log('📊 SAFETY GATE 4: POST-EXECUTION SUMMARY LOG');
    console.log('======================================================');
    console.table(deletionSummary);
    console.log(`Total Rows Deleted Across All Tables: ${totalDocsDeleted}`);
    console.log(`Schema, tables, columns, constraints, and indexes preserved 100%.`);
    console.log(
      `\n💡 Rollback instruction in case of error:\n   node src/scripts/restoreDatabase.js "${backupDir}"\n`
    );
    console.log('======================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database Clear Execution Error:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

clearDatabase();
