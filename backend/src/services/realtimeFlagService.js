const CollegeFeatureConfig = require('../models/CollegeFeatureConfig');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');
const redisHelper = require('../utils/redisCache');

// In-memory cache to guarantee < 30 s propagation without redeploy
const localCache = new Map();
const CACHE_TTL_MS = 15000; // 15 seconds

/**
 * Get the effective real-time mode for a college or global
 * @param {string|mongoose.Types.ObjectId} [collegeId]
 * @returns {Promise<'on'|'off'|'polling_only'>}
 */
const getRealtimeMode = async (collegeId) => {
  const now = Date.now();

  // 1. Check Global Override First
  const globalCached = localCache.get('global');
  if (globalCached && now - globalCached.timestamp < CACHE_TTL_MS) {
    if (globalCached.mode === 'off' || globalCached.mode === 'polling_only') {
      return globalCached.mode;
    }
  } else {
    try {
      const globalRedis = await redisHelper.getCache('config:global:realtime_mode');
      if (globalRedis) {
        localCache.set('global', { mode: globalRedis, timestamp: now });
        if (globalRedis === 'off' || globalRedis === 'polling_only') {
          return globalRedis;
        }
      }
    } catch (err) {
      logger.warn(`Redis lookup failed for global realtime_mode: ${err.message}`);
    }
  }

  if (!collegeId) {
    return 'on';
  }

  const strCollegeId = collegeId.toString();

  // 2. Check Local Memory Cache for College
  const collegeCached = localCache.get(strCollegeId);
  if (collegeCached && now - collegeCached.timestamp < CACHE_TTL_MS) {
    return collegeCached.mode;
  }

  // 3. Check Redis for College
  try {
    const redisMode = await redisHelper.getCache(`config:college:${strCollegeId}:realtime_mode`);
    if (redisMode) {
      localCache.set(strCollegeId, { mode: redisMode, timestamp: now });
      return redisMode;
    }
  } catch (err) {
    logger.warn(`Redis lookup failed for college realtime_mode: ${err.message}`);
  }

  // 4. Fallback to MongoDB Query
  try {
    const config = await CollegeFeatureConfig.findOne({ collegeId: strCollegeId })
      .select('realtimeMode')
      .lean();
    const mode = config?.realtimeMode || 'on';

    localCache.set(strCollegeId, { mode, timestamp: now });

    // Cache to Redis with 30s TTL
    try {
      await redisHelper.setCache(`config:college:${strCollegeId}:realtime_mode`, mode, 30);
    } catch {
      // Ignore non-fatal Redis caching failure
    }

    return mode;
  } catch (err) {
    logger.error(`Error querying CollegeFeatureConfig for realtimeMode: ${err.message}`);
    return 'on'; // Fail open safely
  }
};

/**
 * Set real-time mode with audit logging, cache invalidation, and socket notification
 * @param {Object} params
 * @param {string} [params.collegeId]
 * @param {'on'|'off'|'polling_only'} params.mode
 * @param {boolean} [params.isGlobal]
 * @param {Object} [params.user]
 * @param {string} [params.ip]
 */
const setRealtimeMode = async ({
  collegeId,
  mode,
  isGlobal = false,
  user = {},
  ip = '127.0.0.1',
}) => {
  if (!['on', 'off', 'polling_only'].includes(mode)) {
    throw new Error('Invalid real-time mode. Allowed values: on, off, polling_only');
  }

  const { getIo } = require('../sockets');
  let io = null;
  try {
    io = getIo ? getIo() : null;
  } catch {
    // Non-blocking in standalone CLI context where socket server is not bound
  }

  if (isGlobal) {
    // 1. Update Global Redis & Local Cache
    localCache.set('global', { mode, timestamp: Date.now() });
    try {
      await redisHelper.setCache('config:global:realtime_mode', mode, 86400);
    } catch (err) {
      logger.warn(`Failed to set global realtime_mode in Redis: ${err.message}`);
    }

    // 2. Audit Log
    await AuditLog.create({
      actorId: user._id || user.id,
      actorRole: user.role || 'superadmin',
      action: 'GLOBAL_REALTIME_MODE_UPDATED',
      targetType: 'SystemConfig',
      metadata: { newMode: mode, isGlobal: true },
      severity: mode === 'off' ? 'warning' : 'info',
      ipAddress: ip,
    }).catch(() => {});

    // 3. Socket broadcast/disconnect
    if (io) {
      if (mode !== 'on') {
        io.emit('system:realtime_paused', { mode, isGlobal: true });
      } else {
        io.emit('system:realtime_resumed', { mode, isGlobal: true });
      }
    }

    logger.info(
      `[KillSwitch] Global real-time mode flipped to: ${mode} by ${user.email || user.id || 'system'}`
    );
    return { isGlobal: true, mode };
  }

  if (!collegeId) {
    throw new Error('collegeId is required for per-college real-time mode configuration');
  }

  const strCollegeId = collegeId.toString();

  // 1. Fetch old mode for audit comparison
  let config = await CollegeFeatureConfig.findOne({ collegeId: strCollegeId });
  const previousMode = config?.realtimeMode || 'on';

  if (!config) {
    config = new CollegeFeatureConfig({
      collegeId: strCollegeId,
      realtimeMode: mode,
    });
  } else {
    config.realtimeMode = mode;
  }
  await config.save();

  // 2. Invalidate Local & Redis Cache
  localCache.set(strCollegeId, { mode, timestamp: Date.now() });
  try {
    await redisHelper.setCache(`config:college:${strCollegeId}:realtime_mode`, mode, 60);
  } catch (err) {
    logger.warn(`Failed to set college realtime_mode in Redis: ${err.message}`);
  }

  // 3. Write Audit Log
  await AuditLog.create({
    actorId: user._id || user.id,
    actorRole: user.role || 'collegeadmin',
    action: 'COLLEGE_REALTIME_MODE_UPDATED',
    targetType: 'CollegeFeatureConfig',
    targetId: config._id,
    collegeId: strCollegeId,
    metadata: { previousMode, newMode: mode, isGlobal: false },
    severity: mode === 'off' ? 'warning' : 'info',
    ipAddress: ip,
  }).catch(() => {});

  // 4. Notify College Room Sockets
  if (io) {
    if (mode !== 'on') {
      io.to(`college:${strCollegeId}`).emit('system:realtime_paused', {
        mode,
        collegeId: strCollegeId,
      });
    } else {
      io.to(`college:${strCollegeId}`).emit('system:realtime_resumed', {
        mode,
        collegeId: strCollegeId,
      });
    }
  }

  logger.info(
    `[KillSwitch] College ${strCollegeId} real-time mode flipped from ${previousMode} to: ${mode}`
  );
  return { collegeId: strCollegeId, previousMode, mode };
};

const resetFlagCache = () => {
  localCache.clear();
};

module.exports = {
  getRealtimeMode,
  setRealtimeMode,
  resetFlagCache,
};
