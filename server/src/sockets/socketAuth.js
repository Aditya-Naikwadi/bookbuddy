const { verifyAccessToken } = require('../utils/token');
const User = require('../models/User');

const activeAnonymousConnections = new Map();
const handshakeAttempts = new Map();

const MAX_ANONYMOUS_SOCKETS_PER_IP = 50; // Increased for shared campus NAT networks
const MAX_HANDSHAKES_PER_MINUTE = 30;

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const isAnonymousRequest = socket.handshake.auth?.isAnonymous || !token;

    // Track client IP
    const clientIp =
      socket.handshake.address || socket.request.socket?.remoteAddress || 'unknown-ip';

    if (isAnonymousRequest) {
      // Sliding window connection attempt rate limiting
      const now = Date.now();
      const attempts = (handshakeAttempts.get(clientIp) || []).filter(
        (timestamp) => now - timestamp < 60000
      );

      if (attempts.length >= MAX_HANDSHAKES_PER_MINUTE) {
        return next(
          new Error('Rate limit exceeded: Too many socket connection attempts per minute per IP')
        );
      }

      attempts.push(now);
      handshakeAttempts.set(clientIp, attempts);

      // Concurrent connection limit
      const currentIpConns = activeAnonymousConnections.get(clientIp) || 0;
      if (currentIpConns >= MAX_ANONYMOUS_SOCKETS_PER_IP) {
        return next(
          new Error('Rate limit exceeded: Maximum anonymous socket connections reached per IP')
        );
      }

      activeAnonymousConnections.set(clientIp, currentIpConns + 1);

      socket.data.user = {
        id: `anon_${clientIp.replace(/[^a-zA-Z0-9]/g, '_')}`,
        role: 'anonymous',
        isAnonymous: true,
        ip: clientIp,
      };

      socket.on('disconnect', () => {
        const count = activeAnonymousConnections.get(clientIp) || 1;
        if (count <= 1) {
          activeAnonymousConnections.delete(clientIp);
        } else {
          activeAnonymousConnections.set(clientIp, count - 1);
        }
      });

      return next();
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return next(new Error('Invalid or expired authentication token'));
    }

    // Verify user exists and is active in the database
    const user = await User.findById(decoded.sub).select('isActive');
    if (!user) {
      return next(new Error('User belonging to this token no longer exists'));
    }

    if (!user.isActive) {
      return next(new Error('Account has been deactivated'));
    }

    // Attach user information to socket data
    socket.data.user = {
      id: decoded.sub,
      role: decoded.role,
      collegeId: decoded.collegeId,
      isAnonymous: false,
    };

    next();
  } catch {
    next(new Error('Internal server error during socket authentication'));
  }
};

module.exports = socketAuth;
