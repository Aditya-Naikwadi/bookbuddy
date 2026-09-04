const Loan = require('../models/Loan');
const Streak = require('../models/Streak');

// GET /api/v1/reading-stats/me - Aggregate reading statistics for student
const getMyReadingStats = async (req, res, next) => {
  try {
    const loans = await Loan.find({
      collegeId: req.user.collegeId,
      userId: req.user._id,
    }).populate('bookId', 'title genre pages format');

    let totalLoans = loans.length;
    let completedReads = 0;
    let totalOverdue = 0;
    const genreMap = {};
    const monthlyVelocityMap = {};

    loans.forEach((loan) => {
      if (loan.status === 'returned') completedReads++;
      if (loan.status === 'overdue') totalOverdue++;

      // Handle deleted book reference gracefully
      if (loan.bookId) {
        const genre = loan.bookId.genre || 'General';
        genreMap[genre] = (genreMap[genre] || 0) + 1;
      }

      const monthKey = new Date(loan.issueDate || loan.createdAt).toISOString().substring(0, 7); // YYYY-MM
      monthlyVelocityMap[monthKey] = (monthlyVelocityMap[monthKey] || 0) + 1;
    });

    const genreBreakdown = Object.entries(genreMap).map(([name, count]) => ({ name, count }));
    const monthlyVelocity = Object.entries(monthlyVelocityMap)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const streak = await Streak.findOne({
      collegeId: req.user.collegeId,
      userId: req.user._id,
    });

    res.status(200).json({
      success: true,
      data: {
        totalLoans,
        completedReads,
        totalOverdue,
        activeLoans: totalLoans - completedReads,
        currentStreak: streak ? streak.currentStreak : 0,
        longestStreak: streak ? streak.longestStreak : 0,
        genreBreakdown,
        monthlyVelocity,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMyReadingStats,
};
