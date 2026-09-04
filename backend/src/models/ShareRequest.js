const mongoose = require('mongoose');
const { validateTransition } = require('../utils/shareRequestStateMachine');

const shareRequestSchema = new mongoose.Schema(
  {
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'resourceTypeModel',
    },
    resourceTypeModel: {
      type: String,
      required: true,
      enum: ['Book', 'EResource'],
    },
    resourceType: {
      type: String,
      required: true,
      enum: ['book', 'eresource'],
    },
    owningCollegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    requestingCollegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['requested', 'approved', 'in_transit', 'fulfilled', 'rejected'],
      default: 'requested',
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
);

// Track original status upon init and post-save
shareRequestSchema.post('init', function () {
  this._originalStatus = this.status;
});

shareRequestSchema.post('save', function () {
  this._originalStatus = this.status;
});

// Mongoose pre-save hook enforcing state machine transition validation
shareRequestSchema.pre('save', function () {
  if (this.isModified('status') && !this.isNew) {
    const fromStatus = this._originalStatus || 'requested';
    if (fromStatus !== this.status) {
      validateTransition(fromStatus, this.status);
    }
  }
});

module.exports = mongoose.model('ShareRequest', shareRequestSchema);
