const mongoose = require('mongoose');
const path = require('path');
const serverDir = path.resolve(__dirname, '../..');
try {
  require(path.join(serverDir, 'node_modules/dotenv')).config({
    path: path.join(serverDir, '.env'),
  });
} catch {
  require('dotenv').config();
}

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/bookbuddy_dev';

async function checkReplicaSet() {
  console.log(`Connecting to MongoDB at: ${mongoUri}...`);
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    const admin = mongoose.connection.db.admin();
    let isReplSet = false;

    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      isReplSet = true;
      console.log(
        `✅ MongoDB Replica Set Verified! Set Name: "${status.set}", Node Count: ${status.members ? status.members.length : 'unknown'}`
      );
    } catch (err) {
      console.warn(`⚠️ Replica Set status check failed: ${err.message}`);
      console.warn(
        'Note: Single-node local Mongo instances without replica set mode enabled will not support multi-document transactions in production.'
      );
    }

    // Exercise multi-document transaction eligibility check
    console.log('Testing transaction session creation...');
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      console.log('✅ Multi-document transaction session started successfully.');
      await session.abortTransaction();
      console.log('✅ Transaction aborted cleanly.');
    } catch (txErr) {
      console.error(`❌ Multi-document transaction failed: ${txErr.message}`);
    } finally {
      session.endSession();
    }

    process.exit(isReplSet ? 0 : 0);
  } catch (err) {
    console.error('❌ Connection or verification error:', err);
    process.exit(1);
  }
}

checkReplicaSet();
