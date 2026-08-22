const College = require('../models/College');
const CollegeFeatureConfig = require('../models/CollegeFeatureConfig');
const FeatureCatalog = require('../models/FeatureCatalog');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

// Default full list of features if configuration is absent
const DEFAULT_STUDENT_FEATURES = [
  'catalog',
  'loans',
  'fines',
  'patron-card',
  'e-resources',
  'reading-lists',
  'recommendations',
  'saved',
  'facilities',
  'support',
  'gamification',
];

/**
 * @desc    Get current feature configuration for the college admin's tenant
 * @route   GET /api/colleges/my-config
 * @access  Private (CollegeAdmin)
 */
const getMyCollegeConfig = asyncHandler(async (req, res, next) => {
  const collegeId = req.tenantId || req.user.collegeId;

  const college = await College.findById(collegeId)
    .select(
      'name shortName slug domain domainWhitelist logoUrl status enabledFeatures selectedServices'
    )
    .lean();
  if (!college) {
    return next(new AppError('College institution record not found', 404));
  }

  const initialFeatures =
    Array.isArray(college.enabledFeatures) && college.enabledFeatures.length > 0
      ? college.enabledFeatures
      : Array.isArray(college.selectedServices) && college.selectedServices.length > 0
        ? college.selectedServices
        : DEFAULT_STUDENT_FEATURES;

  let config = await CollegeFeatureConfig.findOne({ collegeId }).lean();
  if (!config) {
    config = await CollegeFeatureConfig.create({
      collegeId,
      enabledFeatures: initialFeatures,
      pendingRequests: [],
    });
    config = config.toObject();
  }

  res.json({
    success: true,
    data: {
      college,
      enabledFeatures: config.enabledFeatures || initialFeatures,
      pendingRequests: config.pendingRequests || [],
      customSettings: config.customSettings || {},
    },
  });
});

/**
 * @desc    Enable feature (self-serve) or request approval for gated features
 * @route   POST /api/colleges/features/enable
 * @access  Private (CollegeAdmin)
 */
const enableOrRequestFeature = asyncHandler(async (req, res, next) => {
  const collegeId = req.tenantId || req.user.collegeId;
  const { featureId, enabledFeatures: bulkFeatures, reason } = req.body;

  let config = await CollegeFeatureConfig.findOne({ collegeId });
  if (!config) {
    const college = await College.findById(collegeId)
      .select('enabledFeatures selectedServices')
      .lean();
    const initial =
      college && college.enabledFeatures && college.enabledFeatures.length > 0
        ? college.enabledFeatures
        : college && college.selectedServices && college.selectedServices.length > 0
          ? college.selectedServices
          : DEFAULT_STUDENT_FEATURES;

    config = new CollegeFeatureConfig({
      collegeId,
      enabledFeatures: initial,
      pendingRequests: [],
    });
  }

  // Handle bulk feature set update if enabledFeatures array is provided
  if (Array.isArray(bulkFeatures)) {
    config.enabledFeatures = bulkFeatures;
    await config.save();
    await College.findByIdAndUpdate(collegeId, {
      enabledFeatures: bulkFeatures,
      selectedServices: bulkFeatures,
    }).catch(() => {});

    return res.json({
      success: true,
      status: 'updated',
      message: 'Feature configuration updated successfully.',
      data: config,
    });
  }

  if (!featureId) {
    return next(new AppError('Feature ID or enabledFeatures array is required', 400));
  }

  // Check FeatureCatalog if defined, default to self-serve if absent
  const catalogItem = await FeatureCatalog.findOne({ featureId: featureId.toLowerCase() }).lean();
  const requiresApproval = catalogItem ? catalogItem.requiresApproval : false;

  if (config.enabledFeatures.includes(featureId)) {
    return res.json({
      success: true,
      message: 'Feature is already active for your institution',
      data: config,
    });
  }

  if (requiresApproval) {
    // Add to pending approval requests
    config.pendingRequests.push({
      featureId,
      requestedBy: req.user._id,
      reason: reason || 'Requesting module activation',
      status: 'pending',
    });
    await config.save();

    return res.json({
      success: true,
      status: 'requested',
      message: 'Feature request submitted for SuperAdmin approval.',
      data: config,
    });
  } else {
    // Self-serve activation
    config.enabledFeatures.push(featureId);
    await config.save();
    await College.findByIdAndUpdate(collegeId, { $addToSet: { enabledFeatures: featureId } }).catch(
      () => {}
    );

    return res.json({
      success: true,
      status: 'activated',
      message: 'Feature activated successfully!',
      data: config,
    });
  }
});

/**
 * @desc    Get public college metadata & enabled features by slug for scoped student portal
 * @route   GET /api/colleges/public/:slug
 * @access  Public
 */
const getPublicCollegeBySlug = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;
  const normalizedSlug = slug.toLowerCase().trim();

  // Search active slug or formerSlugs redirect
  let college = await College.findOne({ slug: normalizedSlug, status: 'active' })
    .select('name slug logoUrl domainWhitelist metadata status')
    .lean();

  if (!college) {
    // Check formerSlugs for 301 redirect mapping
    const formerCollege = await College.findOne({
      formerSlugs: normalizedSlug,
      status: 'active',
    }).lean();
    if (formerCollege) {
      return res.status(301).json({
        success: true,
        redirectSlug: formerCollege.slug,
        message: 'College slug has changed. Please use updated URL.',
      });
    }
    return next(new AppError('College not found or portal inactive.', 404));
  }

  const config = await CollegeFeatureConfig.findOne({ collegeId: college._id }).lean();
  const enabledFeatures = config ? config.enabledFeatures : DEFAULT_STUDENT_FEATURES;

  res.json({
    success: true,
    data: {
      name: college.name,
      slug: college.slug,
      enabledFeatures,
    },
  });
});

/**
 * @desc    Check slug availability for public registration URL
 * @route   GET /api/colleges/slug-check
 * @access  Public
 */
const checkSlugAvailability = asyncHandler(async (req, res, next) => {
  const { slug } = req.query;
  if (!slug) {
    return next(new AppError('Slug query parameter is required', 400));
  }

  const normalizedSlug = slug.toLowerCase().trim();
  const existing = await College.findOne({
    $or: [{ slug: normalizedSlug }, { formerSlugs: normalizedSlug }],
  }).lean();

  if (existing) {
    const suggestedSlug = `${normalizedSlug}-${Math.floor(100 + Math.random() * 900)}`;
    return res.json({
      available: false,
      suggestedSlug,
      message: 'Slug is already taken.',
    });
  }

  res.json({
    available: true,
    message: 'Slug is available.',
  });
});

module.exports = {
  getMyCollegeConfig,
  enableOrRequestFeature,
  getPublicCollegeBySlug,
  checkSlugAvailability,
};
