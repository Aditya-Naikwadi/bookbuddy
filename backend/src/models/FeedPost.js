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

module.exports = mongoose.model('FeedPost', feedPostSchema);
