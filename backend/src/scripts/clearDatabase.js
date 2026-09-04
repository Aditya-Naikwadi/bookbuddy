const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { backupDatabase } = require('./backupDatabase');

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Production-Safe Database Clearing Script with Mandatory Safeguards:
 * 1. Environment Guard — Prevents running against production unless --force-production is provided.
 * 2. Pre-Deletion Backup — Automatically dumps database snapshot before any data is wiped.
 * 3. Dependency-Ordered Deletion — Deletes child/referencing collections first to respect schema relationships.
 * 4. Auto-Increment Reset — Clears sequence counter collections ('counters').
 * 5. Confirmation Prompt / --force flag — Requires interactive confirmation or explicit --force flag.
 * 6. Detailed Log Output — Logs document counts per collection before and after execution.
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
  const uri = (mongoUri || '').toLowerCase();

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

const askConfirmation = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
};

const clearDatabase = async () => {
  try {
    const args = process.argv.slice(2);
    const hasForce = args.includes('--force') || args.includes('-y') || args.includes('--confirm');
    const isDryRun = args.includes('--dry-run');
    const forceProd = args.includes('--force-production') || args.includes('--force-prod');

    // Option for specific target collections: --collections=users,loans or --only=users,loans
    const collectionsArg = args.find(
      (a) => a.startsWith('--collections=') || a.startsWith('--only=')
    );
    const targetCollections = collectionsArg
      ? collectionsArg
          .split('=')[1]
          .split(',')
          .map((c) => c.trim().toLowerCase())
      : null;

    const mongoUri =
      process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookbuddy';

    console.log('\n======================================================');
    console.log('🛡️  SAFE MONGODB DATABASE CLEARING UTILITY');
    console.log('======================================================');
    console.log(`🔌 Target Mongo URI: ${mongoUri.replace(/:([^@]+)@/, ':****@')}`);
    console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

    // SAFEGUARD 1: Environment Guard Check
    const isProd = isProductionEnvironment(mongoUri);
    if (isProd && !forceProd) {
      console.error('\n❌ EXECUTION BLOCKED BY SAFEGUARD 1: PRODUCTION GUARD');
      console.error('   The target database URI or NODE_ENV indicates a PRODUCTION environment!');
      console.error('   Clearing production data requires explicit --force-production flag.');
      process.exit(1);
    }

    if (isProd && forceProd) {
      console.warn('\n⚠️  WARNING: OVERRIDING PRODUCTION GUARD WITH --force-production FLAG!');
    }

    // SAFEGUARD 5: Confirmation Prompt
    if (!hasForce && !isDryRun) {
      if (process.stdin.isTTY) {
        const answer = await askConfirmation(
          '\n⚠️  ARE YOU SURE YOU WANT TO CLEAR ALL DATA FROM THE DATABASE? Type "yes" to confirm: '
        );
        if (answer !== 'yes' && answer !== 'y') {
          console.log('❌ Database clearing cancelled by user.');
          process.exit(0);
        }
      } else {
        console.error('\n❌ Non-interactive terminal environment. Pass --force to proceed.');
        process.exit(1);
      }
    }

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
    const db = mongoose.connection.db;

    // Retrieve all existing collection names from MongoDB
    const collectionsList = await db.listCollections().toArray();
    let existingCollectionNames = collectionsList
      .map((c) => c.name)
      .filter((name) => !name.startsWith('system.'));

    if (targetCollections && targetCollections.length > 0) {
      existingCollectionNames = existingCollectionNames.filter((name) =>
        targetCollections.includes(name)
      );
      console.log(
        `🎯 Target specific collections filter active: [${existingCollectionNames.join(', ')}]`
      );
    }

    // Order collections according to dependency order (child collections first)
    const sortedCollectionNames = [
      ...DEPENDENCY_ORDERED_COLLECTIONS.filter((name) => existingCollectionNames.includes(name)),
      ...existingCollectionNames.filter((name) => !DEPENDENCY_ORDERED_COLLECTIONS.includes(name)),
    ];

    // Collect pre-clear document counts per collection
    const tableCounts = [];
    let totalDocsToDelete = 0;

    for (const collectionName of sortedCollectionNames) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments({});
      tableCounts.push({ collectionName, count });
      totalDocsToDelete += count;
    }

    // DRY-RUN PREVIEW MODE
    if (isDryRun) {
      console.log('\n======================================================');
      console.log('🔍 DRY-RUN MODE (NO DATA ALTERED)');
      console.log('======================================================');
      console.table(
        tableCounts.map((t) => ({
          'Collection Name': t.collectionName,
          'Rows To Delete': t.count,
        }))
      );
      console.log(`Total Documents Flagged for Deletion: ${totalDocsToDelete}`);
      console.log('\nℹ️  To execute actual database clearing with backup creation, run:');
      console.log('   node src/scripts/clearDatabase.js --force\n');

      await mongoose.disconnect();
      process.exit(0);
    }

    // SAFEGUARD 2: Mandatory Full Database Backup Snapshot
    console.log('\n======================================================');
    console.log('📦 SAFEGUARD 2: CREATING PRE-CLEARING DATABASE BACKUP');
    console.log('======================================================');
    const backupDir = await backupDatabase();
    console.log(`\n✅ Database backup snapshot saved to: ${backupDir}`);
    console.log(`💡 Rollback Command:\n   node src/scripts/restoreDatabase.js "${backupDir}"\n`);

    // SAFEGUARD 3 & 4: Dependency-Ordered Deletion & Auto-Increment Sequence Reset
    console.log('======================================================');
    console.log('🧹 EXECUTING DEPENDENCY-ORDERED DOCUMENT DELETION');
    console.log('======================================================');

    const deletionSummary = [];
    let totalDocsDeleted = 0;

    for (const collectionName of sortedCollectionNames) {
      const collection = db.collection(collectionName);
      const res = await collection.deleteMany({});
      deletionSummary.push({
        'Collection Name': collectionName,
        'Rows Deleted': res.deletedCount,
      });
      totalDocsDeleted += res.deletedCount;
      console.log(`  ✓ Cleared collection '${collectionName}': ${res.deletedCount} rows deleted.`);
    }

    // Reset sequence / counter collections if present
    if (existingCollectionNames.includes('counters')) {
      await db.collection('counters').deleteMany({});
      console.log('  ✓ Reset auto-increment sequence counters collection.');
    }

    // SAFEGUARD 6: Log Output Summary
    console.log('\n======================================================');
    console.log('📊 POST-EXECUTION SUMMARY LOG');
    console.log('======================================================');
    console.table(deletionSummary);
    console.log(`Total Rows/Documents Deleted Across All Collections: ${totalDocsDeleted}`);
    console.log(`Collection schemas, indexes, and constraints preserved 100%.`);
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
