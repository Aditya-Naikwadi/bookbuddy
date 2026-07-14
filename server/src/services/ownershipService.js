// Business service helper for asserting resource ownership.
const AppError = require('../utils/AppError');

const assertOwner = (resource, userId) => {
  if (!resource) {
    throw new AppError('Resource not found.', 404);
  }

  // Determine owner field dynamically based on schema definitions
  const ownerId = resource.ownerId || resource.userId || resource.uploadedBy;

  if (!ownerId) {
    throw new AppError('Ownership cannot be determined for this resource.', 400);
  }

  if (ownerId.toString() !== userId.toString()) {
    throw new AppError('You do not have permission to perform this action on this resource.', 403);
  }
};

module.exports = {
  assertOwner,
};
