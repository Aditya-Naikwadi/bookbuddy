const mongoose = require('mongoose');

/**
 * Mongoose Tenant Scoping Plugin
 * Automatically injects collegeId into query filters and document validations.
 */
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
    // Skip scoping if explicitly running in SuperAdmin system bypass context
    if (this.options && this.options.skipTenantScope === true) {
      return next();
    }

    const currentTenantId = this.options ? this.options.tenantId : null;
    if (currentTenantId) {
      this.where({ collegeId: currentTenantId });
    }
    next();
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
      return next();
    }
    if (this.isNew && !this.collegeId) {
      return next(
        new Error('CRITICAL TENANT ERROR: Cannot save document without tenant collegeId')
      );
    }
    next();
  });
}

module.exports = tenantScopingPlugin;
