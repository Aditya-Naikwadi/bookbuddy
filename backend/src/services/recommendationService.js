const UserRecommendation = require('../models/UserRecommendation');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Review = require('../models/Review');
const User = require('../models/User');

/**
 * Generates personalized book recommendations for a given user.
 * Combines borrow/rating history tag analysis with a college-scoped trending fallback slice.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Array<{ bookId: string|ObjectId, score: number, reason: string }>>}
 */
const generateRecommendationsForUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user || !user.collegeId) {
    return [];
  }

  const collegeId = user.collegeId;

  // 1. Fetch user's borrow history, reviews, and saved reading-list items to extract preferences
  const loans = await Loan.find({ userId }).select('bookId');
  const reviews = await Review.find({ userId }).select('bookId rating');
  const ReadingList = require('../models/ReadingList');
  const readingLists = await ReadingList.find({ userId }).select('items.bookId');

  const borrowedBookIds = loans.map((l) => (l.bookId ? l.bookId.toString() : null)).filter(Boolean);
  const reviewedBookIds = reviews
    .map((r) => (r.bookId ? r.bookId.toString() : null))
    .filter(Boolean);
  const savedBookIds = readingLists
    .flatMap((rl) => (rl.items || []).map((i) => (i.bookId ? i.bookId.toString() : null)))
    .filter(Boolean);

  const readBookIdsSet = new Set([...borrowedBookIds, ...reviewedBookIds, ...savedBookIds]);
  const readBookIds = Array.from(readBookIdsSet);

  // 2. Extract user's favorite tags, authors, and categories
  const userReadBooks = await Book.find({ _id: { $in: readBookIds } });

  const userTagsMap = {};
  const userAuthorsMap = {};
  const userCategoriesMap = {};
  let seedTitle = null;

  userReadBooks.forEach((book) => {
    if (!seedTitle && book.title) seedTitle = book.title;

    if (Array.isArray(book.tags)) {
      book.tags.forEach((tag) => {
        const cleanTag = tag.toLowerCase().trim();
        userTagsMap[cleanTag] = (userTagsMap[cleanTag] || 0) + 1;
      });
    }
    if (book.author) {
      const author = book.author.trim();
      userAuthorsMap[author] = (userAuthorsMap[author] || 0) + 1;
    }
    if (book.category) {
      const category = book.category.trim();
      userCategoriesMap[category] = (userCategoriesMap[category] || 0) + 1;
    }
  });

  const topTags = Object.keys(userTagsMap).sort((a, b) => userTagsMap[b] - userTagsMap[a]);
  const topAuthors = Object.keys(userAuthorsMap).sort(
    (a, b) => userAuthorsMap[b] - userAuthorsMap[a]
  );
  const topCategories = Object.keys(userCategoriesMap).sort(
    (a, b) => userCategoriesMap[b] - userCategoriesMap[a]
  );

  // 3. Match candidate books in the user's college (excluding already-read books)
  const candidateBooks = await Book.find({
    collegeId,
    _id: { $nin: readBookIds },
  }).limit(100);

  const scoredRecommendations = [];
  const addedBookIdsSet = new Set();

  candidateBooks.forEach((book) => {
    let score = 0;
    let matchingTags = [];

    if (Array.isArray(book.tags)) {
      matchingTags = book.tags.filter((t) => topTags.includes(t.toLowerCase().trim()));
    }

    const tagOverlap = matchingTags.length;
    const isSameAuthor = book.author && topAuthors.includes(book.author.trim());
    const isSameCategory = book.category && topCategories.includes(book.category.trim());

    if (tagOverlap > 0) score += tagOverlap * 3;
    if (isSameAuthor) score += 5;
    if (isSameCategory) score += 4;

    const avgRating = Number(book.avgRating) || 3.5;
    score = (score + 1) * (avgRating / 5);

    let reason = 'Top recommendation based on catalog ratings';
    if (isSameAuthor) {
      reason = `Because you enjoyed books by ${book.author}`;
    } else if (seedTitle && tagOverlap > 0) {
      reason = `Similar to "${seedTitle}"`;
    } else if (matchingTags.length > 0) {
      reason = `Based on your interest in ${matchingTags[0]}`;
    } else if (isSameCategory) {
      reason = `Popular in ${book.category}`;
    }

    scoredRecommendations.push({
      bookId: book._id,
      score: Number(score.toFixed(2)),
      reason,
    });
    addedBookIdsSet.add(book._id.toString());
  });

  // 4. Fallback slice: "Trending on campus" for college-scoped top-borrowed/top-rated titles
  if (scoredRecommendations.length < 20) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Aggregate most borrowed books in college in last 30 days
    const trendingLoans = await Loan.aggregate([
      { $match: { collegeId: user.collegeId, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$bookId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    const trendingBookIds = trendingLoans.map((l) => l._id.toString());

    const trendingBooks = await Book.find({
      collegeId,
      _id: { $nin: [...Array.from(readBookIdsSet), ...Array.from(addedBookIdsSet)] },
    })
      .sort({ avgRating: -1, ratingCount: -1 })
      .limit(20 - scoredRecommendations.length);

    trendingBooks.forEach((book) => {
      const isMostBorrowed = trendingBookIds.includes(book._id.toString());
      const score = (isMostBorrowed ? 8 : 5) + (Number(book.avgRating) || 3.5);

      scoredRecommendations.push({
        bookId: book._id,
        score: Number(score.toFixed(2)),
        reason: isMostBorrowed ? 'Trending on campus' : 'Popular in your college library',
      });
      addedBookIdsSet.add(book._id.toString());
    });
  }

  // 5. Take top 20 recommendations sorted by score descending
  scoredRecommendations.sort((a, b) => b.score - a.score);
  const topRecommendations = scoredRecommendations.slice(0, 20);

  // 6. Upsert into UserRecommendation cache (guarantees single document per user)
  await UserRecommendation.findOneAndUpdate(
    { userId },
    {
      userId,
      collegeId,
      recommendations: topRecommendations,
      computedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return topRecommendations;
};

/**
 * Retrieves cached user recommendations, recomputing if missing or forceRefresh requested.
 *
 * @param {string|ObjectId} userId
 * @param {object} options
 * @returns {Promise<object>}
 */
const getUserRecommendations = async (userId, options = {}) => {
  let cached = await UserRecommendation.findOne({ userId }).populate(
    'recommendations.bookId',
    'title author category isbn avgRating coverImage'
  );

  if (!cached || options.forceRefresh) {
    await generateRecommendationsForUser(userId);
    cached = await UserRecommendation.findOne({ userId }).populate(
      'recommendations.bookId',
      'title author category isbn avgRating coverImage'
    );
  }

  return cached ? cached.recommendations : [];
};

module.exports = {
  generateRecommendationsForUser,
  getUserRecommendations,
};
