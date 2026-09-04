const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: [true, 'Tag slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Tag display name is required'],
      trim: true,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for high-performance tag searches and autocomplete
tagSchema.index({ usageCount: -1 });

const Tag = mongoose.model('Tag', tagSchema);

module.exports = Tag;
