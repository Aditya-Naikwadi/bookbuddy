const AppError = require('../utils/AppError');
const { getCollegeFeatures } = require('../services/serviceCatalogService');

/**
 * Express middleware to enforce server-side feature flag permissions per tenant.
 * @param {string} featureKey The feature key required to access the route
 */
const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required.', 401));
      }

      // Super-admins bypass tenant feature flags
      if (req.user.role === 'super-admin' || req.user.role === 'super_admin') {
        return next();
      }

      const collegeId = req.user.collegeId;
      if (!collegeId) {
        return next(new AppError('User is not associated with an institution tenant.', 403));
      }

      const featuresData = await getCollegeFeatures(collegeId.toString());
      const enabledFeatures = featuresData.enabledFeatures || [];

      if (!enabledFeatures.includes(featureKey.toLowerCase())) {
        return next(
          new AppError(
            `Access Forbidden: Feature '${featureKey}' is not licensed or enabled for your institution.`,
            403
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = requireFeature;
