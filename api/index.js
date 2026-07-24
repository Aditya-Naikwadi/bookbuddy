const connectDB = require('../server/src/db');
const app = require('../server/src/app');

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[Vercel Serverless DB Connection Error]:', err.message);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: err.message || 'Database connection error on serverless startup.',
      });
      return;
    }
  }

  // Ensure request URL has valid /api prefix for Express router matching
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return app(req, res);
};
