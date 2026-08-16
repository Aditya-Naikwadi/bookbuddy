const asyncHandler = require('../utils/asyncHandler');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Bookmark = require('../models/Bookmark');
const ReadingList = require('../models/ReadingList');

// @desc    Get enhanced personalized recommendations using tag similarity & collaborative filtering
// @route   GET /api/recommendations/me
// @access  Private
const getMyRecommendations = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  let recommendationReason = 'Popular & Trending Reads on Campus';
  let signalType = 'popular_fallback';
  let seedBookTitle = null;

  // 1. Collect all borrowing history loans for user
  const userLoans = await Loan.find({ userId: req.user.id })
    .populate('bookId', 'title category genre tags')
    .sort('-createdAt')
    .limit(20);

  const borrowedBookIds = new Set();
  const categoryFreq = {};
  const tagFreq = {};

  userLoans.forEach((loan) => {
    if (loan.bookId) {
      const b = loan.bookId;
      borrowedBookIds.add(b._id.toString());
      if (!seedBookTitle) seedBookTitle = b.title;

      if (b.category) {
        categoryFreq[b.category] = (categoryFreq[b.category] || 0) + 2;
      }
      if (Array.isArray(b.tags)) {
        b.tags.forEach((t) => {
          tagFreq[t] = (tagFreq[t] || 0) + 1;
        });
      }
    }
  });

  // 2. Collect tags from bookmarks
  const userBookmarks = await Bookmark.find({ userId: req.user.id })
    .populate('eresourceId', 'category tags')
    .limit(10);

  userBookmarks.forEach((bm) => {
    if (bm.eresourceId) {
      if (bm.eresourceId.category) {
        categoryFreq[bm.eresourceId.category] = (categoryFreq[bm.eresourceId.category] || 0) + 1;
      }
    }
  });

  const topCategories = Object.keys(categoryFreq).sort((a, b) => categoryFreq[b] - categoryFreq[a]);
  const topTags = Object.keys(tagFreq).sort((a, b) => tagFreq[b] - tagFreq[a]);

  let candidateBooks = [];
  let totalCount = 0;

  if (topCategories.length > 0) {
    const query = {
      _id: { $nin: Array.from(borrowedBookIds) },
      category: { $in: topCategories },
    };

    const allMatches = await Book.find(query).lean();
    totalCount = allMatches.length;

    // Score candidate books based on category weight and tag overlap
    const scoredMatches = allMatches.map((book) => {
      let score = 0;
      if (book.category && categoryFreq[book.category]) {
        score += categoryFreq[book.category] * 3;
      }
      if (Array.isArray(book.tags)) {
        book.tags.forEach((t) => {
          if (tagFreq[t]) score += tagFreq[t] * 2;
        });
      }
      score += (book.publishedYear || 2020) / 1000;
      return { ...book, simScore: score };
    });

    scoredMatches.sort((a, b) => b.simScore - a.simScore);
    candidateBooks = scoredMatches.slice(skip, skip + limit);

    if (candidateBooks.length > 0) {
      const topCat = topCategories[0];
      recommendationReason = seedBookTitle
        ? `Because you borrowed "${seedBookTitle}" & read ${topCat}`
        : `Matches your academic interest in ${topCat}`;
      signalType = 'tag_similarity';
    }
  }

  // 3. Fallback to Major Alignment if no borrowing matches found
  if (candidateBooks.length === 0 && req.user.major) {
    const query = { category: { $in: [req.user.major] } };
    totalCount = await Book.countDocuments(query);
    candidateBooks = await Book.find(query).sort('-publishedYear').skip(skip).limit(limit).lean();
    if (candidateBooks.length > 0) {
      recommendationReason = `Recommended for ${req.user.major} Majors`;
      signalType = 'major_alignment';
    }
  }

  // 4. Cold-Start Fallback: Popular / Trending campus books
  if (candidateBooks.length === 0) {
    totalCount = await Book.countDocuments();
    candidateBooks = await Book.find()
      .sort('-publishedYear -copiesTotal')
      .skip(skip)
      .limit(limit)
      .lean();
    recommendationReason = 'Popular & Trending Reads on Campus';
    signalType = 'popular_fallback';
  }

  const enrichedBooks = candidateBooks.map((b) => ({
    ...b,
    recommendationReason,
    signalType,
    seedBookTitle,
  }));

  res.json({
    success: true,
    data: enrichedBooks,
    signal: {
      type: signalType,
      reason: recommendationReason,
      seedBookTitle,
      topCategories,
      topTags,
    },
    pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
  });
});

module.exports = {
  getMyRecommendations,
};
