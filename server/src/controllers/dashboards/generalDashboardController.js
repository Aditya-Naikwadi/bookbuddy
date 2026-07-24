const Announcement = require('../../models/Announcement');
const LibrarySettings = require('../../models/LibrarySettings');
const Book = require('../../models/Book');

// @desc    Get aggregated General Dashboard data directly from MongoDB
// @route   GET /api/dashboards/general/home-data
// @access  Public / General
const getGeneralDashboardData = async (req, res, next) => {
  try {
    const collegeId = req.query.collegeId || req.user?.collegeId;
    const tenantFilter = collegeId ? { $or: [{ collegeId }, { collegeId: null }] } : {};

    // 1. Fetch Active Announcements from MongoDB
    const announcements = await Announcement.find({
      ...tenantFilter,
      isActive: true,
    })
      .sort({ startDate: -1 })
      .limit(10)
      .lean();

    // 2. Fetch Library Operating Hours Settings from MongoDB
    let librarySettings = null;
    if (collegeId) {
      librarySettings = await LibrarySettings.findOne({ collegeId }).lean();
    }
    if (!librarySettings) {
      librarySettings = await LibrarySettings.findOne({}).lean();
    }
    if (!librarySettings) {
      librarySettings = {
        openingHour: '08:00 AM',
        closingHour: '10:00 PM',
        timezone: 'UTC',
        isClosedToday: false,
        monthlyGrowthGoal: 0,
      };
    }

    // 3. Catalog Total Count & 30-Day Growth Metric from MongoDB
    const bookFilter = collegeId ? { collegeId } : {};
    const totalCatalogBooks = await Book.countDocuments(bookFilter);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const addedThisMonth = await Book.countDocuments({
      ...bookFilter,
      createdAt: { $gte: thirtyDaysAgo },
    });

    // 4. Dynamic MongoDB Category Distribution Aggregation
    const categoryAggregation = await Book.aggregate([
      { $match: bookFilter },
      { $group: { _id: '$genre', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]);

    const colors = ['#4F46E5', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#3B82F6'];
    const totalGrouped = categoryAggregation.reduce((acc, c) => acc + c.count, 0) || 1;
    const categoryBreakdown = categoryAggregation.map((cat, idx) => ({
      label: cat._id || 'Uncategorized',
      value: Math.round((cat.count / totalGrouped) * 100),
      count: cat.count,
      color: colors[idx % colors.length],
    }));

    // 5. Popular Books from MongoDB
    const popularBooks = await Book.find(bookFilter)
      .sort({ copiesAvailable: 1, title: 1 })
      .limit(8)
      .lean();

    const formattedPopularBooks = popularBooks.map((b) => ({
      id: b._id,
      title: b.title,
      author: b.author,
      genre: b.genre || 'General',
      year: b.publicationYear || '2024',
      availableCopies: b.copiesAvailable !== undefined ? b.copiesAvailable : 0,
      totalCopies: b.totalCopies !== undefined ? b.totalCopies : 0,
      location: b.shelfLocation || 'Main Stacks',
      description: b.description || 'Catalog item.',
      coverColor: 'from-indigo-900 to-slate-900',
    }));

    // 6. New Arrivals from MongoDB
    const newArrivals = await Book.find(bookFilter).sort({ createdAt: -1 }).limit(3).lean();

    const formattedNewArrivals = newArrivals.map((b, i) => ({
      id: b._id,
      title: b.title,
      color: ['bg-indigo-600', 'bg-emerald-600', 'bg-purple-600'][i % 3],
    }));

    res.json({
      success: true,
      data: {
        announcements,
        librarySettings,
        stats: {
          totalCatalogBooks,
          addedThisMonth,
        },
        categoryBreakdown,
        popularBooks: formattedPopularBooks,
        newArrivals: formattedNewArrivals,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getGeneralDashboardData,
};
