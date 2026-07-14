const { Server } = require('socket.io');
const socketAuth = require('./socketAuth');
const events = require('./events');
const logger = require('../utils/logger');

let io;

const initSockets = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Attach authentication middleware
  io.use(socketAuth);

  io.on('connection', (socket) => {
    const userId = socket.data.user.id;
    logger.info(`Socket connected: ${socket.id} for user: ${userId}`);

    // Automatically join the user-specific room
    socket.join(`user:${userId}`);
    logger.info(`User ${userId} joined room user:${userId}`);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id} for user: ${userId}`);
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

const emitNotification = (userId, notification) => {
  if (io) {
    io.to(`user:${userId}`).emit(events.NOTIFICATION_NEW, {
      _id: notification._id,
      type: notification.type,
      message: notification.message,
      read: notification.read,
      createdAt: notification.createdAt,
    });
  }
};

const emitStreakUpdate = (userId, streak) => {
  if (io) {
    io.to(`user:${userId}`).emit(events.STREAK_UPDATED, {
      currentStreak: streak.currentStreak,
      maxStreak: streak.maxStreak,
      freezesAvailable: streak.freezesAvailable,
    });
  }
};

module.exports = {
  initSockets,
  getIo,
  emitNotification,
  emitStreakUpdate,
};
