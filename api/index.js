const connectDB = require('../backend/src/db');
const app = require('../backend/src/app');

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[Vercel Serverless DB Connection Warning]:', err.message);
  }

  // Ensure request URL has valid /api prefix for Express router matching
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  if (!req.originalUrl) {
    req.originalUrl = req.url;
  }

  return app(req, res);
};
