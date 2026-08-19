// Database connection manager with retry logic and event logging.
const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

// Set strictQuery rule
mongoose.set('strictQuery', true);

// Monitor connection events
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connection status: Connected.');
});

mongoose.connection.on('reconnected', () => {
  logger.info('Mongoose connection status: Reconnected.');
});

mongoose.connection.on('error', (err) => {
  logger.error(`Mongoose connection status: Error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose connection status: Disconnected.');
});

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    const errorMsg =
      'MONGO_URI is not set — check Vercel environment variables (Production / Preview / Development) for this environment.';
    logger.error(`[Database Boot Failure] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  if (!global._mongooseConn) {
    global._mongooseConn = { conn: null, promise: null };
  }
  const cached = global._mongooseConn;

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return cached.conn;
  }

  if (cached.promise) {
    try {
      cached.conn = await cached.promise;
      return cached.conn;
    } catch {
      cached.promise = null;
    }
  }

  const defaultPoolSize = process.env.VERCEL ? 5 : 25;
  const options = {
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE, 10) || defaultPoolSize,
    serverSelectionTimeoutMS: 15000,
  };

  const isProd = config.nodeEnv === 'production' || !!process.env.RENDER;
  const primaryUri = mongoUri || config.mongoUri;
  const fallbackUris = isProd ? [] : ['mongodb://localhost:27017/bookbuddy'];

  const targetUris = Array.from(new Set([primaryUri, ...fallbackUris])).filter(Boolean);

  let lastError = null;
  cached.promise = (async () => {
    for (const uri of targetUris) {
      try {
        const sanitizedUri = uri.includes('@')
          ? uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
          : uri;
        logger.info(`Attempting MongoDB connection to ${sanitizedUri}...`);
        const mongooseInstance = await mongoose.connect(uri, options);
        logger.info('MongoDB connected successfully.');
        return mongooseInstance;
      } catch (err) {
        lastError = err;
        const displayHost = uri.includes('@') ? uri.split('@')[1] : uri;
        logger.error(`MongoDB connection to ${displayHost} failed: ${err.message}`);
      }
    }
    throw lastError || new Error('All MongoDB connection attempts failed');
  })();

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    if (isProd) {
      logger.error(
        '------------------------------------------------------------------------------------\n' +
          '❌ FATAL MONGODB CONNECTION ERROR ON RENDER DEPLOYMENT:\n' +
          `Details: ${err ? err.message : 'Unknown error'}\n\n` +
          'Required Troubleshooting Steps:\n' +
          '1. MongoDB Atlas Network Access: Go to MongoDB Atlas -> Network Access -> Add IP Address -> Select "Allow Access from Anywhere" (0.0.0.0/0).\n' +
          '2. Render Environment Variables: Verify MONGO_URI in your Render service environment settings has correct username/password and format (e.g. mongodb+srv://admin:pass@cluster.mongodb.net/dbname).\n' +
          '------------------------------------------------------------------------------------'
      );
      throw err;
    } else {
      logger.warn(
        'MongoDB connection unavailable. Server running with fallback in-memory state for dev API requests.'
      );
      return null;
    }
  }
};

module.exports = connectDB;
