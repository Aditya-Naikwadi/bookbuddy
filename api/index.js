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
    console.warn(
      '[Vercel Serverless] Warning: Neither MONGO_URI nor MONGODB_URI environment variable is defined in Vercel settings.'
    );
  }
}

module.exports = async (req, res) => {
  try {
    await ensureDbConnection();
  } catch (err) {
    console.error('[Vercel Serverless] Connection handler error:', err.message);
  }

  // Preserve and normalize request URL to match Express /api routes
  const matchedPath = req.headers['x-matched-path'];
  if (matchedPath && matchedPath.startsWith('/api')) {
    req.url = matchedPath;
  } else if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return app(req, res);
};
