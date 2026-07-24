const AppError = require('./AppError');

/**
 * Repository helper to enforce tenant isolation at query-definition level.
 * Guarantees collegeId scoping is derived solely from the authenticated user token,
 * never from client-supplied params or bodies.
 */
const tenantScope = (model, req) => {
  if (!req.user || !req.user.collegeId) {
    throw new AppError('Tenant scoping requires authenticated request.', 401);
  }

  const tenantFilter = { collegeId: req.user.collegeId };

  return {
    find: (filter = {}) => model.find({ ...filter, ...tenantFilter }),
    findOne: (filter = {}) => model.findOne({ ...filter, ...tenantFilter }),
    findById: (id) => model.findOne({ _id: id, ...tenantFilter }),
    countDocuments: (filter = {}) => model.countDocuments({ ...filter, ...tenantFilter }),
    findOneAndUpdate: (filter = {}, update = {}, options = {}) =>
      model.findOneAndUpdate({ ...filter, ...tenantFilter }, update, { returnDocument: 'after', ...options }),
    updateOne: (filter = {}, update = {}) =>
      model.updateOne({ ...filter, ...tenantFilter }, update),
  };
};

module.exports = tenantScope;
