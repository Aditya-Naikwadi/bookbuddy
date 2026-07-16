const mongoose = require('mongoose');

const eResourceSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    author: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['pdf', 'epub', 'journal'],
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    moderationNote: {
      type: String,
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    moderatedAt: {
      type: Date,
      default: null,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['internal', 'gutenberg'],
      default: 'internal',
      index: true,
    },
    externalId: {
      type: Number,
      index: true,
    },
    readUrl: {
      type: String,
    },
    epubUrl: {
      type: String,
    },
    url: {
      type: String,
    },
    downloadCount: {
      type: Number,
    },
    storageKey: {
      type: String,
      default: null,
    },
    fileSizeBytes: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      default: null,
    },
    uploadStatus: {
      type: String,
      enum: ['pending-validation', 'available', 'rejected'],
      default: 'available',
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['gutenberg', 'internal-upload'],
      default: 'internal-upload',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for listing approved resources by category
eResourceSchema.index({ collegeId: 1, moderationStatus: 1, category: 1 });

module.exports = mongoose.model('EResource', eResourceSchema);
