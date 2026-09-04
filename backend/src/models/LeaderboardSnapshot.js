const mongoose = require('mongoose');

const leaderboardSnapshotSchema = new mongoose.Schema(
  {
    weekIdentifier: {
      type: String,
      required: true,
      index: true,
    },
    metric: {
      type: String,
      default: 'points',
    },
    topEntries: [
      {
        rank: Number,
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        displayName: String,
        score: Number,
        department: String,
      },
    ],
    snapshotDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('LeaderboardSnapshot', leaderboardSnapshotSchema);
