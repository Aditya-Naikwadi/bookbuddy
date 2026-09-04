const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Loan = require('../models/Loan');
const EResource = require('../models/EResource');
const Book = require('../models/Book');
const { getProgress, upsertProgress } = require('../services/progressService');

/**
 * Helper function to verify whether the authenticated user has borrowed
 * or has access to a specific resource (physical book or e-resource).
 * Throws a 403 Forbidden AppError if access is denied.
 */
const verifyResourceAccess = async (user, resourceId) => {
  const userId = user.id || user._id;

  // 1. Check if user has an active or historic Loan for this book
  const loan = await Loan.findOne({ userId, bookId: resourceId });
  if (loan) {
    return { hasAccess: true, defaultResourceType: 'epub' };
  }

  // 2. Check if resourceId is an EResource
  const eresource = await EResource.findById(resourceId);
  if (eresource) {
    // Enforce tenant isolation if collegeId exists on user and resource
    if (
      user.collegeId &&
      eresource.collegeId &&
      eresource.collegeId.toString() !== user.collegeId.toString()
    ) {
      throw new AppError('Access denied. You do not have access to this resource.', 403);
    }

    const isPublishedOrApproved =
      eresource.isPublished || ['approved', 'published'].includes(eresource.moderationStatus);
    const isOwner = eresource.uploadedBy && eresource.uploadedBy.toString() === userId.toString();
    const isAdmin = ['super-admin', 'college-admin'].includes(user.role);

    if (isPublishedOrApproved || isOwner || isAdmin) {
      return { hasAccess: true, defaultResourceType: eresource.type || 'epub' };
    }

    throw new AppError('Access denied. This e-resource is not available.', 403);
  }

  // 3. Check if resource exists as a Book in the catalog that user hasn't borrowed
  const book = await Book.findById(resourceId);
  if (book) {
    throw new AppError('Access denied. You have not borrowed this book.', 403);
  }

  // 4. Resource not found or no loan/access record
  throw new AppError('Access denied. Resource not found or not borrowed.', 403);
};

/**
 * @desc    Get reading progress for a resource
 * @route   GET /api/v1/reading-progress/:resourceId
 * @access  Private
 */
const getReadingProgress = asyncHandler(async (req, res) => {
  const { resourceId } = req.params;
  const userId = req.user.id || req.user._id;

  await verifyResourceAccess(req.user, resourceId);

  const progress = await getProgress(userId, resourceId);

  res.json({
    success: true,
    data: progress || null,
  });
});

/**
 * @desc    Update or insert reading progress for a resource
 * @route   PUT /api/v1/reading-progress/:resourceId
 * @access  Private
 */
const updateReadingProgress = asyncHandler(async (req, res) => {
  const { resourceId } = req.params;
  const userId = req.user.id || req.user._id;

  const accessInfo = await verifyResourceAccess(req.user, resourceId);

  const {
    resourceType = accessInfo.defaultResourceType || 'epub',
    position,
    percentageComplete = 0,
    deviceId,
    updatedAt,
  } = req.body;

  const progress = await upsertProgress({
    userId,
    resourceId,
    resourceType,
    position,
    percentageComplete: Number(percentageComplete),
    deviceId,
    updatedAt,
  });

  const io =
    req.app?.get('io') ||
    (() => {
      try {
        return require('../sockets').getIo();
      } catch {
        return null;
      }
    })();

  if (io) {
    io.to(`user:${userId}`).emit('progress:updated', {
      resourceId,
      position: progress.position,
      percentageComplete: progress.percentageComplete,
    });
  }

  res.json({
    success: true,
    data: progress,
  });
});

module.exports = {
  getReadingProgress,
  updateReadingProgress,
};
