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
    processedRows: {
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
    deactivatedCount: {
      type: Number,
      default: 0,
    },
    skippedCount: {
      type: Number,
      default: 0,
    },
    bulkDeactivateAbsent: {
      type: Boolean,
      default: false,
    },
    failedRows: [
      {
        rowNumber: Number,
        studentId: String,
        email: String,
        reason: String,
      },
    ],
    rowResults: [
      {
        rowNumber: Number,
        studentId: String,
        name: String,
        email: String,
        action: {
          type: String,
          enum: ['created', 'updated', 'deactivated', 'failed', 'skipped'],
        },
        deliveryStatus: {
          type: String,
          enum: [
            'sent',
            'bounced',
            'no_contact_info',
            'sms_queued',
            'active_preserved',
            'inactive',
            'failed',
          ],
        },
        reason: String,
      },
    ],
    credentialSlips: [
      {
        studentId: String,
        name: String,
        email: String,
        program: String,
        tempPassword: String,
        deliveryChannel: String,
      },
    ],
    status: {
      type: String,
      enum: ['preview', 'queued', 'processing', 'committed', 'failed'],
      default: 'preview',
      index: true,
    },
    committedAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

studentUploadBatchSchema.index({ collegeId: 1, createdAt: -1 });

module.exports = mongoose.model('StudentUploadBatch', studentUploadBatchSchema);
