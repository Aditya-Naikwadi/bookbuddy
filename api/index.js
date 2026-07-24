const mongoose = require('mongoose');
const app = require('../server/src/app');

let isConnected = false;

async function ensureDbConnection() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }
  const mongoUri = process.env.MONGO_URI;
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
      });
      isConnected = true;
    } catch (err) {
      console.error('[Vercel Serverless] Database connection error:', err.message);
    }
  }
}

module.exports = async (req, res) => {
  await ensureDbConnection();
  return app(req, res);
};
