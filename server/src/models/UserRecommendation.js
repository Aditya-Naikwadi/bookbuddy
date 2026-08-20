const mongoose = require('mongoose');

const recommendationItemSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    score: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
      default: 'Recommended for you',
    },
  },
  { _id: false }
);

const userRecommendationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // Guarantees a single document per user, preventing unbounded growth
      index: true,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
    },
    recommendations: [recommendationItemSchema],
    computedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('UserRecommendation', userRecommendationSchema);
