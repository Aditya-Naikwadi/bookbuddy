const http = require('http');
const dotenv = require('dotenv');
const app = require('./app');
const connectDB = require('./config/db');

// Load env vars
dotenv.config({ path: '../.env' }); // adjusted for server/.env if needed, better to put .env in server root and run from server root

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

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
