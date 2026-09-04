const mongoose = require('mongoose');

const studentUploadBatchSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    validRowsCount: {
      type: Number,
      default: 0,
    },
    createdCount: {
      type: Number,
      default: 0,
    },
    updatedCount: {
      type: Number,
      default: 0,
    },
    skippedCount: {
      type: Number,
      default: 0,
    },
    failedRows: [
      {
        rowNumber: Number,
        studentId: String,
        email: String,
        reason: String,
      },
    ],
    status: {
      type: String,
      enum: ['preview', 'committed', 'failed'],
      default: 'preview',
    },
    committedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

studentUploadBatchSchema.index({ collegeId: 1, createdAt: -1 });

module.exports = mongoose.model('StudentUploadBatch', studentUploadBatchSchema);
