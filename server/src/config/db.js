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
  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    tlsAllowInvalidCertificates: true,
  };

  const isProd = config.nodeEnv === 'production' || !!process.env.RENDER;
  const primaryUri = config.mongoUri;
  const fallbackUris = isProd
    ? []
    : ['mongodb://127.0.0.1:27017/bookbuddy', 'mongodb://localhost:27017/bookbuddy'];

  const targetUris = Array.from(new Set([primaryUri, ...fallbackUris])).filter(Boolean);

  let lastError = null;
  for (const uri of targetUris) {
    try {
      const sanitizedUri = uri.includes('@') ? uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : uri;
      logger.info(`Attempting MongoDB connection to ${sanitizedUri}...`);
      await mongoose.connect(uri, options);
      logger.info('MongoDB connected successfully.');
      return;
    } catch (err) {
      lastError = err;
      const displayHost = uri.includes('@') ? uri.split('@')[1] : uri;
      logger.error(`MongoDB connection to ${displayHost} failed: ${err.message}`);
    }
  }

  if (isProd) {
    throw new Error(
      `Fatal: Could not connect to MongoDB in production: ${lastError ? lastError.message : 'Unknown error'}`
    );
  } else {
    logger.warn(
      'MongoDB connection unavailable. Server running with fallback in-memory state for dev API requests.'
    );
  }
};

module.exports = connectDB;
