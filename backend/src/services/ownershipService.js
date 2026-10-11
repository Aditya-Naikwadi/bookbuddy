// Centralized business service helper for asserting resource ownership and object-level authorization (BOLA/IDOR protection).
const AppError = require('../utils/AppError');

/**
 * Asserts that the authenticated user owns the resource.
 * Throws a uniform 404 so that resource existence is never leaked to unauthorized users.
 *
 * @param {Object} resource - Mongoose document or plain object
 * @param {string|ObjectId} userId - Authenticated user ID from verified token/session
 * @param {Object} [options]
 * @param {number} [options.statusCode=404] - Status code on unauthorized (defaults to uniform 404)
 * @param {string} [options.message='Resource not found.'] - Error message
 */
const assertOwner = (resource, userId, options = {}) => {
  const {
    statusCode = 403,
    message = 'You do not have permission to perform this action on this resource.',
  } = options;

  if (!resource) {
    throw new AppError('Resource not found.', 404);
  }

  // Determine owner field dynamically based on schema definitions
  const ownerId =
    resource.ownerId?._id ||
    resource.ownerId ||
    resource.userId?._id ||
    resource.userId ||
    resource.uploadedBy?._id ||
    resource.uploadedBy ||
    resource.authorId?._id ||
    resource.authorId ||
    resource.submittedBy?._id ||
    resource.submittedBy;

  if (!ownerId) {
    throw new AppError('Ownership cannot be determined for this resource.', 400);
  }

  const cleanUserId = userId ? userId.toString() : '';
  const cleanOwnerId = ownerId.toString();

  if (cleanOwnerId !== cleanUserId) {
    throw new AppError(message, statusCode);
  }
};

/**
 * Checks whether the current authenticated request has permission to access an object.
 * Permits:
 * 1. Root Super Admin globally
 * 2. College Admin strictly within their own college/tenant
 * 3. Resource owner
 *
 * Returns uniform 404 on failure to prevent existence enumeration.
 */
const checkObjectAuthorization = (resource, req, options = {}) => {
  const { message = 'Resource not found.', allowCollegeAdmin = true } = options;

  if (!resource) {
    throw new AppError(message, 404);
  }

  const user = req.user;
  if (!user) {
    throw new AppError('Authentication required.', 401);
  }

  // 1. Super admin is authorized across institutions
  if (user.role === 'super-admin' || user.role === 'super_admin') {
    return true;
  }

  // 2. Tenant isolation check for college-admin
  if (
    allowCollegeAdmin &&
    (user.role === 'college-admin' || user.role === 'college_admin' || user.role === 'admin')
  ) {
    const resourceCollegeId = resource.collegeId?._id || resource.collegeId;
    const userCollegeId = user.collegeId;
    if (
      resourceCollegeId &&
      userCollegeId &&
      resourceCollegeId.toString() === userCollegeId.toString()
    ) {
      return true;
    }
  }

  // 3. User ownership check
  const currentUserId = (user.id || user._id)?.toString();
  const ownerId = (
    resource.ownerId?._id ||
    resource.ownerId ||
    resource.userId?._id ||
    resource.userId ||
    resource.uploadedBy?._id ||
    resource.uploadedBy ||
    resource.authorId?._id ||
    resource.authorId ||
    resource.submittedBy?._id ||
    resource.submittedBy
  )?.toString();

  if (currentUserId && ownerId && currentUserId === ownerId) {
    return true;
  }

  // Uniform 404 to avoid leaking existence of another user's/college's object
  throw new AppError(message, 404);
};

module.exports = {
  assertOwner,
  checkObjectAuthorization,
};
