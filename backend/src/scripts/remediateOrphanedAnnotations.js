const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = require('../config');
const logger = require('../utils/logger');
const Annotation = require('../models/Annotation');
const Bookmark = require('../models/Bookmark');
const ReadingPosition = require('../models/ReadingPosition');
const ReadingProgress = require('../models/ReadingProgress');
const User = require('../models/User');

const quarantineSchema = new mongoose.Schema(
  {
    originalCollection: { type: String, required: true, index: true },
    originalId: { type: mongoose.Schema.Types.Mixed, required: true },
    reason: { type: String, required: true },
    quarantinedAt: { type: Date, default: Date.now },
    recordData: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

const Quarantine =
  mongoose.models.OrphanedAnnotationQuarantine ||
  mongoose.model(
    'OrphanedAnnotationQuarantine',
    quarantineSchema,
    'orphaned_annotations_quarantine'
  );

/**
 * Audit and remediate orphaned reading annotations, bookmarks, and positions
 */
const remediateOrphanedData = async (isApply = false) => {
  const modeText = isApply ? 'APPLY MODE (Active remediation)' : 'DRY RUN MODE (Audit only)';
  logger.info(`Starting Orphaned Annotations & Bookmarks Remediation [${modeText}]...`);

  const collectionsToAudit = [
    { name: 'Annotation', model: Annotation },
    { name: 'Bookmark', model: Bookmark },
    { name: 'ReadingPosition', model: ReadingPosition },
    { name: 'ReadingProgress', model: ReadingProgress },
  ];

  const summary = {
    mode: isApply ? 'apply' : 'dry-run',
    audited: {},
    totalOrphaned: 0,
    totalQuarantined: 0,
  };

  // Get all valid user IDs in memory for fast set lookup
  const validUsers = await User.find({}).select('_id').lean();
  const validUserIdSet = new Set(validUsers.map((u) => u._id.toString()));
  logger.info(`Loaded ${validUserIdSet.size} registered users for reference validation.`);

  for (const { name, model } of collectionsToAudit) {
    const totalCount = await model.countDocuments();
    const allRecords = await model.find({}).lean();

    const orphanedRecords = [];

    for (const record of allRecords) {
      const rawUserId = record.userId;
      const isMissing = !rawUserId;
      const isInvalid = rawUserId && !validUserIdSet.has(rawUserId.toString());

      if (isMissing || isInvalid) {
        orphanedRecords.push({
          record,
          reason: isMissing ? 'Missing userId field' : 'Dangling userId (user does not exist)',
        });
      }
    }

    summary.audited[name] = {
      total: totalCount,
      valid: totalCount - orphanedRecords.length,
      orphaned: orphanedRecords.length,
    };
    summary.totalOrphaned += orphanedRecords.length;

    logger.info(
      `[${name}] Total: ${totalCount} | Valid: ${totalCount - orphanedRecords.length} | Orphaned: ${orphanedRecords.length}`
    );

    if (orphanedRecords.length > 0) {
      for (const { record, reason } of orphanedRecords) {
        if (isApply) {
          // Quarantine into orphaned_annotations_quarantine
          await Quarantine.create({
            originalCollection: name,
            originalId: record._id,
            reason,
            recordData: record,
          });

          // Delete from active collection to protect against data leaks
          await model.deleteOne({ _id: record._id });
          summary.totalQuarantined++;
        } else {
          logger.warn(
            `  [Dry-Run Preview] Would quarantine ${name} id=${record._id} (reason: ${reason})`
          );
        }
      }
    }
  }

  logger.info('======================================================');
  logger.info(`Remediation Complete [${modeText}]`);
  logger.info(`Total Orphaned Records Found: ${summary.totalOrphaned}`);
  if (isApply) {
    logger.info(`Total Records Safely Quarantined & Cleaned: ${summary.totalQuarantined}`);
  } else {
    logger.info(
      'Dry run completed. To commit changes, re-run with: node src/scripts/remediateOrphanedAnnotations.js --apply'
    );
  }
  logger.info('======================================================');

  return summary;
};

// Standalone execution wrapper
const run = async () => {
  try {
    const isApply = process.argv.includes('--apply');
    const mongoUri =
      process.env.MONGO_URI || config.mongoUri || 'mongodb://localhost:27017/bookbuddy';

    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB.');

    await remediateOrphanedData(isApply);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    logger.error(`Remediation failed with error: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
};

if (require.main === module) {
  run();
}

module.exports = {
  remediateOrphanedData,
  Quarantine,
};
