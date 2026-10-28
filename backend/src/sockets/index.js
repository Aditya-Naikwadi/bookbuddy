const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const socketAuth = require('./socketAuth');
const { events, createEventPayload } = require('./events');
const logger = require('../utils/logger');
const config = require('../config');

let io;
let redisPubClient = null;

// Ring buffer for reconnect resync (stores last 500 events across rooms for up to 10 minutes)
const RESYNC_BUFFER_MAX = 500;
const RESYNC_BUFFER_TTL_MS = 10 * 60 * 1000;
const eventBuffer = [];

const recordEvent = (room, event, payload, timestamp = Date.now()) => {
  eventBuffer.push({ room, event, payload, timestamp });
  if (eventBuffer.length > RESYNC_BUFFER_MAX) {
    eventBuffer.shift();
  }
};

const getMissedEvents = (userRooms, lastSeenAtMs) => {
  const minTime = Date.now() - RESYNC_BUFFER_TTL_MS;
  const cutoff = Math.max(lastSeenAtMs || 0, minTime);
  const roomSet = new Set(userRooms);

  return eventBuffer
    .filter((entry) => entry.timestamp > cutoff && roomSet.has(entry.room))
    .map((entry) => ({
      room: entry.room,
      event: entry.event,
      payload: entry.payload,
      timestamp: entry.timestamp,
    }));
};

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
  const enableRedisAdapter =
    config.socketIoRedisAdapterEnabled !== undefined
      ? config.socketIoRedisAdapterEnabled
      : process.env.SOCKET_IO_REDIS_ADAPTER_ENABLED !== 'false';

  if (enableRedisAdapter && redisUrl && process.env.NODE_ENV !== 'test') {
    try {
      redisPubClient = new Redis(redisUrl, { lazyConnect: false });
      const subClient = redisPubClient.duplicate();
      io.adapter(createAdapter(redisPubClient, subClient));
      logger.info('Socket.io Redis adapter initialized for multi-instance pub/sub broadcasting.');
    } catch (adapterErr) {
      logger.warn(
        'Failed to initialize Socket.io Redis adapter; falling back to single-instance adapter.',
        adapterErr
      );
    }
  } else {
    logger.info('Socket.io running with default in-memory adapter (single-instance mode).');
  }

  // Attach authentication middleware
  io.use(socketAuth);

  io.on('connection', (socket) => {
    const user = socket.data?.user || {};
    const userId = user.id;
    const collegeId = user.collegeId ? String(user.collegeId) : null;
    const role = user.role;
    logger.info(
      `Socket connected: ${socket.id} for user: ${userId} (role: ${role}, college: ${collegeId})`
    );

    // 1. Join user-specific room
    if (userId) {
      socket.join(`user:${userId}`);
    }

    // 2. Join college-specific room and role-specific room if tenant-scoped
    if (collegeId) {
      socket.join(`college:${collegeId}`);
      if (role) {
        socket.join(`role:${collegeId}:${role}`);
      }
    }

    // 3. Join super-admin room if user has super-admin role
    if (role === 'super-admin') {
      socket.join('room:super-admin');
    }

    // 4. Explicit cross-college subscription (never auto-joined)
    socket.on('subscribe:cross-college', () => {
      socket.join('cross-college:public');
      socket.emit('subscribed:cross-college', { success: true });
    });

    socket.on('unsubscribe:cross-college', () => {
      socket.leave('cross-college:public');
      socket.emit('unsubscribed:cross-college', { success: true });
    });

    // 5. Room join security guard: reject any attempt to join rooms for other colleges
    socket.on('join:room', (roomName, callback) => {
      if (!roomName || typeof roomName !== 'string') return;

      // Allow public cross-college room
      if (roomName === 'cross-college:public') {
        socket.join(roomName);
        if (callback) callback({ success: true, room: roomName });
        return;
      }

      // Check college or role prefix
      const collegePrefixMatch = roomName.match(/^(?:college|role):([^:]+)/);
      if (collegePrefixMatch) {
        const targetCollegeId = collegePrefixMatch[1];
        if (!collegeId || String(targetCollegeId) !== String(collegeId)) {
          logger.warn(
            `Security violation: User ${userId} attempted to join unauthorized room ${roomName}`
          );
          socket.emit('error', { message: 'Unauthorized room join for another college' });
          if (callback)
            callback({ success: false, error: 'Unauthorized room join for another college' });
          return;
        }
      }

      // Allow own user room or authorized college rooms
      if (
        roomName === `user:${userId}` ||
        (collegeId && roomName.startsWith(`college:${collegeId}`)) ||
        (collegeId && roomName.startsWith(`role:${collegeId}:`))
      ) {
        socket.join(roomName);
        if (callback) callback({ success: true, room: roomName });
      } else {
        socket.emit('error', { message: 'Unauthorized room join' });
        if (callback) callback({ success: false, error: 'Unauthorized room join' });
      }
    });

    // 6. Reconnect resync support
    socket.on('resync', ({ lastSeenAt } = {}, callback) => {
      const lastSeenAtMs = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
      const userRooms = Array.from(socket.rooms);
      const missedEvents = getMissedEvents(userRooms, lastSeenAtMs);

      logger.info(
        `Resync requested by socket ${socket.id} (lastSeenAt: ${lastSeenAt}) -> found ${missedEvents.length} missed events.`
      );

      if (typeof callback === 'function') {
        callback({ success: true, events: missedEvents });
      } else {
        socket.emit('resync:events', { events: missedEvents });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} for user: ${userId} (${reason})`);
      socket.removeAllListeners();
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

/**
 * Unified real-time event emitter.
 * Broadcasts to specified rooms via Redis adapter, and stores in the resync buffer.
 *
 * @param {Object} options
 * @param {string} options.event - Canonical entity:action name
 * @param {string|string[]} options.rooms - Target room or array of rooms
 * @param {string} options.entityId - Primary identifier of changed resource
 * @param {string} [options.collegeId] - Tenant ID
 * @param {Object} [options.changed] - Key-value map of updated attributes
 * @param {string|Date} [options.updatedAt] - ISO timestamp
 * @param {Object} [options.payload] - Optional raw payload overrides
 */
const emitRealtimeEvent = ({
  event,
  rooms = [],
  entityId,
  collegeId,
  changed = {},
  updatedAt = new Date().toISOString(),
  payload = {},
}) => {
  if (!io) return;
  const targetRooms = Array.isArray(rooms) ? rooms.filter(Boolean) : [rooms].filter(Boolean);
  if (targetRooms.length === 0) return;

  const standardPayload = createEventPayload({
    entityId: entityId || payload.entityId,
    collegeId: collegeId || payload.collegeId,
    updatedAt: updatedAt || payload.updatedAt,
    changed: changed || payload.changed,
    ...payload,
  });

  const now = Date.now();
  targetRooms.forEach((room) => {
    recordEvent(room, event, standardPayload, now);
    io.to(room).emit(event, standardPayload);
  });
};

// === Convenience Emitters (Strictly Called from afterCommitFn) ===

const emitLoanCheckout = (collegeId, data) => {
  const entityId = data.loanId || data._id;
  const bookId = data.bookId;
  const userId = data.userId;
  const rooms = [
    collegeId ? `college:${collegeId}` : null,
    collegeId ? `role:${collegeId}:librarian` : null,
    userId ? `user:${userId}` : null,
  ].filter(Boolean);

  emitRealtimeEvent({
    event: events.LOAN_ISSUED,
    rooms,
    entityId,
    collegeId,
    changed: { status: 'active', copiesAvailable: data.copiesAvailable, bookId },
    payload: data,
  });

  // Also emit legacy name for backward compatibility
  if (collegeId && io) {
    io.to(`college:${collegeId}`).emit(events.LOAN_CHECKOUT, data);
  }
};

const emitLoanReturn = (collegeId, data) => {
  const entityId = data.loanId || data._id;
  const bookId = data.bookId;
  const userId = data.userId;
  const rooms = [
    collegeId ? `college:${collegeId}` : null,
    collegeId ? `role:${collegeId}:librarian` : null,
    userId ? `user:${userId}` : null,
  ].filter(Boolean);

  emitRealtimeEvent({
    event: events.LOAN_RETURNED,
    rooms,
    entityId,
    collegeId,
    changed: { status: 'returned', copiesAvailable: data.copiesAvailable, bookId },
    payload: data,
  });

  if (collegeId && io) {
    io.to(`college:${collegeId}`).emit(events.LOAN_RETURN, data);
  }
};

const emitReservationReady = (userId, data) => {
  const entityId = data.reservationId || data._id;
  const collegeId = data.collegeId;
  const rooms = [
    userId ? `user:${userId}` : null,
    collegeId ? `role:${collegeId}:librarian` : null,
  ].filter(Boolean);

  emitRealtimeEvent({
    event: events.RESERVATION_READY,
    rooms,
    entityId,
    collegeId,
    changed: { status: 'ready_for_pickup', expiresAt: data.expiresAt, bookTitle: data.bookTitle },
    payload: data,
  });
};

const emitNotification = (userId, notification) => {
  if (io && userId) {
    const payload = {
      _id: notification._id,
      type: notification.type,
      message: notification.message,
      read: notification.read,
      createdAt: notification.createdAt,
    };
    emitRealtimeEvent({
      event: events.NOTIFICATION_NEW,
      rooms: [`user:${userId}`],
      entityId: notification._id,
      changed: { unread: true },
      payload,
    });
  }
};

const emitStreakUpdate = (userId, streak) => {
  if (io && userId) {
    const streakData = streak && typeof streak.toObject === 'function' ? streak.toObject() : streak;
    emitRealtimeEvent({
      event: events.STREAK_UPDATED,
      rooms: [`user:${userId}`],
      entityId: userId,
      changed: {
        currentStreak: streakData?.currentStreak || 0,
        maxStreak: streakData?.maxStreak || 0,
        freezesAvailable: streakData?.freezesAvailable ?? 2,
      },
      payload: {
        currentStreak: streakData?.currentStreak || 0,
        maxStreak: streakData?.maxStreak || 0,
        freezesAvailable: streakData?.freezesAvailable ?? 2,
      },
    });
  }
};

const emitCollegeBroadcast = (collegeId, eventName, data) => {
  if (io && collegeId) {
    io.to(`college:${collegeId}`).emit(eventName, data);
  }
};

const isUserConnected = (userId) => {
  if (!io || !io.sockets || !io.sockets.adapter || !io.sockets.adapter.rooms) return false;
  const room = io.sockets.adapter.rooms.get(`user:${userId}`);
  return !!(room && room.size > 0);
};

module.exports = {
  initSockets,
  getIo,
  isUserConnected,
  emitRealtimeEvent,
  emitCollegeBroadcast,
  emitNotification,
  emitStreakUpdate,
  emitLoanCheckout,
  emitLoanReturn,
  emitReservationReady,
  events,
};
