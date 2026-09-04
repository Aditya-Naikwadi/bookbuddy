const mongoose = require('mongoose');

const watchRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index on { userId: 1, bookId: 1 }
watchRequestSchema.index({ userId: 1, bookId: 1 }, { unique: true });

// Static method for safe creation - duplicate attempt catches code 11000 and is a no-op
watchRequestSchema.statics.createWatch = async function (data) {
  try {
    return await this.create(data);
  } catch (err) {
    if (err.code === 11000) {
      return await this.findOne({ userId: data.userId, bookId: data.bookId });
    }
    throw err;
  }
};

module.exports = mongoose.model('WatchRequest', watchRequestSchema);
