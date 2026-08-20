const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: false, // Null for global/platform announcements
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
      enum: {
        values: ['Notice', 'Warning', 'Urgent', 'info', 'warning', 'urgent'],
        message: '{VALUE} is not a valid announcement priority',
      },
      default: 'Notice',
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'dismissed', 'expired'],
        message: '{VALUE} is not a valid announcement status',
      },
      default: 'active',
    },
    category: {
      type: String,
      enum: ['Operational', 'Academic', 'Maintenance', 'General', 'Event', 'BookClub', 'Workshop'],
      default: 'General',
    },
    isEvent: {
      type: Boolean,
      default: false,
    },
    eventType: {
      type: String,
      enum: ['book_club', 'workshop', 'exhibition', 'author_visit', 'general'],
      default: 'general',
    },
    eventDate: {
      type: Date,
    },
    location: {
      type: String,
      trim: true,
    },
    maxCapacity: {
      type: Number,
      default: 0, // 0 = unlimited
    },
    rsvpUsers: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rsvpAt: { type: Date, default: Date.now },
      },
    ],
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
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

const { sanitizeHtmlString } = require('../utils/sanitize');

// Compound indexes for dashboard query performance
announcementSchema.index({ collegeId: 1, status: 1, priority: 1, createdAt: -1 });
announcementSchema.index({ collegeId: 1, isActive: 1, startDate: -1 });

// TTL index to automatically purge expired announcements from MongoDB
announcementSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Write-time sanitization hooks
announcementSchema.pre('save', function () {
  if (this.title) this.title = sanitizeHtmlString(this.title);
  if (this.content) this.content = sanitizeHtmlString(this.content);
});

announcementSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate();
  if (update) {
    if (update.title) update.title = sanitizeHtmlString(update.title);
    if (update.content) update.content = sanitizeHtmlString(update.content);
    if (update.$set) {
      if (update.$set.title) update.$set.title = sanitizeHtmlString(update.$set.title);
      if (update.$set.content) update.$set.content = sanitizeHtmlString(update.$set.content);
    }
  }
});

module.exports = mongoose.model('Announcement', announcementSchema);
