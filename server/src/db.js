const mongoose = require('mongoose');

let cached = global._mongooseConn;
if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null };
}

/**
 * Serverless-optimized database connection helper with promise caching.
 * Reuses connection across warm container invocations and enforces conservative pool size.
 */
async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    const errorMsg =
      'MONGO_URI is not set — check Vercel environment variables (Production / Preview / Development) for this environment.';
    console.error(`[Database Boot Failure] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  if (!cached.promise) {
    const opts = {
      maxPoolSize: 5, // Small per-container pool to prevent Atlas connection exhaustion at scale
      bufferCommands: false, // Fail fast instead of silently queuing ops pre-connection
      serverSelectionTimeoutMS: 5000,
    };

    cached.promise = mongoose.connect(mongoUri, opts).then((mongooseInstance) => {
      console.log('[Database] MongoDB connection established successfully.');
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // Clear cached promise on failure to allow subsequent retries
    console.error('[Database Connection Error]:', err.message);
    throw err;
  }

  return cached.conn;
}

module.exports = connectDB;
