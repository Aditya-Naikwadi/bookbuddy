const asyncHandler = require('../utils/asyncHandler');
const EResource = require('../models/EResource');
const AppError = require('../utils/AppError');
const { recordQualifyingAction } = require('../services/streakService');

// @desc    Get internal e-resources
// @route   GET /api/eresources
// @access  Private
const listInternalResources = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const query = { source: 'internal', moderationStatus: 'approved', ...req.tenantFilter };

  if (req.query.search) {
    query.title = { $regex: req.query.search, $options: 'i' };
  }

  const total = await EResource.countDocuments(query);
  const resources = await EResource.find(query).skip(skip).limit(limit).sort('-createdAt');

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

  const submissions = await EResource.find({ uploadedBy: userId }).sort({ createdAt: -1 }).lean();

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

module.exports = {
  listInternalResources,
  submitEResource,
  getMySubmissions,
  updateProgress,
};
