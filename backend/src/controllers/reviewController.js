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

  // Compute aggregate stats for summary
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

  const summary =
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

    // Update Book rating aggregates (newAvg = (oldAvg * oldCount + rating) / (oldCount + 1))
    if (targetBookId && targetResourceType === 'book') {
      const book = session
        ? await Book.findById(targetBookId).session(session)
        : await Book.findById(targetBookId);

      if (book) {
        const oldCount = book.ratingCount || 0;
        const oldAvg = book.avgRating || 0;
        const newCount = oldCount + 1;
        const newAvg = (oldAvg * oldCount + Number(rating)) / newCount;

        book.avgRating = newAvg;
        book.ratingCount = newCount;
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

module.exports = {
  getBookReviews,
  getResourceReviews,
  createReview,
  voteHelpful,
  flagReview,
};
