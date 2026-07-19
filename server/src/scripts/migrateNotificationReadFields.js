const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const NotificationLog = require('../models/NotificationLog');
const Notification = require('../models/Notification');
const ReadingActivityLog = require('../models/ReadingActivityLog');

const runMigration = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy';
    console.log(`Connecting to MongoDB: ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    console.log(
      '1. Migrating historical NotificationLog documents (setting default read: false, readAt: null)...'
    );
    const resLog = await NotificationLog.updateMany(
      { read: { $exists: false } },
      { $set: { read: false, readAt: null } }
    );
    console.log(`   Updated ${resLog.modifiedCount || 0} NotificationLog documents.`);

    console.log('2. Migrating historical Notification documents...');
    const resNotif = await Notification.updateMany(
      { read: { $exists: false } },
      { $set: { read: false, readAt: null } }
    );
    console.log(`   Updated ${resNotif.modifiedCount || 0} Notification documents.`);

    console.log(
      '3. Syncing collection indexes for NotificationLog, Notification, and ReadingActivityLog...'
    );
    await NotificationLog.syncIndexes();
    await Notification.syncIndexes();
    await ReadingActivityLog.syncIndexes();
    console.log('   All collection indexes successfully synchronized.');

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed with error:', err);
    process.exit(1);
  }
};

runMigration();
