const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const app = require('./app');
const connectDB = require('./config/db');

// Load env vars
dotenv.config({ path: '../.env' }); // adjusted for server/.env if needed, better to put .env in server root and run from server root

// Connect to database
connectDB();

const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('join_user', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`User ${userId} joined room user:${userId}`);
  });

  socket.on('join_book', (bookId) => {
    socket.join(`book:${bookId}`);
    console.log(`Joined book room book:${bookId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Attach socket io to app so routes can access it if needed
app.set('io', io);

// Initialize Cron Jobs
const initCronJobs = require('./services/cronService');
initCronJobs();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
