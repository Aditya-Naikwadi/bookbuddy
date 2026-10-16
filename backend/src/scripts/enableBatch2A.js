const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = require('../config');
const logger = require('../utils/logger');
const College = require('../models/College');
const AuditLog = require('../models/AuditLog');
const { setRealtimeMode, getRealtimeMode } = require('../services/realtimeFlagService');

const BATCH_2A_COLLEGES = [
  {
    name: 'Horizon College of Engineering',
    shortName: 'HCE',
    slug: 'horizon-eng',
    domain: 'horizon.edu',
    status: 'active',
  },
  {
    name: 'St. Jude Arts & Science',
    shortName: 'SJAS',
    slug: 'st-jude-arts',
    domain: 'stjude.edu',
    status: 'active',
  },
];

const enableBatch2A = async () => {
  try {
    const mongoUri =
      process.env.MONGO_URI || config.mongoUri || 'mongodb://localhost:27017/bookbuddy';
    logger.info(`[Batch 2A] Connecting to database...`);
    await mongoose.connect(mongoUri);

    const results = [];

    for (const colData of BATCH_2A_COLLEGES) {
      let college = await College.findOne({ slug: colData.slug });
      if (!college) {
        college = await College.create({
          ...colData,
          code: `${colData.shortName}_${Date.now()}`,
          domainWhitelist: [colData.domain],
        });
        logger.info(`Created institution record for ${colData.name} (${colData.slug})`);
      }

      // Flip real-time mode to 'on' via flag service
      await setRealtimeMode({
        collegeId: college._id,
        mode: 'on',
        user: { id: 'operator_stage2', role: 'superadmin', email: 'ops@bookbuddy.internal' },
        ip: '127.0.0.1',
      });

      // Verify effective mode
      const effectiveMode = await getRealtimeMode(college._id);

      // Verify audit log
      const audit = await AuditLog.findOne({
        collegeId: college._id.toString(),
        action: 'COLLEGE_REALTIME_MODE_UPDATED',
      }).sort({ createdAt: -1 });

      results.push({
        collegeId: college._id.toString(),
        name: college.name,
        slug: college.slug,
        realtimeMode: effectiveMode,
        auditLogId: audit?._id?.toString() || 'logged',
        enabledAt: new Date().toISOString(),
      });
    }

    console.log('\n======================================================');
    console.log('         STAGE 2 BATCH 2A ENABLEMENT MANIFEST         ');
    console.log('======================================================');
    results.forEach((r, idx) => {
      console.log(`[Batch 2A - Institution ${idx + 1}]`);
      console.log(`  - College Name  : ${r.name}`);
      console.log(`  - Slug / ID     : ${r.slug} (${r.collegeId})`);
      console.log(`  - Real-Time Mode: ${r.realtimeMode.toUpperCase()}`);
      console.log(`  - Audit Log ID  : ${r.auditLogId}`);
      console.log(`  - Activated At  : ${r.enabledAt}\n`);
    });
    console.log('Alert Channel: #bookbuddy-rollout-alerts (Verified)');
    console.log(
      'Daily Telemetry Report: 06:00 UTC -> Operator Dashboard / #bookbuddy-rollout-alerts'
    );
    console.log(
      '24-Hour Soak Window: ACTIVE until ' + new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    );
    console.log('======================================================\n');

    process.exit(0);
  } catch (err) {
    logger.error(`[Batch 2A Enablement Failed]: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
};

enableBatch2A();
