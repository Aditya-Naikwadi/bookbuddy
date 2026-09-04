const Badge = require('../models/Badge');
const UserBadge = require('../models/UserBadge');
const User = require('../models/User');
const Streak = require('../models/Streak');
const Review = require('../models/Review');
const Loan = require('../models/Loan');
const ReadingList = require('../models/ReadingList');

let badgeCache = [];
let lastCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Loads all Badge definitions into in-memory cache, refreshing periodically.
 */
const getBadges = async () => {
  const now = Date.now();
  if (!badgeCache || badgeCache.length === 0 || now - lastCacheTime > CACHE_TTL_MS) {
    badgeCache = await Badge.find({}).lean();
    lastCacheTime = now;
  }
  return badgeCache;
};

/**
 * Forces a refresh of the in-memory badge cache.
 */
const refreshBadgeCache = async () => {
  badgeCache = await Badge.find({}).lean();
  lastCacheTime = Date.now();
  return badgeCache;
};

/**
 * Returns point value for a given badge based on custom badge points or tier.
 */
const TIER_POINTS = {
  bronze: 10,
  silver: 25,
  gold: 50,
};

const getBadgePoints = (badge) => {
  if (typeof badge.points === 'number' && badge.points > 0) {
    return badge.points;
  }
  return TIER_POINTS[badge.tier] || 10;
};

/**
 * Maps eventType aliases to criteria types.
 */
const EVENT_TYPE_MAP = {
  streak_updated: 'streak',
  streak: 'streak',
  review_submitted: 'review',
  review: 'review',
  book_borrowed: 'books_read',
  borrow: 'books_read',
  books_read: 'books_read',
  book_returned: 'books_read',
  list_created: 'list',
  list: 'list',
};

/**
 * Checks if a user meets the criteria for a given badge definition based on event and current stats.
 */
const checkBadgeCriteria = async (badge, userId, eventType, eventPayload = {}) => {
  if (!badge || !badge.criteria) return false;

  const criteriaType = badge.criteria.type;
  const threshold = badge.criteria.threshold || 1;
  const mappedEventType = EVENT_TYPE_MAP[eventType] || eventType;

  if (criteriaType !== mappedEventType) {
    return false;
  }

  switch (criteriaType) {
    case 'streak': {
      let streakLength =
        eventPayload.length ?? eventPayload.streakLength ?? eventPayload.currentStreak;
      if (typeof streakLength !== 'number') {
        const streakDoc = await Streak.findOne({ userId });
        streakLength = streakDoc ? streakDoc.currentStreak : 0;
      }
      return streakLength >= threshold;
    }

    case 'review': {
      let reviewCount = eventPayload.count;
      if (typeof reviewCount !== 'number') {
        reviewCount = await Review.countDocuments({ userId });
      }
      return reviewCount >= threshold;
    }

    case 'books_read':
    case 'borrow': {
      let booksReadCount = eventPayload.count;
      if (typeof booksReadCount !== 'number') {
        booksReadCount = await Loan.countDocuments({ userId });
      }
      return booksReadCount >= threshold;
    }

    case 'list': {
      let listCount = eventPayload.count;
      if (typeof listCount !== 'number') {
        listCount = await ReadingList.countDocuments({ userId });
      }
      return listCount >= threshold;
    }

    default:
      return false;
  }
};

/**
 * Central evaluateBadges function.
 * Checks all cached badge definitions against eventType and eventPayload / user stats,
 * awards via UserBadge upsert (guarded by F12.2 unique index), increments User.points
 * on a new award, and emits a badge:earned Socket.io event.
 *
 * @param {ObjectId|string} userId
 * @param {string} eventType - e.g. 'streak_updated', 'review_submitted', 'book_borrowed'
 * @param {object} [eventPayload={}]
 * @returns {Promise<Array<{ badge: object, userBadge: object, pointsAdded: number }>>}
 */
const evaluateBadges = async (userId, eventType, eventPayload = {}) => {
  if (!userId) return [];

  const badges = await getBadges();
  const newlyAwarded = [];

  for (const badge of badges) {
    const isEligible = await checkBadgeCriteria(badge, userId, eventType, eventPayload);

    if (isEligible) {
      // Award via UserBadge.awardBadge (caught duplicate-key returns { awarded: false })
      const awardResult = await UserBadge.awardBadge(userId, badge.key);

      if (awardResult.awarded) {
        const pointsToAdd = getBadgePoints(badge);

        // Increment User.points on successful new award
        await User.findByIdAndUpdate(
          userId,
          { $inc: { points: pointsToAdd } },
          { returnDocument: 'after' }
        );

        // Emit Socket.io badge:earned event if available
        try {
          const socketModule = require('../sockets');
          if (socketModule && typeof socketModule.getIO === 'function') {
            const io = socketModule.getIO();
            if (io) {
              io.to(`user:${userId}`).emit('badge:earned', {
                badgeKey: badge.key,
                badge,
                pointsEarned: pointsToAdd,
                earnedAt: awardResult.userBadge.earnedAt,
              });
            }
          }
        } catch {
          // Non-blocking socket notification fallback
        }

        newlyAwarded.push({
          badge,
          userBadge: awardResult.userBadge,
          pointsAdded: pointsToAdd,
        });
      }
    }
  }

  return newlyAwarded;
};

module.exports = {
  evaluateBadges,
  getBadges,
  refreshBadgeCache,
};
