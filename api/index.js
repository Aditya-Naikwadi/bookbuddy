const mongoose = require('mongoose');
const app = require('../server/src/app');

let isConnected = false;

async function ensureDbConnection() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
      });
      isConnected = true;
    } catch (err) {
      console.error('[Vercel Serverless] Database connection error:', err.message);
    }
  } else {
    console.warn('[Vercel Serverless] Warning: Neither MONGO_URI nor MONGODB_URI environment variable is defined in Vercel settings.');
  }
}

module.exports = async (req, res) => {
  try {
    await ensureDbConnection();
  } catch (err) {
    console.error('[Vercel Serverless] Connection handler error:', err.message);
  }
  return app(req, res);
};
