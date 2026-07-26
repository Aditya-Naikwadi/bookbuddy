// Database connection manager with retry logic and event logging.
const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

// Set strictQuery rule
mongoose.set('strictQuery', true);

const connectDB = async () => {
  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    tlsAllowInvalidCertificates: true,
  };

  const primaryUri = config.mongoUri;
  const fallbackUris = [
    'mongodb://127.0.0.1:27017/bookbuddy',
    'mongodb://localhost:27017/bookbuddy',
  ];

  const targetUris = Array.from(new Set([primaryUri, ...fallbackUris])).filter(Boolean);

  for (const uri of targetUris) {
    try {
      const sanitizedUri = uri.includes('@') ? uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : uri;
      logger.info(`Attempting MongoDB connection to ${sanitizedUri}...`);
      await mongoose.connect(uri, options);
      logger.info('MongoDB connected successfully.');
      return;
    } catch (err) {
      const displayHost = uri.includes('@') ? uri.split('@')[1] : uri;
      logger.warn(`MongoDB connection to ${displayHost} failed: ${err.message}`);
    }
  }

  logger.warn(
    'MongoDB connection unavailable. Server running with fallback in-memory state for dev API requests.'
  );
};

// Monitor connection events
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connection status: Connected.');
});

mongoose.connection.on('error', (err) => {
  logger.error(`Mongoose connection status: Error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose connection status: Disconnected.');
});

module.exports = connectDB;
