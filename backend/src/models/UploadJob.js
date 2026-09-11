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
    fileName: {
      type: String,
      default: 'students.csv',
    },
    fileSizeBytes: {
      type: Number,
      default: 0,
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
    insertedRows: {
      type: Number,
      default: 0,
    },
    updatedRows: {
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
    deliverySummary: {
      emailed: { type: Number, default: 0 },
      sms: { type: Number, default: 0 },
      handout: { type: Number, default: 0 },
    },
    credentialSlips: [
      {
        studentId: String,
        name: String,
        department: String,
        phone: String,
        tempPassword: String,
        deliveryChannel: String,
      },
    ],
    auditLogVersion: {
      type: Number,
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
