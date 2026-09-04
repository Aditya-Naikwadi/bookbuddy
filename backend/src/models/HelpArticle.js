// Schema representing Help Center documentation, FAQs, and onboarding guides.
// Rule: Define each field's indexing EITHER inline via schema options OR via explicit schema.index() calls, never both for the same field/combination.
const mongoose = require('mongoose');

const helpArticleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'Getting Started',
        'Borrowing & Fines',
        'E-Resources & Reader',
        'Account & Security',
        'General',
      ],
      default: 'General',
    },
    content: {
      type: String,
      required: true,
    },
    tags: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    isPublished: {
      type: Boolean,
      default: true,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

helpArticleSchema.index({ category: 1, isPublished: 1 });
helpArticleSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('HelpArticle', helpArticleSchema);
