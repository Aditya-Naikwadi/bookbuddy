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

    // Join super-admin room if user has super-admin role
    if (socket.data.user.role === 'super-admin') {
      socket.join('room:super-admin');
      logger.info(`Super-admin ${userId} joined room:super-admin`);
    }

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

const emitComplaintUpdate = (userId, complaint) => {
  if (io) {
    const payload = complaint.toObject ? complaint.toObject() : complaint;
    io.to(`user:${userId}`).emit('complaint:updated', payload);
    io.to(`user:${userId}`).emit('ticket:updated', payload);
    io.to('room:super-admin').emit('ticket:escalated', payload);
  }
};

const emitSuperAdminSecurityAlert = (alertData) => {
  if (io) {
    io.to('room:super-admin').emit('security:alert', alertData);
  }
};

const emitSuperAdminSupportEscalation = (ticketData) => {
  if (io) {
    io.to('room:super-admin').emit('ticket:escalated', ticketData);
  }
};

module.exports = {
  initSockets,
  getIo,
  emitNotification,
  emitStreakUpdate,
  emitComplaintUpdate,
  emitSuperAdminSecurityAlert,
  emitSuperAdminSupportEscalation,
};

