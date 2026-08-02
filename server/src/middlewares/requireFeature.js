const redisClient = require('../utils/redisCache');
const CollegeFeatureConfig = require('../models/CollegeFeatureConfig');

/**
 * Feature Gating Middleware Generator
 * Checks if the specified feature is activated for the tenant.
 * Uses Redis caching (1hr TTL) to avoid N+1 database lookups on every request.
 * Returns 404 Not Found if feature is disabled to prevent cross-tenant resource enumeration.
 */
function requireFeature(requiredFeatureId) {
  return async (req, res, next) => {
    try {
      // Allow SuperAdmin bypass
      if (req.user && req.user.role === 'superadmin') {
        return next();
      }

      const tenantId = req.tenantId || req.user?.collegeId;
      if (!tenantId) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found',
        });
      }

      const cacheKey = `college:features:${tenantId}`;
      let enabledFeatures = null;

      // 1. Try Redis Cache Lookup
      try {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          enabledFeatures = JSON.parse(cachedData);
        }
      } catch {
        // Log cache miss/error silently and fallback to DB
      }

      // 2. Fallback to Database if cache miss
      if (!enabledFeatures) {
        const configDoc = await CollegeFeatureConfig.findOne({ collegeId: tenantId }).lean();
        enabledFeatures = configDoc
          ? configDoc.enabledFeatures || []
          : [
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

        try {
          await redisClient.setex(cacheKey, 3600, JSON.stringify(enabledFeatures));
        } catch {
          // Ignore cache set error
        }
      }

      // 3. Evaluate Activation State
      if (!enabledFeatures.includes(requiredFeatureId)) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found or disabled for institution',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = requireFeature;
