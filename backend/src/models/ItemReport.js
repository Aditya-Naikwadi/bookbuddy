const mongoose = require('mongoose');

const itemReportSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
      required: true,
      index: true,
    },
    issueType: {
      type: String,
      enum: ['damaged', 'lost', 'pages_missing', 'other'],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ['reported', 'under_review', 'resolved', 'dismissed'],
      default: 'reported',
      index: true,
    },
    resolutionNotes: {
      type: String,
      default: '',
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

itemReportSchema.index({ collegeId: 1, status: 1 });

module.exports = mongoose.model('ItemReport', itemReportSchema);
