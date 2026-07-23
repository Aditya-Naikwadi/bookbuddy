const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../../.env') });
const connectDB = require('../config/db');

const clearDatabase = async () => {
  try {
    console.log('⚡ Connecting to MongoDB...');
    await connectDB();

    console.log('🧹 Purging all collections (removing mock, seed, and predefined data)...');

    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
      console.log(`   ├─ Cleared collection: ${key}`);
    }

    console.log('\n======================================================');
    console.log('✨ DATABASE PURGED & CLEANED SUCCESSFULLY!');
    console.log('All mock data and sample documents have been removed.');
    console.log('The database is ready for real multi-tenant data.');
    console.log('======================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Database Clear Error:', error);
    process.exit(1);
  }
};

clearDatabase();
