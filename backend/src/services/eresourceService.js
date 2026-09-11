// Business service for filtering and managing approved digital assets.

const getApprovedResourcesFilter = (tenantFilter) => {
  return {
    ...tenantFilter,
    moderationStatus: { $in: ['approved', 'published'] },
  };
};

module.exports = {
  getApprovedResourcesFilter,
};
