const mongoose = require('mongoose');

const feedPostSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['announcement', 'event'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventDate: {
      type: Date,
      default: null,
    },
    rsvps: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        respondedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    audience: [
      {
        type: String,
      },
    ],
    publishAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const { sanitizeHtmlString } = require('../utils/sanitize');

feedPostSchema.pre('save', function () {
  if (this.title) this.title = sanitizeHtmlString(this.title);
  if (this.body) this.body = sanitizeHtmlString(this.body);
});

feedPostSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate();
  if (update) {
    if (update.title) update.title = sanitizeHtmlString(update.title);
    if (update.body) update.body = sanitizeHtmlString(update.body);
    if (update.$set) {
      if (update.$set.title) update.$set.title = sanitizeHtmlString(update.$set.title);
      if (update.$set.body) update.$set.body = sanitizeHtmlString(update.$set.body);
    }
  }
});

module.exports = mongoose.model('FeedPost', feedPostSchema);
