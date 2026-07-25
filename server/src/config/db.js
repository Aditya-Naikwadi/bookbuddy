// Database connection manager with retry logic and event logging.
const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

// Set strictQuery rule
mongoose.set('strictQuery', true);

const connectDB = async () => {
  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    serverApi: {
      version: '1',
      strict: true,
      deprecationErrors: true,
    },
  };

  let retries = 5;
  let delay = 1000; // start with 1 second

  while (retries > 0) {
    try {
      logger.info('Attempting MongoDB connection...');
      await mongoose.connect(config.mongoUri, options);
      return;
    } catch (err) {
      retries -= 1;
      logger.error(`MongoDB connection failed: ${err.message}. Retries remaining: ${retries}`);
      if (retries === 0) {
        logger.error('Fatal: MongoDB connection retries exhausted. Exiting process.');
        process.exit(1);
      }
      // Wait with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
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
