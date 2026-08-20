const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Book = require('../models/Book');
const EResource = require('../models/EResource');
const ShareRequest = require('../models/ShareRequest');
const { validateTransition } = require('../utils/shareRequestStateMachine');

// @desc    Create cross-college share request (F6.4)
// @route   POST /api/v1/share-requests OR POST /api/share-requests
// @access  Private (Student / Admin)
const createShareRequest = asyncHandler(async (req, res) => {
  const { resourceId, resourceType } = req.body;

  if (!resourceId || !resourceType) {
    throw new AppError('resourceId and resourceType (book/eresource) are required.', 400);
  }

  const normType = resourceType.toLowerCase();
  let resource;
  let resourceTypeModel;

  if (normType === 'book') {
    resource = await Book.findById(resourceId);
    resourceTypeModel = 'Book';
  } else if (normType === 'eresource') {
    resource = await EResource.findById(resourceId);
    resourceTypeModel = 'EResource';
  } else {
    throw new AppError("Invalid resourceType. Must be 'book' or 'eresource'.", 400);
  }

  if (!resource) {
    throw new AppError('Target resource not found.', 404);
  }

  // Validate target resource has opted into cross-college sharing
  if (!resource.isShareableAcrossColleges) {
    throw new AppError(
      'Resource is not enabled for cross-college sharing by its owning institution.',
      400
    );
  }

  // ACCEPTANCE CRITERIA F6.4: requestingCollegeId is ALWAYS taken from req.user.collegeId,
  // NEVER trusted from the client body. Client-supplied requestingCollegeId is strictly ignored.
  const requestingCollegeId = req.user.collegeId;
  const owningCollegeId = resource.collegeId;
  const userId = req.user.id || req.user._id;

  const shareRequest = await ShareRequest.create({
    resourceId: resource._id,
    resourceTypeModel,
    resourceType: normType,
    owningCollegeId,
    requestingCollegeId,
    requestedBy: userId,
    status: 'requested',
    statusHistory: [
      {
        status: 'requested',
        at: new Date(),
        by: userId,
      },
    ],
  });

  res.status(201).json({
    success: true,
    message: 'Cross-college share request created successfully.',
    data: shareRequest,
  });
});

// @desc    Update share request status (Approve / Reject / In-Transit / Fulfilled) (F6.5)
// @route   PATCH /api/v1/share-requests/:id OR PATCH /api/share-requests/:id
// @access  Private (Owning College Admin Only)
const updateShareRequestStatus = asyncHandler(async (req, res) => {
  const { status: newStatus } = req.body;
  const userId = req.user.id || req.user._id;

  if (!newStatus) {
    throw new AppError('New status is required.', 400);
  }

  const shareRequest = await ShareRequest.findById(req.params.id);
  if (!shareRequest) {
    throw new AppError('Share request not found.', 404);
  }

  // ACCEPTANCE CRITERIA F6.5: Verify requesting admin belongs specifically to
  // ShareRequest.owningCollegeId — not merely "is an admin of some college."
  if (req.user.collegeId.toString() !== shareRequest.owningCollegeId.toString()) {
    throw new AppError(
      'Forbidden: Only the administrator of the owning college can approve, reject, or update this share request.',
      403
    );
  }

  // Apply F6.2 state transition validator
  validateTransition(shareRequest.status, newStatus);

  shareRequest.status = newStatus;
  if (newStatus === 'approved') {
    shareRequest.approvedBy = userId;
  }
  shareRequest.statusHistory.push({
    status: newStatus,
    at: new Date(),
    by: userId,
  });

  await shareRequest.save();

  // F6.6: Targeted Status-change notifications (both sides)
  // ACCEPTANCE CRITERIA: Notify exactly the two relevant parties — never broadcast to whole college.
  try {
    const socketModule = require('../sockets');
    const io =
      (req.app && typeof req.app.get === 'function' ? req.app.get('io') : null) ||
      (socketModule && typeof socketModule.getIO === 'function' ? socketModule.getIO() : null);

    if (io) {
      const notificationPayload = {
        requestId: shareRequest._id,
        status: newStatus,
        resourceId: shareRequest.resourceId,
        resourceType: shareRequest.resourceType,
        updatedAt: new Date(),
      };

      // 1. Notify requesting student's isolated user room
      io.to(`user:${shareRequest.requestedBy.toString()}`).emit(
        'share-request:status',
        notificationPayload
      );

      // 2. Notify updating owning admin's isolated user room
      io.to(`user:${userId.toString()}`).emit('share-request:status', notificationPayload);
    }
  } catch (socketErr) {
    // Non-blocking socket emission fallback
  }

  res.json({
    success: true,
    message: `Share request status updated to '${newStatus}'.`,
    data: shareRequest,
  });
});

// @desc    Get Incoming Share Requests Queue (Owning College Admin Only) (F6.7)
// @route   GET /api/v1/share-requests/incoming OR GET /api/share-requests/incoming
// @access  Private (College Admin)
const getIncomingShareRequests = asyncHandler(async (req, res) => {
  // ACCEPTANCE CRITERIA F6.7: Lists ShareRequests where owningCollegeId matches
  // the logged-in admin's own college. Crafted query parameter overrides are strictly ignored.
  const owningCollegeId = req.user.collegeId;

  const incomingRequests = await ShareRequest.find({ owningCollegeId })
    .populate('owningCollegeId', 'name shortName')
    .populate('requestingCollegeId', 'name shortName')
    .populate('requestedBy', 'name email studentId')
    .sort('-createdAt');

  res.json({
    success: true,
    data: incomingRequests,
  });
});

// @desc    List share requests (Incoming or Outgoing)
// @route   GET /api/v1/share-requests OR GET /api/share-requests
// @access  Private
const getShareRequests = asyncHandler(async (req, res) => {
  const collegeId = req.user.collegeId;

  const requests = await ShareRequest.find({
    $or: [{ owningCollegeId: collegeId }, { requestingCollegeId: collegeId }],
  })
    .populate('owningCollegeId', 'name shortName')
    .populate('requestingCollegeId', 'name shortName')
    .populate('requestedBy', 'name email studentId')
    .sort('-createdAt');

  res.json({
    success: true,
    data: requests,
  });
});

module.exports = {
  createShareRequest,
  updateShareRequestStatus,
  getIncomingShareRequests,
  getShareRequests,
};
