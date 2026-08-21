const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');
const { generateTokenPair, hashToken } = require('../utils/token');
const cacheHelper = require('../utils/cacheHelper');
const AppError = require('../utils/AppError');
const mongoose = require('mongoose');

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 Days
const ROTATION_GRACE_PERIOD_MS =
  process.env.ROTATION_GRACE_PERIOD_MS !== undefined
    ? Number(process.env.ROTATION_GRACE_PERIOD_MS)
    : process.env.NODE_ENV === 'test'
      ? 0
      : 30 * 1000; // 30 Seconds Grace Period in prod/dev

/**
 * Creates a new session record in Redis with audit fallback to MongoDB
 */
const createSession = async ({ user, deviceInfo = 'Web Browser', parentTokenId = null }) => {
  const { accessToken, refreshToken, hash } = generateTokenPair(user);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const tokenId = new mongoose.Types.ObjectId().toString();

  const sessionData = {
    tokenId,
    userId: user._id.toString(),
    collegeId: user.collegeId ? user.collegeId.toString() : null,
    deviceInfo,
    issuedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    revoked: false,
    parentTokenId,
    refreshToken,
  };

  // 1. Store in Redis
  const redisKey = `session:${hash}`;
  await cacheHelper.set(redisKey, sessionData, SESSION_TTL_SECONDS);

  // 2. Audit Trail Record in MongoDB
  await RefreshToken.create({
    _id: tokenId,
    userId: user._id,
    tokenHash: hash,
    deviceInfo,
    parentTokenId,
    expiresAt,
  });

  return { accessToken, refreshToken, hash, sessionData };
};

/**
 * Resolves an active session by token hash
 */
const getSessionByHash = async (hash) => {
  if (!hash) return null;
  const redisKey = `session:${hash}`;

  // Check Redis
  const cachedSession = await cacheHelper.get(redisKey);
  if (cachedSession) {
    return { session: cachedSession, hash };
  }

  // Fallback to MongoDB
  const mongoToken = await RefreshToken.findOne({ tokenHash: hash }).select('+tokenHash').lean();
  if (!mongoToken) return null;

  const session = {
    tokenId: mongoToken._id.toString(),
    userId: mongoToken.userId.toString(),
    collegeId: mongoToken.collegeId ? mongoToken.collegeId.toString() : null,
    deviceInfo: mongoToken.deviceInfo || 'Unknown Device',
    issuedAt: mongoToken.createdAt ? mongoToken.createdAt.toISOString() : new Date().toISOString(),
    expiresAt: mongoToken.expiresAt.toISOString(),
    revoked: Boolean(mongoToken.revokedAt),
    revokedAt: mongoToken.revokedAt ? mongoToken.revokedAt.toISOString() : null,
    parentTokenId: mongoToken.parentTokenId || null,
    replacedBy: mongoToken.replacedBy || null,
  };

  return { session, hash };
};

/**
 * Resolves an active session from Redis or MongoDB fallback
 */
const getSession = async (refreshToken) => {
  if (!refreshToken) return null;
  const hash = hashToken(refreshToken);
  return getSessionByHash(hash);
};

/**
 * Rotates a refresh token session with Theft Reuse Detection and Grace Period
 */
const rotateSession = async (refreshToken, deviceInfo = 'Web Browser') => {
  const result = await getSession(refreshToken);
  if (!result || !result.session) {
    throw new AppError('Invalid or expired refresh token session.', 401);
  }

  const { session: existingSession, hash: clientHash } = result;

  // REUSE DETECTION: If token was already revoked or replaced, check grace period first!
  if (existingSession.revoked || existingSession.replacedBy) {
    const revokedAtMs = existingSession.revokedAt
      ? new Date(existingSession.revokedAt).getTime()
      : 0;
    const timeSinceRevocation = Date.now() - revokedAtMs;

    if (
      revokedAtMs > 0 &&
      timeSinceRevocation < ROTATION_GRACE_PERIOD_MS &&
      existingSession.replacedBy
    ) {
      // Parallel request within grace period: Return the replacement active session token
      const replacementResult = await getSessionByHash(existingSession.replacedBy);
      if (replacementResult && replacementResult.session && !replacementResult.session.revoked) {
        const user = await User.findById(replacementResult.session.userId).select('+isActive');
        if (user && user.isActive) {
          const { accessToken } = generateTokenPair(user);
          return {
            accessToken,
            refreshToken: replacementResult.session.refreshToken || refreshToken,
            user: {
              _id: user._id,
              studentId: user.studentId,
              name: user.name,
              email: user.email,
              role: user.role,
              collegeId: user.collegeId,
            },
          };
        }
      }
    }

    // Token reused OUTSIDE grace period -> Theft detected! Revoke all sessions for safety.
    await revokeAllSessionsForUser(existingSession.userId);
    throw new AppError(
      'Security Warning: Session reuse detected. All sessions revoked for safety.',
      401
    );
  }

  // Check Expiration
  if (new Date(existingSession.expiresAt) < new Date()) {
    await revokeSession(refreshToken);
    throw new AppError('Refresh token session has expired. Please log in again.', 401);
  }

  // Fetch active user
  const user = await User.findById(existingSession.userId).select('+isActive');
  if (!user || !user.isActive) {
    await revokeSession(refreshToken);
    throw new AppError('User is deactivated or no longer exists.', 401);
  }

  // Generate new rotated session
  const newSession = await createSession({
    user,
    deviceInfo,
    parentTokenId: existingSession.tokenId,
  });

  // Mark old session as revoked & replaced with timestamp
  const now = new Date();
  existingSession.revoked = true;
  existingSession.replacedBy = newSession.hash;
  existingSession.revokedAt = now.toISOString();
  await cacheHelper.set(`session:${clientHash}`, existingSession, 3600); // keep short TTL record for reuse detection

  await RefreshToken.updateOne(
    { tokenHash: clientHash },
    { revokedAt: now, replacedBy: newSession.hash }
  );

  return {
    accessToken: newSession.accessToken,
    refreshToken: newSession.refreshToken,
    user: {
      _id: user._id,
      studentId: user.studentId,
      name: user.name,
      email: user.email,
      role: user.role,
      collegeId: user.collegeId,
    },
  };
};

/**
 * Revokes a single session
 */
const revokeSession = async (refreshToken) => {
  if (!refreshToken) return;
  const hash = hashToken(refreshToken);
  const redisKey = `session:${hash}`;

  const cached = await cacheHelper.get(redisKey);
  if (cached) {
    cached.revoked = true;
    await cacheHelper.set(redisKey, cached, 3600);
  }

  await RefreshToken.updateOne({ tokenHash: hash }, { revokedAt: new Date() });
};

/**
 * Revokes all sessions for a user (across all devices / theft mitigation)
 */
const revokeAllSessionsForUser = async (userId) => {
  if (!userId) return;
  const userIdStr = String(userId);

  // Revoke in Mongo
  await RefreshToken.updateMany({ userId: userIdStr, revokedAt: null }, { revokedAt: new Date() });

  // Invalidate Redis session keys matching user
  try {
    const mongoTokens = await RefreshToken.find({ userId: userIdStr }).select('tokenHash').lean();
    for (const t of mongoTokens) {
      if (t.tokenHash) {
        await cacheHelper.del(`session:${t.tokenHash}`);
      }
    }
  } catch {
    // Non-blocking
  }
};

module.exports = {
  createSession,
  getSession,
  rotateSession,
  revokeSession,
  revokeAllSessionsForUser,
  SESSION_TTL_SECONDS,
};
