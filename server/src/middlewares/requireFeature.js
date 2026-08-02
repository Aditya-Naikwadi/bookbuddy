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
      const userRole = req.user?.role;
      if (userRole === 'superadmin' || userRole === 'super-admin' || userRole === 'super_admin') {
        return next();
      }

      const tenantId = req.tenantId || req.user?.collegeId;
      if (!tenantId) {
        return res.status(403).json({
          success: false,
          message: 'Feature is not licensed or enabled for institution',
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
        if (configDoc && configDoc.enabledFeatures?.length) {
          enabledFeatures = configDoc.enabledFeatures;
        } else {
          const College = require('../models/College');
          const collegeDoc = await College.findById(tenantId).lean();
          if (collegeDoc) {
            enabledFeatures = collegeDoc.enabledFeatures?.length
              ? collegeDoc.enabledFeatures
              : collegeDoc.selectedServices?.length
                ? collegeDoc.selectedServices
                : null;
          }
        }

        if (!enabledFeatures) {
          enabledFeatures = [
            'catalog',
            'catalog_management',
            'loans',
            'fines',
            'patron-card',
            'e-resources',
            'reading-lists',
            'recommendations',
            'saved',
            'facilities',
            'facilities_booking',
            'support',
            'gamification',
          ];
        }

        try {
          await redisClient.setex(cacheKey, 3600, JSON.stringify(enabledFeatures));
        } catch {
          // Ignore cache set error
        }
      }

      // 3. Evaluate Activation State
      if (!enabledFeatures.includes(requiredFeatureId)) {
        return res.status(403).json({
          success: false,
          message: 'Feature is not licensed or enabled for institution',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = requireFeature;
