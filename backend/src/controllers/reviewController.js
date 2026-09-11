const asyncHandler = require('../utils/asyncHandler');
const Review = require('../models/Review');
const Book = require('../models/Book');
const AppError = require('../utils/AppError');
const mongoose = require('mongoose');
const { evaluateBadges } = require('../services/badgeService');
const logger = require('../utils/logger');

// @desc    Get reviews for a book or resource with pagination & pinned user review
// @route   GET /api/books/:id/reviews OR GET /api/v1/reviews/:resourceType/:resourceId
// @access  Private
const getBookReviews = asyncHandler(async (req, res) => {
  const targetId = req.params.id || req.params.resourceId;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);

  const targetObjectId = new mongoose.Types.ObjectId(targetId);
  const userIdObj =
    req.user && (req.user.id || req.user._id)
      ? new mongoose.Types.ObjectId(req.user.id || req.user._id)
      : null;

  const baseMatch = {
    $or: [{ bookId: targetObjectId }, { resourceId: targetObjectId }],
  };

  if (req.user && req.user.collegeId) {
    baseMatch.collegeId = req.user.collegeId;
  }

  // Find requesting user's own review for this item (if any)
  let ownReview = null;
  if (userIdObj) {
    ownReview = await Review.findOne({
      ...baseMatch,
      userId: userIdObj,
    }).populate('userId', 'name avatar role');
  }

  // Query for approved reviews from other users
  const otherQuery = {
    ...baseMatch,
    status: 'approved',
  };
  if (userIdObj) {
    otherQuery.userId = { $ne: userIdObj };
  }

  const totalOther = await Review.countDocuments(otherQuery);
  const total = (ownReview ? 1 : 0) + totalOther;
  const hasMore = page * limit < total;

  let reviews;

  if (ownReview) {
    if (page === 1) {
      const otherLimit = Math.max(0, limit - 1);
      const otherReviews =
        otherLimit > 0
          ? await Review.find(otherQuery)
              .populate('userId', 'name avatar role')
              .sort({ createdAt: -1 })
              .skip(0)
              .limit(otherLimit)
          : [];
      reviews = [ownReview, ...otherReviews];
    } else {
      const skip = (page - 1) * limit - 1;
      reviews = await Review.find(otherQuery)
        .populate('userId', 'name avatar role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    }
  } else {
    const skip = (page - 1) * limit;
    reviews = await Review.find(otherQuery)
      .populate('userId', 'name avatar role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  let summary;
  let bookDoc = null;
  if (targetObjectId) {
    bookDoc = await Book.findById(targetObjectId).select('ratingSummary');
  }

  if (bookDoc && bookDoc.ratingSummary && bookDoc.ratingSummary.count > 0) {
    summary = {
      averageRating: bookDoc.ratingSummary.average || 0,
      totalReviews: bookDoc.ratingSummary.count || 0,
      breakdown: {
        1: bookDoc.ratingSummary.distribution?.[1] || 0,
        2: bookDoc.ratingSummary.distribution?.[2] || 0,
        3: bookDoc.ratingSummary.distribution?.[3] || 0,
        4: bookDoc.ratingSummary.distribution?.[4] || 0,
        5: bookDoc.ratingSummary.distribution?.[5] || 0,
      },
    };
  } else {
    // Compute aggregate stats for summary (initial run or non-book resource)
    const stats = await Review.aggregate([
      { $match: { ...baseMatch, status: 'approved' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          star1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          star2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          star3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          star4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          star5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        },
      },
    ]);

    summary =
      stats.length > 0
        ? {
            averageRating: Math.round(stats[0].averageRating * 10) / 10,
            totalReviews: stats[0].totalReviews,
            breakdown: {
              1: stats[0].star1,
              2: stats[0].star2,
              3: stats[0].star3,
              4: stats[0].star4,
              5: stats[0].star5,
            },
          }
        : {
            averageRating: 0,
            totalReviews: 0,
            breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          };

    // Lazily backfill Book.ratingSummary so subsequent requests avoid aggregation
    if (bookDoc && summary.totalReviews > 0) {
      bookDoc.ratingSummary = {
        average: summary.averageRating,
        count: summary.totalReviews,
        distribution: summary.breakdown,
      };
      bookDoc.avgRating = summary.averageRating;
      bookDoc.ratingCount = summary.totalReviews;
      bookDoc.markModified('ratingSummary');
      bookDoc.save().catch(() => {});
    }
  }

  res.json({
    success: true,
    data: reviews,
    total,
    page,
    hasMore,
    summary,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1, hasMore },
  });
});

const getResourceReviews = getBookReviews;

// @desc    Create a review
// @route   POST /api/v1/reviews OR POST /api/books/:id/reviews
// @access  Private
const createReview = asyncHandler(async (req, res) => {
  const { resourceType, resourceId, bookId, rating, title, comment, text } = req.body;

  const targetBookId =
    req.params.id || bookId || (resourceType === 'book' || !resourceType ? resourceId : null);
  const targetText = text || comment || '';
  const targetResourceType = resourceType || (targetBookId ? 'book' : 'eresource');
  const targetResourceId = resourceId || targetBookId;

  if (targetResourceType && !['book', 'eresource'].includes(targetResourceType)) {
    throw new AppError('Invalid resource type', 400);
  }

  if (!rating || rating < 1 || rating > 5) {
    throw new AppError('Rating must be between 1 and 5', 400);
  }

  const reviewStatus =
    req.isProfane || req.body.status === 'flagged' ? 'flagged' : req.body.status || 'approved';

  let session = null;
  const isReplicaSet = Boolean(
    mongoose.connection.replicaSet ||
    (mongoose.connection.client &&
      mongoose.connection.client.topology &&
      typeof mongoose.connection.client.topology.hasReplicaSet === 'function' &&
      mongoose.connection.client.topology.hasReplicaSet())
  );

  if (isReplicaSet) {
    try {
      const s = await mongoose.startSession();
      s.startTransaction();
      session = s;
    } catch {
      session = null;
    }
  }

  let review;
  try {
    const reviewData = {
      collegeId: req.user.collegeId,
      userId: req.user.id || req.user._id,
      bookId: targetBookId,
      resourceType: targetResourceType,
      resourceId: targetResourceId,
      rating: Number(rating),
      title,
      comment: targetText,
      text: targetText,
      status: reviewStatus,
    };

    if (session) {
      const docs = await Review.create([reviewData], { session });
      review = docs[0];
    } else {
      review = await Review.create(reviewData);
    }

    // Forced failure hook for transaction rollback test verification
    if (
      req.headers['x-simulate-failure'] === 'mid-transaction' ||
      req.query.simulateFailure === 'true'
    ) {
      throw new Error('Simulated mid-transaction failure');
    }

    // Update Book rating aggregates and ratingSummary incrementally
    if (targetBookId && targetResourceType === 'book' && reviewStatus === 'approved') {
      const book = session
        ? await Book.findById(targetBookId).session(session)
        : await Book.findById(targetBookId);

      if (book) {
        const ratingNum = Number(rating);
        book.ratingSummary = book.ratingSummary || {
          average: 0,
          count: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        };
        const currentSummary = book.ratingSummary;
        const currentCount = currentSummary.count || 0;
        const currentAvg = currentSummary.average || 0;
        const newCount = currentCount + 1;
        const newAvg = Math.round(((currentAvg * currentCount + ratingNum) / newCount) * 10) / 10;

        currentSummary.distribution = currentSummary.distribution || {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        };
        currentSummary.distribution[ratingNum] = (currentSummary.distribution[ratingNum] || 0) + 1;
        currentSummary.count = newCount;
        currentSummary.average = newAvg;

        book.avgRating = newAvg;
        book.ratingCount = newCount;
        book.markModified('ratingSummary');

        if (session) {
          await book.save({ session });
        } else {
          await book.save();
        }
      }
    }

    if (session) {
      await session.commitTransaction();
      session.endSession();
      session = null;
    }

    if (review) {
      if (typeof review.$session === 'function') {
        review.$session(null);
      }
      await review.populate('userId', 'name avatar role');
    }

    const userId = req.user && (req.user.id || req.user._id);
    if (userId && review) {
      evaluateBadges(userId, 'review_submitted', { reviewId: review._id }).catch((err) =>
        logger.error(`Error evaluating badges after review creation: ${err.message}`)
      );
    }

    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (err) {
    if (session) {
      await session.abortTransaction().catch(() => {});
      session.endSession().catch(() => {});
    } else if (review && review._id) {
      await Review.deleteOne({ _id: review._id }).catch(() => {});
    }

    if (err.code === 11000) {
      throw new AppError('You have already submitted a review for this item', 409);
    }
    throw err;
  }
});

// @desc    Vote review as helpful
// @route   POST /api/v1/reviews/:id/helpful
// @access  Private
const voteHelpful = asyncHandler(async (req, res) => {
  const review = await Review.findOne({
    _id: req.params.id,
    collegeId: req.user.collegeId,
  });

  if (!review) {
    throw new AppError('Review not found', 404);
  }

  const userIdStr = req.user.id.toString();
  const hasVoted = review.votedUserIds.some((id) => id.toString() === userIdStr);

  if (hasVoted) {
    review.votedUserIds = review.votedUserIds.filter((id) => id.toString() !== userIdStr);
    review.helpfulVotes = Math.max(0, review.helpfulVotes - 1);
  } else {
    review.votedUserIds.push(req.user.id);
    review.helpfulVotes += 1;
  }

  await review.save();

  res.json({
    success: true,
    data: { helpfulVotes: review.helpfulVotes, voted: !hasVoted },
  });
});

// @desc    Flag a review for admin moderation
// @route   POST /api/v1/reviews/:id/flag
// @access  Private
const flagReview = asyncHandler(async (req, res) => {
  const review = await Review.findOne({
    _id: req.params.id,
    collegeId: req.user.collegeId,
  });

  if (!review) {
    throw new AppError('Review not found', 404);
  }

  review.status = 'flagged';
  await review.save();

  res.json({
    success: true,
    message: 'Review flagged for moderation',
  });
});

// @desc    Update a review and incrementally adjust Book ratingSummary
// @route   PUT /api/v1/reviews/:id OR PUT /api/books/:bookId/reviews/:id
// @access  Private
const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id || req.params.reviewId);
  if (!review) {
    throw new AppError('Review not found', 404);
  }

  const userId = (req.user.id || req.user._id).toString();
  if (
    review.userId.toString() !== userId &&
    !['super-admin', 'college-admin'].includes(req.user.role)
  ) {
    throw new AppError('Not authorized to edit this review', 403);
  }

  const oldRating = Number(review.rating);
  const oldStatus = review.status;
  const { rating, title, comment, text } = req.body;
  const newRating = rating ? Number(rating) : oldRating;

  if (rating && (newRating < 1 || newRating > 5)) {
    throw new AppError('Rating must be between 1 and 5', 400);
  }

  review.rating = newRating;
  if (title !== undefined) review.title = title;
  if (comment !== undefined || text !== undefined) {
    review.comment = comment || text;
    review.text = comment || text;
  }
  await review.save();

  // Incrementally adjust Book ratingSummary if rating changed on an approved review
  if (review.bookId && oldStatus === 'approved' && oldRating !== newRating) {
    const book = await Book.findById(review.bookId);
    if (book) {
      book.ratingSummary = book.ratingSummary || {
        average: 0,
        count: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
      const summary = book.ratingSummary;
      summary.distribution = summary.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      summary.distribution[oldRating] = Math.max(0, (summary.distribution[oldRating] || 1) - 1);
      summary.distribution[newRating] = (summary.distribution[newRating] || 0) + 1;

      let totalWeighted = 0;
      let totalCount = 0;
      for (let star = 1; star <= 5; star++) {
        const count = summary.distribution[star] || 0;
        totalWeighted += star * count;
        totalCount += count;
      }
      summary.count = totalCount;
      summary.average = totalCount > 0 ? Math.round((totalWeighted / totalCount) * 10) / 10 : 0;

      book.avgRating = summary.average;
      book.ratingCount = summary.count;
      book.markModified('ratingSummary');
      await book.save();
    }
  }

  res.json({ success: true, data: review });
});

// @desc    Delete a review and incrementally adjust Book ratingSummary
// @route   DELETE /api/v1/reviews/:id OR DELETE /api/books/:bookId/reviews/:id
// @access  Private
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id || req.params.reviewId);
  if (!review) {
    throw new AppError('Review not found', 404);
  }

  const userId = (req.user.id || req.user._id).toString();
  if (
    review.userId.toString() !== userId &&
    !['super-admin', 'college-admin'].includes(req.user.role)
  ) {
    throw new AppError('Not authorized to delete this review', 403);
  }

  const wasApproved = review.status === 'approved';
  const ratingVal = Number(review.rating);
  const bookId = review.bookId;

  await Review.deleteOne({ _id: review._id });

  if (bookId && wasApproved) {
    const book = await Book.findById(bookId);
    if (book) {
      book.ratingSummary = book.ratingSummary || {
        average: 0,
        count: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
      const summary = book.ratingSummary;
      summary.distribution = summary.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      summary.distribution[ratingVal] = Math.max(0, (summary.distribution[ratingVal] || 1) - 1);
      summary.count = Math.max(0, (summary.count || 1) - 1);

      let totalWeighted = 0;
      for (let star = 1; star <= 5; star++) {
        totalWeighted += star * (summary.distribution[star] || 0);
      }
      summary.average =
        summary.count > 0 ? Math.round((totalWeighted / summary.count) * 10) / 10 : 0;

      book.avgRating = summary.average;
      book.ratingCount = summary.count;
      book.markModified('ratingSummary');
      await book.save();
    }
  }

  res.json({ success: true, message: 'Review deleted successfully' });
});

module.exports = {
  getBookReviews,
  getResourceReviews,
  createReview,
  updateReview,
  deleteReview,
  voteHelpful,
  flagReview,
};
