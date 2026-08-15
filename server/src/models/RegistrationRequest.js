const mongoose = require('mongoose');

const registrationRequestSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['student_registration', 'tenant_onboarding'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['submitted', 'unverified', 'pending_review', 'approved', 'rejected', 'active'],
      default: 'submitted',
      index: true,
    },
    // Flow A: Student Registration details
    studentData: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      passwordHash: { type: String },
      collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College' },
      studentId: { type: String, trim: true },
      department: { type: String, trim: true },
      phone: { type: String, trim: true },
      verificationOTP: { type: String },
      verificationOTPExpires: { type: Date },
    },
    // Flow B: Tenant Onboarding details
    tenantData: {
      legalName: { type: String, trim: true },
      shortName: { type: String, trim: true },
      institutionType: {
        type: String,
        enum: ['university', 'college', 'school', 'training_institute'],
      },
      domain: { type: String, trim: true, lowercase: true },
      contactEmail: { type: String, trim: true, lowercase: true },
      address: { type: mongoose.Schema.Types.Mixed },
      contactPhone: { type: String, trim: true },
      adminName: { type: String, trim: true },
      adminEmail: { type: String, trim: true, lowercase: true },
      designation: { type: String, trim: true },
      passwordHash: { type: String },
      adminPhone: { type: String, trim: true },
      selectedServices: [{ type: String, lowercase: true, trim: true }],
      verificationDocumentPath: { type: String },
      verificationDocumentUrl: { type: String },
      domainVerificationToken: { type: String, index: true },
      isDomainVerified: { type: Boolean, default: false },
      desiredSlug: { type: String, trim: true, lowercase: true },
      rejectionReason: { type: String, trim: true },
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Virtual Aliases for Blueprint Spec Compatibility
registrationRequestSchema
  .virtual('institutionName')
  .get(function () {
    return this.tenantData?.legalName || '';
  })
  .set(function (v) {
    this.tenantData = this.tenantData || {};
    this.tenantData.legalName = v;
  });

registrationRequestSchema
  .virtual('domain')
  .get(function () {
    return this.tenantData?.domain || '';
  })
  .set(function (v) {
    this.tenantData = this.tenantData || {};
    this.tenantData.domain = v;
  });

registrationRequestSchema
  .virtual('contactName')
  .get(function () {
    return this.tenantData?.adminName || '';
  })
  .set(function (v) {
    this.tenantData = this.tenantData || {};
    this.tenantData.adminName = v;
  });

registrationRequestSchema
  .virtual('contactEmail')
  .get(function () {
    return this.tenantData?.contactEmail || this.tenantData?.adminEmail || '';
  })
  .set(function (v) {
    this.tenantData = this.tenantData || {};
    this.tenantData.contactEmail = v;
  });

registrationRequestSchema
  .virtual('contactPhone')
  .get(function () {
    return this.tenantData?.contactPhone || '';
  })
  .set(function (v) {
    this.tenantData = this.tenantData || {};
    this.tenantData.contactPhone = v;
  });

registrationRequestSchema
  .virtual('documentUrl')
  .get(function () {
    return this.tenantData?.verificationDocumentUrl || '';
  })
  .set(function (v) {
    this.tenantData = this.tenantData || {};
    this.tenantData.verificationDocumentUrl = v;
  });

registrationRequestSchema
  .virtual('rejectionReason')
  .get(function () {
    return this.tenantData?.rejectionReason || '';
  })
  .set(function (v) {
    this.tenantData = this.tenantData || {};
    this.tenantData.rejectionReason = v;
  });

registrationRequestSchema
  .virtual('processedBy')
  .get(function () {
    return this.reviewedBy;
  })
  .set(function (v) {
    this.reviewedBy = v;
  });

registrationRequestSchema
  .virtual('processedAt')
  .get(function () {
    return this.reviewedAt;
  })
  .set(function (v) {
    this.reviewedAt = v;
  });

registrationRequestSchema.set('toJSON', { virtuals: true });
registrationRequestSchema.set('toObject', { virtuals: true });

// Compound index for quick lookup of existing emails or domains
registrationRequestSchema.index({ 'studentData.email': 1 });
registrationRequestSchema.index({ 'tenantData.adminEmail': 1 });
registrationRequestSchema.index({ 'tenantData.domain': 1 });
registrationRequestSchema.index({ status: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('RegistrationRequest', registrationRequestSchema);
