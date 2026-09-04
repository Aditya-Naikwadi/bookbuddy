const mongoose = require('mongoose');
require('dotenv').config();

const config = require('../config');
const logger = require('../utils/logger');
const RefreshToken = require('../models/RefreshToken');
const DeviceToken = require('../models/DeviceToken');
const NotificationLog = require('../models/NotificationLog');

const runProductionHardeningMigration = async () => {
  try {
    logger.info('Starting Production Hardening Database Schema & Index Migration...');
    const mongoUri =
      process.env.MONGO_URI || config.mongoUri || 'mongodb://localhost:27017/bookbuddy';

    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB for production hardening migration.');

    logger.info('Synchronizing indexes for new production hardening models...');

    await RefreshToken.syncIndexes();
    logger.info(
      'RefreshToken indexes synchronized ({ tokenHash: 1 }, { userId: 1, expiresAt: 1 }).'
    );

    await DeviceToken.syncIndexes();
    logger.info(
      'DeviceToken indexes synchronized ({ fcmToken: 1 }, { userId: 1, lastSeenAt: -1 }).'
    );

    await NotificationLog.syncIndexes();
    logger.info(
      'NotificationLog indexes synchronized ({ userId: 1, createdAt: -1 }, { status: 1, createdAt: -1 }).'
    );

    logger.info('Production Hardening Database Migration Completed Successfully.');
    process.exit(0);
  } catch (err) {
    logger.error(`Production Hardening Migration Failed: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
};

runProductionHardeningMigration();
