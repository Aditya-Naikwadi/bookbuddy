const mongoose = require('mongoose');

function tenantScopingPlugin(schema) {
  // Ensure every tenant-scoped collection carries collegeId and index
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

  // Helper function to apply tenant filter automatically
  function applyTenantFilter(next) {
    const opts = typeof this.getOptions === 'function' ? this.getOptions() : this.options || {};
    // Skip scoping if explicitly running in SuperAdmin system bypass context
    if (opts.skipTenantScope === true) {
      if (typeof next === 'function') return next();
      return;
    }

    const currentTenantId = opts.tenantId;
    if (currentTenantId) {
      this.where({ collegeId: currentTenantId });
    }
    if (typeof next === 'function') next();
  }

  // Pre hooks for read and update operations
  schema.pre('find', applyTenantFilter);
  schema.pre('findOne', applyTenantFilter);
  schema.pre('findOneAndUpdate', applyTenantFilter);
  schema.pre('countDocuments', applyTenantFilter);
  schema.pre('updateOne', applyTenantFilter);
  schema.pre('updateMany', applyTenantFilter);

  // Pre-validate hook for new document writes
  schema.pre('validate', function (next) {
    if (this.$options && this.$options.skipTenantScope) {
      if (typeof next === 'function') return next();
      return;
    }
    if (this.isNew && !this.collegeId) {
      const err = new Error('CRITICAL TENANT ERROR: Cannot save document without tenant collegeId');
      if (typeof next === 'function') return next(err);
      throw err;
    }
    if (typeof next === 'function') next();
  });
}

module.exports = tenantScopingPlugin;
