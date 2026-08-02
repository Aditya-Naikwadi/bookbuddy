const moderationHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'pending_review', 'approved', 'rejected', 'published'],
      required: true,
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    moderatedAt: {
      type: Date,
      default: Date.now,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  { _id: true }
);

const eResourceSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    author: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['pdf', 'epub', 'journal'],
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    // Decoupled Content Moderation Status
    moderationStatus: {
      type: String,
      enum: ['pending', 'pending_review', 'approved', 'rejected', 'published'],
      default: 'pending',
      index: true,
    },
    moderationNote: {
      type: String,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    moderatedAt: {
      type: Date,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    // Decoupled Workflow State 2: Publication Status
    isPublished: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['internal', 'gutenberg'],
      default: 'internal',
      index: true,
    },
    externalId: {
      type: Number,
      index: true,
    },
    readUrl: {
      type: String,
    },
    epubUrl: {
      type: String,
    },
    url: {
      type: String,
    },
    downloadCount: {
      type: Number,
    },
    storageKey: {
      type: String,
      default: null,
    },
    fileSizeBytes: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      default: null,
    },
    uploadStatus: {
      type: String,
      enum: ['pending-validation', 'available', 'rejected'],
      default: 'available',
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['gutenberg', 'internal-upload'],
      default: 'internal-upload',
      index: true,
    },
    // Append-only history capturing review cycles across resubmissions
    moderationHistory: [moderationHistorySchema],
  },
  {
    timestamps: true,
  }
);

// Pre-save synchronization hook between legacy and new field names
eResourceSchema.pre('save', function (next) {
  if (this.uploadedBy && !this.submittedBy) {
    this.submittedBy = this.uploadedBy;
  } else if (this.submittedBy && !this.uploadedBy) {
    this.uploadedBy = this.submittedBy;
  }

  if (this.moderatedBy && !this.reviewedBy) {
    this.reviewedBy = this.moderatedBy;
  } else if (this.reviewedBy && !this.moderatedBy) {
    this.moderatedBy = this.reviewedBy;
  }

  if (this.moderatedAt && !this.reviewedAt) {
    this.reviewedAt = this.moderatedAt;
  } else if (this.reviewedAt && !this.moderatedAt) {
    this.moderatedAt = this.reviewedAt;
  }

  if (this.moderationNote && !this.rejectionReason) {
    this.rejectionReason = this.moderationNote;
  } else if (this.rejectionReason && !this.moderationNote) {
    this.moderationNote = this.rejectionReason;
  }

  if (this.moderationStatus === 'published' && !this.isPublished) {
    this.isPublished = true;
    if (!this.publishedAt) this.publishedAt = new Date();
  }

  next();
});

/* -------------------------------------------------------------------------- */
/*                                INDEXES                                     */
/* -------------------------------------------------------------------------- */

// Compound index for listing approved resources by category
eResourceSchema.index({ collegeId: 1, moderationStatus: 1, category: 1 });

// Queue index for processing pending reviews in FIFO order (oldest first)
eResourceSchema.index({ moderationStatus: 1, submittedAt: 1 });
eResourceSchema.index({ moderationStatus: 1, createdAt: 1 });

// Tenant catalog view index (approved & published resources)
eResourceSchema.index({ collegeId: 1, moderationStatus: 1, isPublished: 1 });

// College moderation list index
eResourceSchema.index({ collegeId: 1, moderationStatus: 1, createdAt: -1 });

module.exports = mongoose.model('EResource', eResourceSchema);
