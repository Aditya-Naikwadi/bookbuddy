const mongoose = require('mongoose');

const uploadAuditLogSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    jobId: {
      type: String,
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
    },
    uploadedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      name: String,
      email: String,
      role: String,
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
    deliverySummary: {
      emailed: { type: Number, default: 0 },
      sms: { type: Number, default: 0 },
      handout: { type: Number, default: 0 },
    },
    errorDetails: [
      {
        row: Number,
        studentId: String,
        email: String,
        reason: String,
      },
    ],
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
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

uploadAuditLogSchema.index({ collegeId: 1, version: -1 });
uploadAuditLogSchema.index({ collegeId: 1, createdAt: -1 });

module.exports = mongoose.model('UploadAuditLog', uploadAuditLogSchema);
