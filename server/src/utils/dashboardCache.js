const { redisClient } = require('../middlewares/rateLimiters');
const Book = require('../models/Book');
const DashboardStatsSnapshot = require('../models/DashboardStatsSnapshot');
const mongoose = require('mongoose');
const logger = require('./logger');

const STATS_CACHE_TTL = 300; // 5 minutes

const getCacheKey = (collegeId) => `dashboard:stats:${collegeId || 'global'}`;

// Precompute / fetch cached stats for a given college
const getOrComputeStats = async (collegeId) => {
  const cacheKey = getCacheKey(collegeId);
  let cacheHit = false;

  // 1. Try reading from Redis
  if (redisClient && redisClient.status === 'ready') {
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        cacheHit = true;
        return { stats: JSON.parse(cachedData), cacheHit };
      }
    } catch (err) {
      logger.warn(
        `Redis stats cache fetch error for key ${cacheKey}, falling back to Mongo snapshot:`,
        err
      );
    }
  }

  // 2. Try reading from DashboardStatsSnapshot collection
  if (collegeId && mongoose.Types.ObjectId.isValid(String(collegeId))) {
    try {
      const snapshot = await DashboardStatsSnapshot.findOne({
        collegeId: new mongoose.Types.ObjectId(collegeId),
      })
        .read('secondaryPreferred')
        .lean();

      if (snapshot && snapshot.lastPrecomputedAt) {
        const snapshotAgeSeconds =
          (Date.now() - new Date(snapshot.lastPrecomputedAt).getTime()) / 1000;
        if (snapshotAgeSeconds < STATS_CACHE_TTL) {
          const stats = {
            totalCatalogBooks: snapshot.totalCatalogBooks,
            addedThisMonth: snapshot.addedThisMonth,
            categoryBreakdown: snapshot.categoryBreakdown,
            updatedAt: snapshot.lastPrecomputedAt.toISOString(),
          };

          // Re-populate Redis cache
          if (redisClient && redisClient.status === 'ready') {
            try {
              await redisClient.setex(cacheKey, STATS_CACHE_TTL, JSON.stringify(stats));
            } catch {
              // Non-blocking
            }
          }

          return { stats, cacheHit: true };
        }
      }
    } catch (err) {
      logger.warn('DashboardStatsSnapshot read error:', err);
    }
  }

  // 3. Compute stats directly from MongoDB via live aggregation
  const bookFilter =
    collegeId && mongoose.Types.ObjectId.isValid(String(collegeId))
      ? { collegeId: new mongoose.Types.ObjectId(collegeId) }
      : {};

  const totalCatalogBooks = await Book.countDocuments(bookFilter).read('secondaryPreferred');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const addedThisMonth = await Book.countDocuments({
    ...bookFilter,
    createdAt: { $gte: thirtyDaysAgo },
  }).read('secondaryPreferred');

  const categoryAggregation = await Book.aggregate([
    { $match: bookFilter },
    {
      $group: {
        _id: { $ifNull: ['$category', '$genre'] },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 6 },
  ]).read('secondaryPreferred');

  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#3B82F6'];
  const totalGrouped = categoryAggregation.reduce((acc, c) => acc + c.count, 0) || 1;
  const categoryBreakdown = categoryAggregation.map((cat, idx) => ({
    label: cat._id || 'Uncategorized',
    value: Math.round((cat.count / totalGrouped) * 100),
    count: cat.count,
    color: colors[idx % colors.length],
  }));

  const nowMs = Date.now();
  const bucketMs = Math.floor(nowMs / (STATS_CACHE_TTL * 1000)) * (STATS_CACHE_TTL * 1000);

  const computedStats = {
    totalCatalogBooks,
    addedThisMonth,
    categoryBreakdown,
    updatedAt: new Date(bucketMs).toISOString(),
  };

  // 4. Upsert DashboardStatsSnapshot & cache in Redis
  if (collegeId && mongoose.Types.ObjectId.isValid(String(collegeId))) {
    try {
      await DashboardStatsSnapshot.findOneAndUpdate(
        { collegeId: new mongoose.Types.ObjectId(collegeId) },
        {
          collegeId: new mongoose.Types.ObjectId(collegeId),
          totalCatalogBooks,
          addedThisMonth,
          categoryBreakdown,
          lastPrecomputedAt: new Date(),
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      logger.warn('Failed to upsert DashboardStatsSnapshot:', err);
    }
  }

  if (redisClient && redisClient.status === 'ready') {
    try {
      await redisClient.setex(cacheKey, STATS_CACHE_TTL, JSON.stringify(computedStats));
    } catch (err) {
      logger.warn(`Failed to store precomputed stats in Redis for key ${cacheKey}:`, err);
    }
  }

  return { stats: computedStats, cacheHit };
};

// Invalidate precomputed stats cache on book mutations
const invalidateStatsCache = async (collegeId) => {
  const cacheKey = getCacheKey(collegeId);
  if (redisClient && redisClient.status === 'ready') {
    try {
      await redisClient.del(cacheKey);
      logger.info(`Invalidated dashboard stats cache for key: ${cacheKey}`);
    } catch (err) {
      logger.warn(`Failed to invalidate dashboard stats cache for key ${cacheKey}:`, err);
    }
  }
};

module.exports = {
  getOrComputeStats,
  invalidateStatsCache,
};
