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
      address: { type: mongoose.Schema.Types.Mixed },
      contactPhone: { type: String, trim: true },
      adminName: { type: String, trim: true },
      adminEmail: { type: String, trim: true, lowercase: true },
      designation: { type: String, trim: true },
      passwordHash: { type: String },
      adminPhone: { type: String, trim: true },
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

// Compound index for quick lookup of existing emails or domains
registrationRequestSchema.index({ 'studentData.email': 1 });
registrationRequestSchema.index({ 'tenantData.adminEmail': 1 });
registrationRequestSchema.index({ 'tenantData.domain': 1 });

module.exports = mongoose.model('RegistrationRequest', registrationRequestSchema);
