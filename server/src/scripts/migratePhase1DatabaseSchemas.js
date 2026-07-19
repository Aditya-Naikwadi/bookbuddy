const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Payment = require('../models/Payment');
const Annotation = require('../models/Annotation');
const EResourceSubmission = require('../models/EResourceSubmission');
const LabBooking = require('../models/LabBooking');

const runMigration = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy';
    console.log(`Connecting to MongoDB: ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    console.log('1. Syncing Payment schema indexes...');
    await Payment.syncIndexes();
    console.log('   ✓ Payment.providerEventId unique index created & enforced.');

    console.log('2. Syncing Annotation schema text and compound indexes...');
    await Annotation.syncIndexes();
    console.log('   ✓ Annotation full-text & compound indexes synchronized.');

    console.log('3. Syncing EResourceSubmission schema indexes...');
    await EResourceSubmission.syncIndexes();
    console.log('   ✓ EResourceSubmission status indexes synchronized.');

    console.log('4. Syncing LabBooking extended schema indexes...');
    await LabBooking.syncIndexes();
    console.log('   ✓ LabBooking confirmation token fields synchronized.');

    console.log('\nMigration completed successfully! Database hard-constraints active.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

runMigration();
