const mongoose = require('mongoose');

const CsvImportJobSchema = new mongoose.Schema(
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
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'validating', 'processing', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    totalRows: { type: Number, default: 0 },
    successfulCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    errorLog: [
      {
        rowNumber: Number,
        email: String,
        rollNumber: String,
        reason: String,
      },
    ],
    completedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.models.CsvImportJob || mongoose.model('CsvImportJob', CsvImportJobSchema);
