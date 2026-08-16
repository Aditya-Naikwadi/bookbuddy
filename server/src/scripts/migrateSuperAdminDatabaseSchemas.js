const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const User = require('../models/User');
const College = require('../models/College');
const RegistrationRequest = require('../models/RegistrationRequest');
const AuditLog = require('../models/AuditLog');
const PlatformMetricSnapshot = require('../models/PlatformMetricSnapshot');
const SystemSetting = require('../models/SystemSetting');
const CronRunLog = require('../models/CronRunLog');

async function runMigration() {
  try {
    console.log('=====================================================');
    console.log('🚀 SUPER ADMIN DATABASE LAYER MIGRATION & INDEX SYNC');
    console.log('=====================================================');

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ Connected to MongoDB successfully.');
    }

    // 1. Backfill User documents
    console.log('\n📦 Step 1: Migration backfill for User collection...');
    const userRes = await User.updateMany(
      { lastLogin: { $exists: false } },
      { $set: { lastLogin: null, impersonatedBy: null } }
    );
    console.log(`   Updated ${userRes.modifiedCount} User documents with default fields.`);

    // 2. Backfill College documents
    console.log('\n📦 Step 2: Migration backfill for College collection...');
    const collegeRes = await College.updateMany(
      { subscriptionPlan: { $exists: false } },
      {
        $set: {
          subscriptionPlan: 'standard',
          allowedFeatures: {
            eReaderEnabled: true,
            labBookingEnabled: true,
            aiRecommendationsEnabled: true,
          },
        },
      }
    );
    console.log(
      `   Updated ${collegeRes.modifiedCount} College documents with default subscription & features.`
    );

    // 3. Drop legacy AuditLog TTL index if present
    console.log('\n📜 Step 3: Checking AuditLog retention indexes...');
    try {
      const auditIndexes = await AuditLog.collection.getIndexes();
      if (auditIndexes.createdAt_1 && auditIndexes.createdAt_1.some((i) => i.expireAfterSeconds)) {
        await AuditLog.collection.dropIndex('createdAt_1');
        console.log(
          '   Dropped legacy TTL index on AuditLog collection to enforce indefinite compliance retention.'
        );
      } else {
        console.log(
          '   No TTL index found on AuditLog (Indefinite compliance retention verified).'
        );
      }
    } catch (err) {
      console.log('   AuditLog collection index check note:', err.message);
    }

    // 4. Ensure SystemSetting default singleton
    console.log('\n⚙️ Step 4: Ensuring SystemSetting singleton configuration...');
    await SystemSetting.findOneAndUpdate(
      { key: 'global_config' },
      {
        key: 'global_config',
        value: {
          maintenanceMode: false,
          globalMaxBorrowLimit: 5,
          defaultFinePerDay: 2,
          backupSchedule: '0 3 * * *',
        },
        description: 'Primary global platform setting configuration',
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log('   SystemSetting default singleton verified.');

    // 5. Synchronize Schema Indexes
    console.log('\n⚡ Step 5: Synchronizing Schema Indexes across all 7 collections...');
    const models = [
      { name: 'User', model: User },
      { name: 'College', model: College },
      { name: 'RegistrationRequest', model: RegistrationRequest },
      { name: 'AuditLog', model: AuditLog },
      { name: 'PlatformMetricSnapshot', model: PlatformMetricSnapshot },
      { name: 'SystemSetting', model: SystemSetting },
      { name: 'CronRunLog', model: CronRunLog },
    ];

    for (const { name, model } of models) {
      await model.syncIndexes();
      const indexes = await model.collection.getIndexes();
      console.log(
        `   ✅ ${name} indexes synced successfully. Total indexes: ${Object.keys(indexes).length}`
      );
    }

    console.log('\n=====================================================');
    console.log('🎉 MIGRATION & INDEX SYNCHRONIZATION COMPLETED SUCCESSFULLY');
    console.log('=====================================================\n');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    if (require.main === module) {
      await mongoose.connection.close();
    }
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
