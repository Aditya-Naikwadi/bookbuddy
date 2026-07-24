const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: false, // Null for global/platform announcements
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Announcement title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    content: {
      type: String,
      required: [true, 'Announcement content is required'],
      trim: true,
    },
    priority: {
      type: String,
      enum: ['Notice', 'Warning', 'Urgent'],
      default: 'Notice',
    },
    category: {
      type: String,
      enum: ['Operational', 'Academic', 'Maintenance', 'General'],
      default: 'General',
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for active announcement lookup
announcementSchema.index({ collegeId: 1, isActive: 1, startDate: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
