const mongoose = require('mongoose');

const uploadJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    processedRows: {
      type: Number,
      default: 0,
    },
    succeededRows: {
      type: Number,
      default: 0,
    },
    failedRows: {
      type: Number,
      default: 0,
    },
    lastCheckpointRow: {
      type: Number,
      default: 0,
    },
    errorReportUrl: {
      type: String,
      default: null,
    },
    errorDetails: [
      {
        row: Number,
        studentId: String,
        email: String,
        reason: String,
      },
    ],
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('UploadJob', uploadJobSchema);
