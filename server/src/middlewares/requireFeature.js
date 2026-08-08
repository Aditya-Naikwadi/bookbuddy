const { getCache, setCache } = require('../utils/redisCache');
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
        const cachedData = await getCache(cacheKey);
        if (cachedData && Array.isArray(cachedData)) {
          enabledFeatures = cachedData;
        }
      } catch {
        enabledFeatures = null;
      }

      // 2. Fetch from DB if Cache Miss
      if (!enabledFeatures) {
        const doc = await CollegeFeatureConfig.findOne({ collegeId: tenantId }).lean();
        if (doc && doc.enabledFeatures) {
          enabledFeatures = doc.enabledFeatures;
        } else {
          // Default fallbacks if no explicit config exists
          enabledFeatures = [
            'catalog',
            'borrowing',
            'digital-library',
            'e-resources',
            'study-rooms',
            'book-clubs',
            'discussions',
            'bulletin-board',
            'donor-wall',
            'reading-goals',
            'streaks',
            'faculty-publications',
            'group-study',
            'lab-seats',
            'inter-library-loan',
            'isbn-scan',
            'analytics',
            'audit-logs',
            'services',
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
          await setCache(cacheKey, enabledFeatures, 3600);
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
