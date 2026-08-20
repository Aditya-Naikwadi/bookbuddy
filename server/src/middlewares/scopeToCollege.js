const mongoose = require('mongoose');

/**
 * Helper function to explicitly scope a query/filter object to a target collegeId.
 * Usage: const filter = scopeToCollege(req.query, req.user?.collegeId);
 */
function scopeToCollege(filter = {}, collegeId = null) {
  const baseFilter = filter ? { ...filter } : {};
  if (!collegeId) {
    return baseFilter;
  }

  // Convert string to ObjectId if valid
  const tenantId = mongoose.Types.ObjectId.isValid(collegeId)
    ? new mongoose.Types.ObjectId(collegeId)
    : collegeId;

  // Handle case where $or query exists or merge directly
  if (baseFilter.$or && Array.isArray(baseFilter.$or)) {
    return {
      $and: [{ collegeId: tenantId }, baseFilter],
    };
  }

  return {
    ...baseFilter,
    collegeId: tenantId,
  };
}

/**
 * Express Middleware: Extracts collegeId from authenticated user and populates req.tenantFilter & req.collegeId
 */
const scopeToCollegeMiddleware = (req, res, next) => {
  if (req.user && req.user.role !== 'super-admin' && req.user.role !== 'super_admin') {
    const userCollegeId = req.user.collegeId;
    if (userCollegeId && mongoose.Types.ObjectId.isValid(userCollegeId)) {
      req.tenantFilter = { collegeId: new mongoose.Types.ObjectId(userCollegeId) };
      req.collegeId = userCollegeId;
    } else {
      req.tenantFilter = { collegeId: userCollegeId || null };
      req.collegeId = userCollegeId || null;
    }
  } else {
    req.tenantFilter = {};
    req.collegeId = null;
  }
  next();
};

/**
 * Mongoose Schema Plugin: Automatically injects collegeId filtering on tenant-owned collections.
 */
function tenantScopingPlugin(schema) {
  // Ensure collegeId path exists on schema
  if (!schema.path('collegeId')) {
    schema.add({
      collegeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'College',
        required: true,
        index: true,
      },
    });
  }

  function applyTenantFilter(next) {
    if (this.options && this.options.skipTenantScope === true) {
      if (typeof next === 'function') return next();
      return;
    }

    const currentTenantId = this.options ? this.options.tenantId || this.options.collegeId : null;
    if (currentTenantId) {
      const tenantObjectId = mongoose.Types.ObjectId.isValid(currentTenantId)
        ? new mongoose.Types.ObjectId(currentTenantId)
        : currentTenantId;

      this.where({ collegeId: tenantObjectId });
    }
    if (typeof next === 'function') {
      next();
    }
  }

  schema.pre('find', applyTenantFilter);
  schema.pre('findOne', applyTenantFilter);
  schema.pre('findOneAndUpdate', applyTenantFilter);
  schema.pre('countDocuments', applyTenantFilter);
  schema.pre('updateOne', applyTenantFilter);
  schema.pre('updateMany', applyTenantFilter);

  schema.pre('validate', function (next) {
    if (this.$options && this.$options.skipTenantScope) {
      if (typeof next === 'function') return next();
      return;
    }
    if (this.isNew && !this.collegeId) {
      const err = new Error(
        'CRITICAL TENANT ERROR: Cannot save tenant document without a valid collegeId'
      );
      if (typeof next === 'function') return next(err);
      throw err;
    }
    if (typeof next === 'function') {
      next();
    }
  });
}

module.exports = scopeToCollege;
module.exports.scopeToCollege = scopeToCollege;
module.exports.scopeToCollegeMiddleware = scopeToCollegeMiddleware;
module.exports.tenantScopingPlugin = tenantScopingPlugin;
