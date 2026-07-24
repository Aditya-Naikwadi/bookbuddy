const Service = require('../models/Service');
const AppError = require('../utils/AppError');
const { getCollegeFeatures, updateCollegeFeatures } = require('../services/serviceCatalogService');

// @desc    List all available active services in catalog
// @route   GET /api/services/available
// @access  Public / Authenticated
const getAvailableServices = async (req, res, next) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ category: 1, name: 1 }).lean();
    res.json({
      success: true,
      data: services,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get tenant enabled features & limits
// @route   GET /api/college/:id/features
// @access  Private (Tenant Admin / Student / Super Admin)
const getCollegeFeaturesHandler = async (req, res, next) => {
  try {
    const { id: collegeId } = req.params;

    // Tenant isolation check
    if (
      req.user.role !== 'super-admin' &&
      req.user.role !== 'super_admin' &&
      req.user.collegeId?.toString() !== collegeId
    ) {
      return next(new AppError('Unauthorized access to another tenant\'s features.', 403));
    }

    const data = await getCollegeFeatures(collegeId);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update tenant selected services & feature limits
// @route   PATCH /api/college/:id/features
// @access  Private (College Admin / Super Admin)
const updateCollegeFeaturesHandler = async (req, res, next) => {
  try {
    const { id: collegeId } = req.params;
    const { selectedServices, featureLimits } = req.body;

    // Tenant isolation check
    if (
      req.user.role !== 'super-admin' &&
      req.user.role !== 'super_admin' &&
      req.user.collegeId?.toString() !== collegeId
    ) {
      return next(new AppError('Unauthorized modification of another tenant\'s features.', 403));
    }

    if (!Array.isArray(selectedServices)) {
      return next(new AppError('selectedServices must be an array of service keys.', 400));
    }

    const updatedFeatures = await updateCollegeFeatures(collegeId, selectedServices, featureLimits);

    res.json({
      success: true,
      message: 'College feature configuration updated successfully.',
      data: updatedFeatures,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAvailableServices,
  getCollegeFeaturesHandler,
  updateCollegeFeaturesHandler,
};
