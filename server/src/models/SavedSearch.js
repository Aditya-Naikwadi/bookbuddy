const mongoose = require('mongoose');

const savedSearchSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  query: {
    type: String,
  },
  filters: {
    type: mongoose.Schema.Types.Mixed, // Stores filter JSON
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('SavedSearch', savedSearchSchema);
