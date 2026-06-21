const { Server } = require('socket.io');

let io;

const initSockets = (server) => {
  io = new Server(server, {
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

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

const emitAvailabilityUpdate = (bookId, payload) => {
  if (io) {
    io.to(`book:${bookId}`).emit('availability:update', payload);
  }
};

const emitNotification = (userId, payload) => {
  if (io) {
    io.to(`user:${userId}`).emit('notification:new', payload);
  }
};

module.exports = {
  initSockets,
  getIo,
  emitAvailabilityUpdate,
  emitNotification
};
