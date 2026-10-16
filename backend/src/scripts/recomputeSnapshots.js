const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = require('../config');
const logger = require('../utils/logger');
const College = require('../models/College');
const { getOrComputeStats } = require('../utils/dashboardCache');
const { runMetricsAggregation } = require('../services/cronService');

const recomputeSnapshots = async () => {
  try {
    const mongoUri =
      process.env.MONGO_URI || config.mongoUri || 'mongodb://localhost:27017/bookbuddy';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB for snapshot recomputation.');

    const args = process.argv.slice(2);
    const collegeIdArg = args.find((a) => a.startsWith('--collegeId='))?.split('=')[1];
    const isAll = args.includes('--all') || !collegeIdArg;

    if (collegeIdArg) {
      logger.info(`Recomputing dashboard stats snapshot for college: ${collegeIdArg}...`);
      const { stats } = await getOrComputeStats(collegeIdArg);
      logger.info(`Recomputation complete for college ${collegeIdArg}:`, stats);
    } else if (isAll) {
      logger.info(
        'Recomputing dashboard snapshots for all active colleges and global platform metrics...'
      );
      const colleges = await College.find({ status: 'active' }).select('_id name').lean();
      logger.info(`Found ${colleges.length} active colleges to recompute.`);

      for (const col of colleges) {
        await getOrComputeStats(col._id.toString());
      }
      logger.info('Individual college dashboard snapshots updated.');

      logger.info('Triggering platform-wide metrics aggregation...');
      const count = await runMetricsAggregation();
      logger.info(`PlatformMetricSnapshot precomputed: ${count} snapshots stored.`);
    }

    logger.info('Snapshot recomputation task completed successfully.');
    process.exit(0);
  } catch (err) {
    logger.error(`Snapshot recomputation failed: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
};

recomputeSnapshots();
