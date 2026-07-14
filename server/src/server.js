// Handle uncaught exceptions first
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

const http = require('http');
const dotenv = require('dotenv');
const app = require('./app');
const connectDB = require('./config/db');

// Load env vars
dotenv.config({ path: require('path').join(__dirname, '../.env') });

// Connect to database
connectDB();

const { initSockets } = require('./sockets');

const server = http.createServer(app);

// Setup Socket.io
const io = initSockets(server);

// Attach socket io to app so routes can access it if needed
app.set('io', io);

// Initialize Cron Jobs
const initCronJobs = require('./services/cronService');
initCronJobs();

const PORT = process.env.PORT || 5000;

const serverInstance = server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message, err.stack);
  serverInstance.close(() => {
    process.exit(1);
  });
});
