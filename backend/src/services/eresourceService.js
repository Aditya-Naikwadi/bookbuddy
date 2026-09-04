// Business service for filtering and managing approved digital assets.

const getApprovedResourcesFilter = (tenantFilter) => {
  return {
    ...tenantFilter,
    moderationStatus: 'approved',
  };
};

module.exports = {
  getApprovedResourcesFilter,
};
