const asyncHandler = require('../utils/asyncHandler');
const EResource = require('../models/EResource');
const AppError = require('../utils/AppError');
const { recordQualifyingAction } = require('../services/streakService');
const { scopeToCollege } = require('../middlewares/scopeToCollege');

// @desc    Get internal e-resources
// @route   GET /api/eresources
// @access  Private
const listInternalResources = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  let filter = { source: 'internal', moderationStatus: 'approved' };
  if (req.query.search) {
    filter.title = { $regex: req.query.search, $options: 'i' };
  }

  const scopedQuery = scopeToCollege(filter, req.user?.collegeId);

  const total = await EResource.countDocuments(scopedQuery);
  const resources = await EResource.find(scopedQuery).skip(skip).limit(limit).sort('-createdAt');

  res.json({
    success: true,
    data: resources,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// @desc    Student upload material for moderation
// @route   POST /api/eresources/submit
// @access  Private (Student)
const submitEResource = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { title, category, description } = req.body;

  if (!title) {
    throw new AppError('Title is required for material submission.', 400);
  }

  const fileUrl = req.file
    ? `/uploads/ebooks/${req.file.filename}`
    : `/uploads/ebooks/student-${Date.now()}.pdf`;

  const resource = await EResource.create({
    collegeId: req.user.collegeId,
    title,
    category: category || 'General Academic',
    description: description || '',
    type: req.file && req.file.originalname?.endsWith('.epub') ? 'epub' : 'pdf',
    fileUrl,
    uploadedBy: userId,
    moderationStatus: 'pending',
    source: 'internal',
    sourceType: 'student-upload',
    uploadStatus: 'available',
  });

  res.status(201).json({
    success: true,
    message: 'E-resource material submitted successfully. Pending staff moderation.',
    data: resource,
  });
});

// @desc    Get student's own submissions
// @route   GET /api/eresources/my-submissions
// @access  Private (Student)
const getMySubmissions = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;

  const scopedQuery = scopeToCollege({ uploadedBy: userId }, req.user?.collegeId);
  const submissions = await EResource.find(scopedQuery).sort({ createdAt: -1 }).lean();

  res.json({
    success: true,
    data: submissions,
  });
});

// @desc    Update progress
// @route   POST /api/eresources/:id/progress
// @access  Private
const updateProgress = asyncHandler(async (req, res) => {
  const { dailySecondsToday } = req.body;

  if (dailySecondsToday >= 180) {
    await recordQualifyingAction(req.user.id, req.user.collegeId, 'eresource');
  }

  res.json({ success: true, message: 'Progress updated' });
});

// @desc    Issue temporary signed offline download token (DRM-light 15-min TTL)
// @route   POST /api/v1/eresources/:id/offline-token
// @access  Private
const issueOfflineToken = asyncHandler(async (req, res) => {
  const jwt = require('jsonwebtoken');
  const scopedQuery = scopeToCollege({ _id: req.params.id }, req.user?.collegeId);
  const resource = await EResource.findOne(scopedQuery);

  if (!resource) {
    throw new AppError('E-resource not found or access denied.', 404);
  }

  const token = jwt.sign(
    {
      userId: req.user.id,
      collegeId: req.user.collegeId,
      resourceId: resource._id,
      downloadAllowed: true,
    },
    process.env.JWT_SECRET || 'bookbuddy-secret-key-2026',
    { expiresIn: '15m' }
  );

  res.json({
    success: true,
    data: {
      token,
      expiresInSeconds: 900,
      resourceId: resource._id,
      title: resource.title,
      downloadUrl: `/api/v1/reader/${resource._id}/content?token=${token}`,
    },
  });
});

// @desc    Get signed download URL for an e-resource (DRM-light / Offline mode)
// @route   GET /api/v1/eresources/:id/download-url OR GET /api/eresources/:id/download-url
// @access  Private
const getSignedDownloadUrl = asyncHandler(async (req, res) => {
  const jwt = require('jsonwebtoken');
  const DownloadLog = require('../models/DownloadLog');

  const resourceId = req.params.id || req.params.eresourceId;
  const scopedQuery = scopeToCollege({ _id: resourceId }, req.user?.collegeId);
  const resource = await EResource.findOne(scopedQuery);

  if (!resource) {
    throw new AppError('E-resource not found or access denied.', 404);
  }

  // ACCEPTANCE CRITERIA: A direct API call against a resource with isDownloadable: false
  // never returns a usable URL, regardless of the caller's role.
  if (!resource.isDownloadable) {
    throw new AppError(
      'Forbidden: This e-resource has not been enabled for offline download by the library administrator',
      403
    );
  }

  // Create audit record in DownloadLog on every signed URL issuance
  await DownloadLog.create({
    userId: req.user.id || req.user._id,
    resourceId: resource._id,
    downloadedAt: new Date(),
  });

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min TTL
  const token = jwt.sign(
    {
      userId: req.user.id || req.user._id,
      collegeId: req.user.collegeId,
      resourceId: resource._id,
      isDownloadable: true,
    },
    process.env.JWT_SECRET || 'bookbuddy-secret-key-2026',
    { expiresIn: '15m' }
  );

  const downloadUrl = `${resource.fileUrl}?token=${token}&expires=${expiresAt.getTime()}`;

  res.json({
    success: true,
    downloadUrl,
    expiresAt,
    expiresInSeconds: 900,
    data: {
      resourceId: resource._id,
      title: resource.title,
      isDownloadable: resource.isDownloadable,
      downloadUrl,
    },
  });
});

module.exports = {
  listInternalResources,
  submitEResource,
  getMySubmissions,
  updateProgress,
  issueOfflineToken,
  getSignedDownloadUrl,
};
