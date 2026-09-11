const asyncHandler = require('../utils/asyncHandler');
const Streak = require('../models/Streak');
const ReadingActivityLog = require('../models/ReadingActivityLog');
const User = require('../models/User');
const cacheHelper = require('../utils/cacheHelper');

// @desc    Get college leaderboard
// @route   GET /api/v1/leaderboard
// @access  Private
const getLeaderboard = asyncHandler(async (req, res) => {
  const { metric = 'streak', limit = 10 } = req.query;
  const numLimit = Math.min(50, parseInt(limit, 10) || 10);

  // Check Redis Cache with 15-minute TTL
  const cacheKey = cacheHelper.makeKey(req.user.collegeId, 'leaderboard', `${metric}:${numLimit}`);

  const cachedResults = await cacheHelper.get(cacheKey);
  if (cachedResults && Array.isArray(cachedResults)) {
    const personalized = cachedResults.map((entry) => ({
      ...entry,
      isSelf: entry.userId ? entry.userId.toString() === req.user.id.toString() : false,
    }));
    return res.json({
      success: true,
      data: personalized,
    });
  }

  let leaderboard;

  if (metric === 'points') {
    const topUsers = await User.find({
      collegeId: req.user.collegeId,
      isLeaderboardVisible: { $ne: false },
    })
      .sort('-points')
      .limit(numLimit)
      .select('name points isLeaderboardVisible isLeaderboardPublic department');

    leaderboard = topUsers.map((u, index) => {
      const isSelf = u._id.toString() === req.user.id.toString();
      return {
        rank: index + 1,
        userId: u._id,
        displayName: u.name,
        isSelf,
        score: u.points || 0,
        unit: 'points',
        department: u.department || 'Library',
      };
    });
  } else if (metric === 'streak') {
    const streaks = await Streak.find({
      collegeId: req.user.collegeId,
    })
      .populate('userId', 'name isLeaderboardVisible isLeaderboardPublic department')
      .sort('-currentStreak')
      .limit(numLimit);

    leaderboard = streaks
      .filter((s) => s.userId && s.userId.isLeaderboardVisible !== false)
      .map((s, index) => {
        const isSelf = s.userId && s.userId._id.toString() === req.user.id.toString();
        return {
          rank: index + 1,
          userId: s.userId ? s.userId._id : null,
          displayName: s.userId ? s.userId.name : 'Anonymous Patron',
          isSelf,
          score: s.currentStreak,
          unit: 'days streak',
          longestStreak: s.longestStreak,
          department: s.userId?.department || 'Library',
        };
      });
  } else {
    // Default metric: total pages read
    const topReaders = await ReadingActivityLog.aggregate([
      { $match: { collegeId: req.user.collegeId } },
      {
        $group: {
          _id: '$userId',
          totalPages: { $sum: '$pagesRead' },
          totalMinutes: { $sum: '$minutesRead' },
        },
      },
      { $sort: { totalPages: -1 } },
      { $limit: numLimit },
    ]);

    const userIds = topReaders.map((r) => r._id);
    const users = await User.find({ _id: { $in: userIds } }).select(
      'name isLeaderboardPublic department'
    );
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    leaderboard = topReaders.map((r, index) => {
      const user = userMap.get(r._id.toString());
      const isSelf = r._id.toString() === req.user.id.toString();
      const isPublic = user && (user.isLeaderboardPublic !== false || isSelf);

      const displayName = !user
        ? 'Anonymous Patron'
        : isPublic
          ? user.name
          : `Avid Reader #${r._id.toString().slice(-4)}`;

      return {
        rank: index + 1,
        userId: r._id,
        displayName,
        isSelf,
        score: r.totalPages,
        unit: 'pages read',
        totalMinutes: r.totalMinutes,
        department: user?.department || 'Library',
      };
    });
  }

  // Cache leaderboard in Redis for 15 minutes (900 seconds)
  await cacheHelper.set(cacheKey, leaderboard, 900);

  res.json({
    success: true,
    data: leaderboard,
  });
});

module.exports = {
  getLeaderboard,
};
