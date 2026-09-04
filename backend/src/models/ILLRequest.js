// Schema representing Inter-Library Loan (ILL) requests across colleges.
// Rule: Define each field's indexing EITHER inline via schema options OR via explicit schema.index() calls, never both for the same field/combination.
const mongoose = require('mongoose');

const illRequestSchema = new mongoose.Schema(
  {
    borrowingCollegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
    },
    lendingCollegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
    },
    requestingUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    status: {
      type: String,
      enum: [
        'requested',
        'approved',
        'in_transit',
        'received',
        'returned',
        'rejected',
        'cancelled',
      ],
      default: 'requested',
    },
    shippingTrackingId: {
      type: String,
    },
    dueDate: {
      type: Date,
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        updatedAt: { type: Date, default: Date.now },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
illRequestSchema.index({ borrowingCollegeId: 1, status: 1 });
illRequestSchema.index({ lendingCollegeId: 1, status: 1 });
illRequestSchema.index({ requestingUserId: 1 });

module.exports = mongoose.model('ILLRequest', illRequestSchema);
