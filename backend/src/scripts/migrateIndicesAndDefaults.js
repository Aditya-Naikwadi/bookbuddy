const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

const config = require('../config');
const logger = require('../utils/logger');
const College = require('../models/College');
const User = require('../models/User');
const Loan = require('../models/Loan');
const Reservation = require('../models/Reservation');
const Fine = require('../models/Fine');
const LabBooking = require('../models/LabBooking');
const ReadingPosition = require('../models/ReadingPosition');
const Complaint = require('../models/Complaint');

const runMigration = async () => {
  try {
    logger.info('Starting Database Schema Migration and Index Creation...');
    const mongoUri =
      process.env.MONGO_URI || config.mongoUri || 'mongodb://localhost:27017/bookbuddy';

    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB for migration script execution.');

    // 1. Seed default maxFineLimit: 100 on existing College documents
    const collegeUpdateResult = await College.updateMany(
      { $or: [{ maxFineLimit: { $exists: false } }, { maxFineLimit: null }] },
      { $set: { maxFineLimit: 100 } }
    );
    logger.info(
      `Updated ${collegeUpdateResult.modifiedCount} College documents with default maxFineLimit: 100.`
    );

    // 2. Populate cardSecret on existing User documents
    const usersWithoutSecret = await User.find({
      $or: [{ cardSecret: { $exists: false } }, { cardSecret: null }, { cardSecret: '' }],
    }).select('+cardSecret');

    let updatedUsersCount = 0;
    for (const u of usersWithoutSecret) {
      u.cardSecret = crypto.randomBytes(32).toString('hex');
      await u.save({ validateBeforeSave: false });
      updatedUsersCount++;
    }
    logger.info(`Populated cardSecret for ${updatedUsersCount} existing User documents.`);

    // 3. Synchronize / Ensure Index Creation
    logger.info('Syncing collection indexes...');
    await College.syncIndexes();
    await User.syncIndexes();
    await Loan.syncIndexes();
    await Reservation.syncIndexes();
    await Fine.syncIndexes();
    await LabBooking.syncIndexes();
    await ReadingPosition.syncIndexes();
    await Complaint.syncIndexes();

    logger.info('All Mongoose indexes synchronized successfully.');
    process.exit(0);
  } catch (err) {
    logger.error(`Migration Script Failed: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
};

runMigration();
