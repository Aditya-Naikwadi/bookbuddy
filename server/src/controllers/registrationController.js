const crypto = require('crypto');
const bcrypt = require('bcrypt');
const College = require('../models/College');
const User = require('../models/User');
const RegistrationRequest = require('../models/RegistrationRequest');
const AuditLog = require('../models/AuditLog');
const AppError = require('../utils/AppError');
const {
  sendStudentVerificationEmail,
  sendAdminDomainVerificationEmail,
} = require('../services/notificationService');

// @desc    Get active colleges list for student signup dropdown
// @route   GET /api/registration/colleges
// @access  Public
const getActiveColleges = async (req, res, next) => {
  try {
    const colleges = await College.find({ status: 'active', isActive: true })
      .select('_id name shortName code domain configuredDepartments')
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      data: colleges,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Flow A: Student Self-Registration
// @route   POST /api/registration/student
// @access  Public
const registerStudent = async (req, res, next) => {
  try {
    const { name, email, password, collegeId, studentId, department, phone } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Verify target college exists and is ACTIVE, or fallback if collegeId not provided
    let college = null;
    if (collegeId) {
      college = await College.findById(collegeId);
      if (!college || college.status !== 'active' || !college.isActive) {
        return next(new AppError('Target college is not active or does not exist.', 400));
      }
    } else {
      college = await College.findOne({ status: 'active', isActive: true });
      if (!college) {
        college = await College.findOne({ isActive: true });
      }
      if (!college) {
        college = await College.create({
          name: 'Demo College',
          code: 'COLLEGE_A',
          status: 'active',
          isActive: true,
        });
      }
    }

    // 2. Validate student email domain against college domain if registered
    if (college.domain) {
      const emailDomain = normalizedEmail.split('@')[1];
      const collegeDomain = college.domain.toLowerCase().trim();

      if (
        !emailDomain ||
        (emailDomain !== collegeDomain && !emailDomain.endsWith(`.${collegeDomain}`))
      ) {
        return next(
          new AppError(
            `Email address must belong to your institution domain (@${college.domain}).`,
            400
          )
        );
      }
    }

    // 3. Check global email uniqueness across Users
    const existingUserByEmail = await User.findOne({ email: normalizedEmail });
    if (existingUserByEmail) {
      return next(new AppError('An account with this email address already exists.', 400));
    }

    // 4. Check studentId uniqueness scoped to (collegeId, studentId)
    const existingUserByStudentId = await User.findOne({
      collegeId: college._id,
      studentId: studentId.trim(),
    });
    if (existingUserByStudentId) {
      return next(
        new AppError('This Student/Enrollment ID is already registered for this college.', 400)
      );
    }

    // 5. Generate OTP and expiry (15 mins)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 6. Create or update RegistrationRequest
    let regRequest = await RegistrationRequest.findOne({
      type: 'student_registration',
      'studentData.email': normalizedEmail,
      status: 'unverified',
    });

    if (regRequest) {
      regRequest.studentData = {
        name,
        email: normalizedEmail,
        passwordHash,
        collegeId: college._id,
        studentId: studentId.trim(),
        department,
        phone,
        verificationOTP: otp,
        verificationOTPExpires: otpExpires,
      };
      await regRequest.save();
    } else {
      regRequest = await RegistrationRequest.create({
        type: 'student_registration',
        status: 'unverified',
        studentData: {
          name,
          email: normalizedEmail,
          passwordHash,
          collegeId: college._id,
          studentId: studentId.trim(),
          department,
          phone,
          verificationOTP: otp,
          verificationOTPExpires: otpExpires,
        },
      });
    }

    // 7. Send verification OTP email asynchronously
    sendStudentVerificationEmail(normalizedEmail, name, otp).catch(() => {});

    // 8. Log audit entry asynchronously
    AuditLog.create({
      actorRole: 'student',
      action: 'registration_request.submit',
      targetType: 'RegistrationRequest',
      targetId: regRequest._id,
      collegeId: college._id,
      metadata: { email: normalizedEmail, studentId },
      ipAddress:
        req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1',
    }).catch(() => {});

    const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    res.status(201).json({
      success: true,
      message: 'Registration submitted. Please check your email for the verification code.',
      data: {
        email: normalizedEmail,
        requestId: regRequest._id,
        ...(isDev ? { devOtp: otp } : {}),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Student OTP and activate account
// @route   POST /api/registration/verify-email
// @access  Public
const verifyStudentEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const regRequest = await RegistrationRequest.findOne({
      type: 'student_registration',
      'studentData.email': normalizedEmail,
      status: 'unverified',
    });

    if (!regRequest || regRequest.studentData.verificationOTP !== otp) {
      return next(new AppError('Invalid verification code or email.', 400));
    }

    if (
      regRequest.studentData.verificationOTPExpires &&
      new Date() > new Date(regRequest.studentData.verificationOTPExpires)
    ) {
      return next(new AppError('Verification code has expired. Please register again.', 400));
    }

    // Provision the active User account
    const { name, passwordHash, collegeId, studentId, department } = regRequest.studentData;

    const newUser = new User({
      name,
      email: normalizedEmail,
      password: passwordHash,
      collegeId,
      studentId,
      major: department || '',
      role: 'student',
      isEmailVerified: true,
      membershipStatus: 'active',
    });

    await newUser.save();

    // Mark registration request active
    regRequest.status = 'active';
    await regRequest.save();

    // Log audit entry
    await AuditLog.create({
      actorId: newUser._id,
      actorRole: 'student',
      action: 'registration_request.verify_email',
      targetType: 'User',
      targetId: newUser._id,
      collegeId,
      metadata: { email: normalizedEmail },
      ipAddress:
        req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1',
    });

    res.json({
      success: true,
      message: 'Email verified successfully! You can now log into BookBuddy.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Flow B: College Admin Tenant Onboarding Submission
// @route   POST /api/registration/tenant-onboarding
// @access  Public
const submitTenantOnboarding = async (req, res, next) => {
  try {
    const {
      legalName,
      collegeName,
      shortName,
      institutionType,
      domain,
      collegeEmail,
      address,
      contactPhone,
      adminName,
      adminEmail,
      designation,
      password,
      adminPhone,
      desiredSlug,
      selectedServices,
    } = req.body;

    const effectiveLegalName = (collegeName || legalName || '').trim();
    if (!effectiveLegalName) {
      return next(new AppError('College / Institution name is required.', 400));
    }

    const effectiveAdminEmail = (adminEmail || '').toLowerCase().trim();
    if (!effectiveAdminEmail) {
      return next(new AppError('College Admin Email is required.', 400));
    }

    const effectiveCollegeEmail = (collegeEmail || effectiveAdminEmail).toLowerCase().trim();
    const emailDomain =
      effectiveAdminEmail.split('@')[1] || effectiveCollegeEmail.split('@')[1] || '';

    const normalizedDomain = (domain || emailDomain).toLowerCase().trim();
    const normalizedAdminEmail = effectiveAdminEmail;

    const slugBase =
      desiredSlug ||
      normalizedDomain.split('.')[0] ||
      effectiveLegalName.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const normalizedSlug = slugBase.toLowerCase().trim();

    // 1. Validate domain match between admin email & institution domain
    if (
      !emailDomain ||
      (emailDomain !== normalizedDomain && !emailDomain.endsWith(`.${normalizedDomain}`))
    ) {
      return next(
        new AppError(`Admin email must use your institution domain (@${normalizedDomain}).`, 400)
      );
    }

    // 2. Uniqueness checks for College domain, slug, and name
    const existingCollege = await College.findOne({
      $or: [
        { domain: normalizedDomain },
        { slug: normalizedSlug },
        { name: new RegExp(`^${effectiveLegalName}$`, 'i') },
      ],
    });
    if (existingCollege) {
      return next(
        new AppError(
          'An institution with this name, domain, or tenant slug is already registered.',
          400
        )
      );
    }

    // 3. Uniqueness checks in pending RegistrationRequests
    const existingRequest = await RegistrationRequest.findOne({
      type: 'tenant_onboarding',
      status: { $in: ['pending_review', 'approved'] },
      $or: [
        { 'tenantData.domain': normalizedDomain },
        { 'tenantData.desiredSlug': normalizedSlug },
        { 'tenantData.legalName': new RegExp(`^${effectiveLegalName}$`, 'i') },
      ],
    });
    if (existingRequest) {
      return next(
        new AppError(
          'A tenant onboarding request for this institution is already pending review.',
          400
        )
      );
    }

    // 4. Check admin email uniqueness in User collection
    const existingUser = await User.findOne({ email: normalizedAdminEmail });
    if (existingUser) {
      return next(new AppError('An account with this admin email already exists.', 400));
    }

    // 5. Parse selectedServices / enabled features
    let parsedServices = [
      'catalog',
      'loans',
      'fines',
      'patron-card',
      'e-resources',
      'reading-lists',
      'recommendations',
      'saved',
      'facilities',
      'support',
      'gamification',
    ];
    if (selectedServices) {
      if (typeof selectedServices === 'string') {
        try {
          parsedServices = JSON.parse(selectedServices);
        } catch {
          parsedServices = selectedServices
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      } else if (Array.isArray(selectedServices)) {
        parsedServices = selectedServices;
      }
    }

    // 6. Handle document upload metadata
    let docPath = '';
    let docUrl = '';
    if (req.file) {
      docPath = req.file.path;
      docUrl = `/uploads/proofs/${req.file.filename}`;
    }

    // Hash admin password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate domain verification token
    const domainVerificationToken = crypto.randomBytes(32).toString('hex');

    // Parse address if sent as string
    let parsedAddress = address || { street: '', city: '', state: '', country: '', postalCode: '' };
    if (typeof address === 'string') {
      try {
        parsedAddress = JSON.parse(address);
      } catch {
        parsedAddress = { street: address, city: '', state: '', country: '', postalCode: '' };
      }
    }

    // Create RegistrationRequest record with status 'pending_review'
    const onboardingRequest = await RegistrationRequest.create({
      type: 'tenant_onboarding',
      status: 'pending_review',
      tenantData: {
        legalName: effectiveLegalName,
        shortName: shortName ? shortName.trim() : effectiveLegalName,
        institutionType: institutionType || 'college',
        domain: normalizedDomain,
        contactEmail: effectiveCollegeEmail,
        address: parsedAddress,
        contactPhone: contactPhone ? contactPhone.trim() : '',
        adminName: (adminName || '').trim(),
        adminEmail: normalizedAdminEmail,
        designation: (designation || 'College Admin').trim(),
        passwordHash,
        adminPhone: adminPhone ? adminPhone.trim() : '',
        selectedServices: parsedServices,
        verificationDocumentPath: docPath,
        verificationDocumentUrl: docUrl,
        domainVerificationToken,
        isDomainVerified: false,
        desiredSlug: normalizedSlug,
      },
    });

    // Send domain verification email link asynchronously
    sendAdminDomainVerificationEmail(
      normalizedAdminEmail,
      adminName,
      normalizedDomain,
      domainVerificationToken
    ).catch(() => {});

    // Audit log asynchronously
    AuditLog.create({
      actorRole: 'applicant',
      action: 'registration_request.submit',
      targetType: 'RegistrationRequest',
      targetId: onboardingRequest._id,
      metadata: { legalName, domain: normalizedDomain, adminEmail: normalizedAdminEmail },
      ipAddress:
        req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1',
    }).catch(() => {});

    res.status(201).json({
      success: true,
      message:
        'Tenant onboarding application submitted successfully! Your application is in Pending Review.',
      data: {
        requestId: onboardingRequest._id,
        status: onboardingRequest.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Admin Domain Token Link
// @route   GET /api/registration/verify-domain
// @access  Public
const verifyAdminDomain = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return next(new AppError('Domain verification token is required.', 400));
    }

    const regRequest = await RegistrationRequest.findOne({
      type: 'tenant_onboarding',
      'tenantData.domainVerificationToken': token,
    });

    if (!regRequest) {
      return next(new AppError('Invalid or expired domain verification token.', 400));
    }

    regRequest.tenantData.isDomainVerified = true;
    await regRequest.save();

    await AuditLog.create({
      actorRole: 'applicant',
      action: 'registration_request.verify_domain',
      targetType: 'RegistrationRequest',
      targetId: regRequest._id,
      metadata: { domain: regRequest.tenantData.domain },
      ipAddress:
        req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1',
    });

    res.json({
      success: true,
      message: 'Domain ownership verified successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resubmit rejected tenant onboarding request
// @route   PUT /api/registration/tenant-onboarding/:requestId/resubmit
// @access  Public
const resubmitTenantOnboarding = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const regRequest = await RegistrationRequest.findOne({
      _id: requestId,
      type: 'tenant_onboarding',
      status: 'rejected',
    });

    if (!regRequest) {
      return next(new AppError('Rejected onboarding application not found.', 404));
    }

    const { legalName, shortName, institutionType, domain, adminName, designation, desiredSlug } =
      req.body;

    if (legalName) regRequest.tenantData.legalName = legalName.trim();
    if (shortName !== undefined) regRequest.tenantData.shortName = shortName.trim();
    if (institutionType) regRequest.tenantData.institutionType = institutionType;
    if (domain) regRequest.tenantData.domain = domain.toLowerCase().trim();
    if (adminName) regRequest.tenantData.adminName = adminName.trim();
    if (designation) regRequest.tenantData.designation = designation.trim();
    if (desiredSlug) regRequest.tenantData.desiredSlug = desiredSlug.toLowerCase().trim();

    regRequest.status = 'pending_review';
    regRequest.tenantData.rejectionReason = '';
    await regRequest.save();

    await AuditLog.create({
      actorRole: 'applicant',
      action: 'registration_request.resubmit',
      targetType: 'RegistrationRequest',
      targetId: regRequest._id,
      metadata: { legalName: regRequest.tenantData.legalName },
      ipAddress:
        req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1',
    });

    res.json({
      success: true,
      message: 'Onboarding application resubmitted successfully for super admin review.',
      data: regRequest,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify tenant domain ownership via DNS TXT record check
// @route   POST /api/registration/verify-domain-dns
// @access  Public
const verifyDomainDns = async (req, res, next) => {
  const dns = require('dns').promises;
  try {
    const { domain, token, requestId } = req.body;
    if (!domain) {
      return next(new AppError('Domain is required for DNS verification.', 400));
    }

    let regReq = null;
    if (requestId) {
      regReq = await RegistrationRequest.findById(requestId);
    } else if (token) {
      regReq = await RegistrationRequest.findOne({ 'tenantData.domainVerificationToken': token });
    }

    const verificationHost = `_bookbuddy-verify.${domain.toLowerCase().trim()}`;
    let txtRecords = [];
    let isVerified = false;

    try {
      const records = await dns.resolveTxt(verificationHost);
      txtRecords = records.flat();
      const expectedToken = token || regReq?.tenantData?.domainVerificationToken;
      if (expectedToken && txtRecords.includes(expectedToken)) {
        isVerified = true;
      }
    } catch {
      // DNS lookup failed or host not found
    }

    if (isVerified && regReq) {
      regReq.tenantData.isDomainVerified = true;
      await regReq.save();
    }

    res.json({
      success: true,
      data: {
        domain,
        verificationHost,
        isVerified,
        txtRecordsFound: txtRecords,
        message: isVerified
          ? 'DNS TXT record verified successfully.'
          : 'TXT record not detected yet. Please ensure the TXT record is published in your DNS manager.',
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveColleges,
  registerStudent,
  verifyStudentEmail,
  submitTenantOnboarding,
  verifyAdminDomain,
  resubmitTenantOnboarding,
  verifyDomainDns,
};
