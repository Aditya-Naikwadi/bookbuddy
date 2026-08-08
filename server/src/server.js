// Server entry point managing database connection, lifecycles, and graceful shutdowns.
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const config = require('./config');
const logger = require('./utils/logger');
const { initSockets } = require('./sockets');
const { initCronJobs } = require('./services/cronService');
const mongoose = require('mongoose');

const { initSentry, captureException } = require('./utils/sentry');

// Handle uncaught exceptions immediately at boot
process.on('uncaughtException', (err) => {
  captureException(err, { context: 'uncaughtException' });
  // eslint-disable-next-line no-console
  console.error(`UNCAUGHT EXCEPTION: ${err.message}\n`, err.stack);
  process.exit(1);
});

let serverInstance;

// Graceful Shutdown implementation
const shutdownGracefully = (signal) => {
  logger.warn(`Received ${signal}. Starting graceful shutdown...`);

  if (serverInstance) {
    serverInstance.close(async () => {
      logger.info('HTTP server closed.');

      try {
        await mongoose.connection.close();
        logger.info('Mongoose connection closed successfully.');
        logger.info('Graceful shutdown completed. Exiting process.');
        process.exit(0);
      } catch (err) {
        logger.error(`Error during connection closure: ${err.message}`);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};

const startServer = async () => {
  // Initialize Sentry SDK
  initSentry();

  // 1. Connect to Database FIRST before serving traffic or running cron tasks
  try {
    await connectDB();
  } catch (err) {
    logger.error(`FATAL: Database connection failed on startup: ${err.message}`, {
      stack: err.stack,
    });
    captureException(err, { context: 'serverStartup' });
    process.exit(1);
  }

  // 2. Create HTTP Server & Setup Socket.io
  const server = http.createServer(app);
  const io = initSockets(server);
  app.set('io', io);

  // 3. Start listening for HTTP traffic
  serverInstance = server.listen(config.port, () => {
    logger.info(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
  });

  // 4. Initialize background Cron Tasks AFTER database connection is confirmed
  initCronJobs();

  // Handle unhandled promise rejections as safety net
  process.on('unhandledRejection', (err) => {
    logger.error(`UNHANDLED REJECTION: ${err ? err.message || err : 'Unknown rejection'}`, {
      stack: err ? err.stack : undefined,
    });
    captureException(err, { context: 'unhandledRejection' });
  });
};

// Listen for termination signals
process.on('SIGINT', () => shutdownGracefully('SIGINT'));
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));

// Boot the server
startServer();
