const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
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
    transports: ['websocket', 'polling'],
  });

  // Attach Redis Adapter for cross-instance pub/sub broadcasting in multi-node clusters
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && process.env.NODE_ENV !== 'test') {
    try {
      const pubClient = new Redis(redisUrl, { lazyConnect: false });
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.io Redis adapter initialized for multi-instance pub/sub broadcasting.');
    } catch (adapterErr) {
      logger.warn(
        'Failed to initialize Socket.io Redis adapter; falling back to single-instance adapter.',
        adapterErr
      );
    }
  }

  // Attach authentication middleware
  io.use(socketAuth);

  io.on('connection', (socket) => {
    const userId = socket.data.user.id;
    const collegeId = socket.data.user.collegeId;
    logger.info(`Socket connected: ${socket.id} for user: ${userId}`);

    // Automatically join the user-specific room
    socket.join(`user:${userId}`);
    logger.info(`User ${userId} joined room user:${userId}`);

    // Automatically join the college-specific room if authenticated session has collegeId
    if (collegeId) {
      socket.join(`college:${collegeId}`);
      logger.info(`User ${userId} joined room college:${collegeId}`);
    }

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

const emitCollegeBroadcast = (collegeId, eventName, data) => {
  if (io && collegeId) {
    io.to(`college:${collegeId}`).emit(eventName, data);
  }
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

const emitAnnotationUpsert = (userId, annotation) => {
  if (io && userId) {
    io.to(`user:${userId}`).emit('annotation:upserted', annotation);
  }
};

const emitAnnotationDelete = (userId, annotationId, bookId) => {
  if (io && userId) {
    io.to(`user:${userId}`).emit('annotation:deleted', { annotationId, bookId });
  }
};

const isUserConnected = (userId) => {
  if (!io || !io.sockets || !io.sockets.adapter || !io.sockets.adapter.rooms) return false;
  const room = io.sockets.adapter.rooms.get(`user:${userId}`);
  return !!(room && room.size > 0);
};

// === ILS Real-Time Emitters ===

const emitLoanCheckout = (collegeId, data) => {
  if (io && collegeId) {
    io.to(`college:${collegeId}`).emit(events.LOAN_CHECKOUT, data);
  }
};

const emitLoanReturn = (collegeId, data) => {
  if (io && collegeId) {
    io.to(`college:${collegeId}`).emit(events.LOAN_RETURN, data);
  }
};

const emitReservationCreated = (collegeId, data) => {
  if (io && collegeId) {
    io.to(`college:${collegeId}`).emit(events.RESERVATION_CREATED, data);
  }
};

const emitReservationReady = (userId, data) => {
  if (io && userId) {
    io.to(`user:${userId}`).emit(events.RESERVATION_READY, data);
  }
};

const emitAcquisitionUpdated = (collegeId, data) => {
  if (io && collegeId) {
    io.to(`college:${collegeId}`).emit(events.ACQUISITION_UPDATED, data);
  }
};

module.exports = {
  initSockets,
  getIo,
  isUserConnected,
  emitCollegeBroadcast,
  emitNotification,
  emitStreakUpdate,
  emitComplaintUpdate,
  emitSuperAdminSecurityAlert,
  emitSuperAdminSupportEscalation,
  emitAnnotationUpsert,
  emitAnnotationDelete,
  emitLoanCheckout,
  emitLoanReturn,
  emitReservationCreated,
  emitReservationReady,
  emitAcquisitionUpdated,
};
