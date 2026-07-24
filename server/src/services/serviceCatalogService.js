const Service = require('../models/Service');
const College = require('../models/College');
const { getCache, setCache, deleteCache } = require('../utils/redisCache');
const AppError = require('../utils/AppError');

/**
 * Resolves the full list of enabled features (selected + transitive dependencies).
 * @param {Array<string>} selectedKeys Raw service keys chosen
 * @returns {Promise<Array<string>>} Resolved unique feature keys
 */
const resolveEnabledFeatures = async (selectedKeys = []) => {
  const activeServices = await Service.find({ isActive: true }).lean();
  const serviceMap = new Map();
  activeServices.forEach((s) => serviceMap.set(s.key, s));

  const resolvedSet = new Set();

  const addServiceAndDeps = (key) => {
    if (!key || resolvedSet.has(key)) return;
    const service = serviceMap.get(key);
    if (!service) return;

    resolvedSet.add(key);

    if (Array.isArray(service.dependsOn)) {
      for (const depKey of service.dependsOn) {
        addServiceAndDeps(depKey);
      }
    }
  };

  for (const rawKey of selectedKeys) {
    addServiceAndDeps(rawKey.toLowerCase().trim());
  }

  return Array.from(resolvedSet).sort();
};

/**
 * Gets tenant features (from Redis cache or Mongo DB).
 * @param {string} collegeId
 * @returns {Promise<{ enabledFeatures: Array<string>, featureLimits: Object, selectedServices: Array<string> }>}
 */
const getCollegeFeatures = async (collegeId) => {
  const cacheKey = `college:features:${collegeId}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const college = await College.findById(collegeId)
    .select('selectedServices enabledFeatures featureLimits')
    .lean();

  if (!college) {
    throw new AppError('College tenant not found.', 404);
  }

  const result = {
    selectedServices: college.selectedServices || [],
    enabledFeatures: college.enabledFeatures || [],
    featureLimits: college.featureLimits || {},
  };

  await setCache(cacheKey, result, 300);
  return result;
};

/**
 * Updates selected services and feature limits for a college, re-resolves enabledFeatures, and invalidates cache.
 * @param {string} collegeId
 * @param {Array<string>} selectedServices
 * @param {Object} featureLimits
 * @returns {Promise<Object>} Updated college features object
 */
const updateCollegeFeatures = async (collegeId, selectedServices, featureLimits) => {
  const college = await College.findById(collegeId);
  if (!college) {
    throw new AppError('College tenant not found.', 404);
  }

  const resolvedFeatures = await resolveEnabledFeatures(selectedServices);

  college.selectedServices = selectedServices;
  college.enabledFeatures = resolvedFeatures;
  if (featureLimits !== undefined) {
    college.featureLimits = featureLimits;
  }

  await college.save();

  const cacheKey = `college:features:${collegeId}`;
  await deleteCache(cacheKey);

  return {
    selectedServices: college.selectedServices,
    enabledFeatures: college.enabledFeatures,
    featureLimits: college.featureLimits,
  };
};

module.exports = {
  resolveEnabledFeatures,
  getCollegeFeatures,
  updateCollegeFeatures,
};
