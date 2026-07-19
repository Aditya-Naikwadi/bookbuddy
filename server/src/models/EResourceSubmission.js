const mongoose = require('mongoose');

const eresourceSubmissionSchema = new mongoose.Schema(
  {
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    fileUrl: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewNote: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

eresourceSubmissionSchema.index({ collegeId: 1, status: 1 });
eresourceSubmissionSchema.index({ submittedBy: 1, createdAt: -1 });

module.exports = mongoose.model('EResourceSubmission', eresourceSubmissionSchema);
