const mongoose = require('mongoose');

const readingProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    eresourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    resourceType: {
      type: String,
      enum: ['epub', 'pdf'],
    },
    position: {
      cfi: { type: String },
      page: { type: Number },
      scrollOffset: { type: Number },
    },
    percentageComplete: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    currentPage: {
      type: Number,
    },
    epubProgress: {
      type: String,
    },
    lastReadAt: {
      type: Date,
    },
    deviceId: {
      type: String,
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

// Unique compound index: { userId: 1, resourceId: 1 }
readingProgressSchema.index({ userId: 1, resourceId: 1 }, { unique: true });

// Static helper for repeated upserts
readingProgressSchema.statics.upsertProgress = async function (filter, updateData) {
  return await this.findOneAndUpdate(
    { userId: filter.userId, resourceId: filter.resourceId },
    {
      $set: {
        resourceType: updateData.resourceType,
        position: updateData.position,
        percentageComplete: updateData.percentageComplete,
        deviceId: updateData.deviceId,
        ...updateData,
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
};

module.exports = mongoose.model('ReadingProgress', readingProgressSchema);
