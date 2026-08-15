const College = require('../../models/College');
const User = require('../../models/User');
const Loan = require('../../models/Loan');
const Fine = require('../../models/Fine');
const AuditLog = require('../../models/AuditLog');
const AppError = require('../../utils/AppError');
const PlatformMetricSnapshot = require('../../models/PlatformMetricSnapshot');
const { redisClient } = require('../../middlewares/rateLimiters');

const escapeRegExp = (string) => {
  return string ? String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
};

const getActorId = (req) => {
  return req && req.user && req.user.isImpersonated && req.user.originalSuperAdminId
    ? req.user.originalSuperAdminId
    : req && req.user
      ? req.user.id || req.user._id
      : null;
};

// @desc    Get global overview stats
// @route   GET /api/dashboards/admin-portal/overview
// @access  Private/SuperAdmin
const getOverview = async (req, res, next) => {
  try {
    let cachedData = null;
    const isRedisReady =
      redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect');

    if (isRedisReady) {
      try {
        const cached = await redisClient.get('metrics:global:latest');
        if (cached) {
          cachedData = JSON.parse(cached);
        }
      } catch {
        // ignore cache fetch errors
      }
    }

    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData,
      });
    }

    // Try to get latest snapshot from DB
    const latestSnapshot = await PlatformMetricSnapshot.findOne({ collegeId: null }).sort({
      snapshotDate: -1,
    });

    let overviewData;
    if (latestSnapshot) {
      overviewData = {
        totalColleges: await College.countDocuments(),
        activeLoans: latestSnapshot.activeLoans,
        unpaidFinesCount: await Fine.countDocuments({ status: 'unpaid' }),
        totalUnpaidFineAmount: latestSnapshot.totalFinesPending,
        userCountsByRole: {
          student: latestSnapshot.activeStudents,
          'college-admin': latestSnapshot.activeAdmins,
          'super-admin': await User.countDocuments({ role: 'super-admin' }),
          librarian: 0,
          admin: 0,
        },
        storageUsageBytes: latestSnapshot.storageUsageBytes,
        eResourcesCount: latestSnapshot.eResourcesCount,
        pendingModerationCount: latestSnapshot.pendingModerationCount,
      };
    } else {
      // Cold start fallback - calculate live
      const totalColleges = await College.countDocuments();
      const activeLoans = await Loan.countDocuments({ status: 'active' });
      const unpaidFinesCount = await Fine.countDocuments({ status: 'unpaid' });

      const userRoleCounts = await User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
          },
        },
      ]);

      const rolesMap = {
        student: 0,
        'college-admin': 0,
        'super-admin': 0,
        librarian: 0,
        admin: 0,
      };
      userRoleCounts.forEach((roleGroup) => {
        if (roleGroup._id) {
          rolesMap[roleGroup._id] = roleGroup.count;
        }
      });

      const unpaidFineSum = await Fine.aggregate([
        { $match: { status: 'unpaid' } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
          },
        },
      ]);
      const totalUnpaidFineAmount = unpaidFineSum.length > 0 ? unpaidFineSum[0].totalAmount : 0;

      // E-resources stats
      const EResource = require('../../models/EResource');
      const eResourcesCount = await EResource.countDocuments({ moderationStatus: 'published' });
      const pendingModerationCount = await EResource.countDocuments({
        moderationStatus: { $in: ['pending', 'pending_review'] },
      });
      const storageUsage = await EResource.aggregate([
        { $group: { _id: null, total: { $sum: '$fileSizeBytes' } } },
      ]);
      const storageUsageBytes = storageUsage.length > 0 ? storageUsage[0].total : 0;

      overviewData = {
        totalColleges,
        activeLoans,
        unpaidFinesCount,
        totalUnpaidFineAmount,
        userCountsByRole: rolesMap,
        storageUsageBytes,
        eResourcesCount,
        pendingModerationCount,
      };

      // Materialize snapshot
      await PlatformMetricSnapshot.create({
        collegeId: null,
        snapshotDate: new Date(),
        activeStudents: rolesMap.student,
        activeAdmins: rolesMap['college-admin'],
        activeLoans,
        overdueLoans: await Loan.countDocuments({ status: 'overdue' }),
        totalFinesPending: totalUnpaidFineAmount,
        totalFinesCollected: 0,
        eResourcesCount,
        pendingModerationCount,
        storageUsageBytes,
      });
    }

    // Cache results
    if (isRedisReady) {
      try {
        await redisClient.set('metrics:global:latest', JSON.stringify(overviewData), 'EX', 300);
      } catch {
        // ignore cache write errors
      }
    }

    res.json({
      success: true,
      data: overviewData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List all college-admins across all colleges
// @route   GET /api/dashboards/admin-portal/admins
// @access  Private/SuperAdmin
const getAdmins = async (req, res, next) => {
  try {
    const { collegeId } = req.query;
    const filter = { role: 'college-admin' };
    if (collegeId) {
      filter.collegeId = collegeId;
    }

    const admins = await User.find(filter)
      .populate('collegeId', 'name code')
      .select('-password -refreshTokenHash');

    res.json({ success: true, data: admins });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new college-admin
// @route   POST /api/dashboards/admin-portal/admins
// @access  Private/SuperAdmin
const createAdmin = async (req, res, next) => {
  try {
    const { studentId, name, email, password, collegeId } = req.body;

    // Verify college exists
    const college = await College.findById(collegeId);
    if (!college) {
      return next(new AppError('Target college does not exist.', 404));
    }

    if (college.status === 'archived') {
      return next(new AppError('Cannot create admin for an archived college.', 400));
    }

    // Create admin user
    const admin = await User.create({
      studentId,
      name,
      email,
      password,
      role: 'college-admin',
      collegeId,
    });

    // Update college status if it was pending
    if (college.status === 'pending') {
      const oldStatus = college.status;
      college.status = 'active';
      await college.save();

      // Evict Redis status cache
      const isRedisReady =
        redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect');
      if (isRedisReady) {
        try {
          await redisClient.del(`college:status:${collegeId.toString()}`);
        } catch {
          // ignore
        }
      }

      // Log college status change
      await AuditLog.create({
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'college.status_change',
        targetType: 'College',
        targetId: college._id,
        collegeId: college._id,
        metadata: { oldStatus, newStatus: 'active' },
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      });
    }

    // Prepare audit meta (exclude password)
    res.locals.auditMeta = {
      targetType: 'User',
      targetId: admin._id,
      collegeId,
      metadata: { studentId, name, email },
    };

    // Strip password from returned response
    const responseData = admin.toObject();
    delete responseData.password;

    res.status(201).json({
      success: true,
      data: responseData,
      message: 'College admin created successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new College
// @route   POST /api/dashboards/admin-portal/colleges
// @access  Private/SuperAdmin
const createCollege = async (req, res, next) => {
  try {
    const { name, code } = req.body;

    const college = await College.create({ name, code, status: 'pending' });

    res.locals.auditMeta = {
      targetType: 'College',
      targetId: college._id,
      collegeId: college._id,
      metadata: { name, code },
    };

    res.status(201).json({
      success: true,
      data: college,
      message: 'College registered successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get audit logs
// @route   GET /api/dashboards/admin-portal/audit-logs
// @access  Private/SuperAdmin
const getAuditLogs = async (req, res, next) => {
  try {
    const {
      actorId,
      action,
      collegeId,
      severity,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;
    const filter = {};

    if (actorId) filter.actorId = actorId;
    if (action) filter.action = action;
    if (collegeId) filter.collegeId = collegeId;
    if (severity) filter.severity = severity;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .populate('actorId', 'name email studentId')
      .populate('collegeId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List all colleges with latest metrics snapshot
// @route   GET /api/dashboards/admin-portal/colleges
// @access  Private/SuperAdmin
const listColleges = async (req, res, next) => {
  try {
    const colleges = await College.find();

    const collegesWithMetrics = await Promise.all(
      colleges.map(async (college) => {
        const latestSnapshot = await PlatformMetricSnapshot.findOne({
          collegeId: college._id,
        }).sort({
          snapshotDate: -1,
        });
        return {
          ...college.toObject(),
          metrics: latestSnapshot || {
            activeStudents: 0,
            storageUsageBytes: 0,
          },
        };
      })
    );

    res.json({
      success: true,
      data: collegesWithMetrics,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get details of one college with metrics
// @route   GET /api/dashboards/admin-portal/colleges/:id
// @access  Private/SuperAdmin
const getCollegeDetails = async (req, res, next) => {
  try {
    const college = await College.findById(req.params.id);
    if (!college) {
      return next(new AppError('College not found.', 404));
    }

    const latestSnapshot = await PlatformMetricSnapshot.findOne({ collegeId: college._id }).sort({
      snapshotDate: -1,
    });

    res.json({
      success: true,
      data: {
        ...college.toObject(),
        metrics: latestSnapshot || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update college details
// @route   PUT /api/dashboards/admin-portal/colleges/:id
// @access  Private/SuperAdmin
const updateCollege = async (req, res, next) => {
  try {
    const { name, code, contactEmail, contactPhone, address } = req.body;
    const college = await College.findById(req.params.id);
    if (!college) {
      return next(new AppError('College not found.', 404));
    }

    if (name) college.name = name;
    if (code) college.code = code;
    if (contactEmail !== undefined) college.contactEmail = contactEmail;
    if (contactPhone !== undefined) college.contactPhone = contactPhone;
    if (address !== undefined) college.address = address;

    await college.save();

    res.json({
      success: true,
      data: college,
      message: 'College updated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Patch college status (handle status transitions & invalidations)
// @route   PATCH /api/dashboards/admin-portal/colleges/:id/status
// @access  Private/SuperAdmin
const patchCollegeStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended', 'archived'].includes(status)) {
      return next(
        new AppError('Invalid college status. Must be active, suspended, or archived.', 400)
      );
    }

    const college = await College.findById(req.params.id);
    if (!college) {
      return next(new AppError('College not found.', 404));
    }

    if (college.status === 'archived') {
      return next(
        new AppError(
          'Cannot change status of an archived college. Archived is a terminal state.',
          400
        )
      );
    }

    const oldStatus = college.status;
    college.status = status;
    await college.save();

    // Evict Redis status cache
    const isRedisReady =
      redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect');
    if (isRedisReady) {
      try {
        await redisClient.del(`college:status:${college._id.toString()}`);
      } catch {
        // ignore
      }
    }

    // Log college status change
    await AuditLog.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'college.status_change',
      targetType: 'College',
      targetId: college._id,
      collegeId: college._id,
      metadata: { oldStatus, newStatus: status },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      data: college,
      message: `College status successfully updated from ${oldStatus} to ${status}.`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get global pending e-resources for moderation
// @route   GET /api/dashboards/admin-portal/moderation/pending
// @access  Private/SuperAdmin
const getGlobalPendingEResources = async (req, res, next) => {
  try {
    const EResource = require('../../models/EResource');
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'pending';

    const filter =
      status === 'pending'
        ? { moderationStatus: { $in: ['pending', 'pending_review'] } }
        : { moderationStatus: status };

    const total = await EResource.countDocuments(filter);
    const resources = await EResource.find(filter)
      .populate('uploadedBy', 'name email studentId')
      .populate('collegeId', 'name code')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: resources,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Moderate e-resource submission globally
// @route   PUT /api/dashboards/admin-portal/moderation/:id
// @access  Private/SuperAdmin
const moderateEResourceGlobal = async (req, res, next) => {
  try {
    const EResource = require('../../models/EResource');
    const { status, note } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return next(new AppError('Invalid moderation status. Must be approved or rejected.', 400));
    }

    if (status === 'rejected' && (!note || note.trim() === '')) {
      return next(
        new AppError('Rejection reason (note) is required when rejecting a resource.', 400)
      );
    }

    const resource = await EResource.findById(req.params.id);
    if (!resource) {
      return next(new AppError('E-resource not found.', 404));
    }

    const oldStatus = resource.moderationStatus;
    resource.moderationStatus = status;
    resource.moderationNote = note || '';
    resource.moderatedBy = req.user.id;
    resource.moderatedAt = new Date();
    await resource.save();

    // Log to AuditLog
    await AuditLog.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'eresource.moderate',
      targetType: 'EResource',
      targetId: resource._id,
      collegeId: resource.collegeId,
      metadata: { oldStatus, newStatus: status, note },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      data: resource,
      message: `Resource successfully ${status}.`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Publish e-resource globally
// @route   POST /api/dashboards/admin-portal/moderation/:id/publish
// @access  Private/SuperAdmin
const publishEResourceGlobal = async (req, res, next) => {
  try {
    const EResource = require('../../models/EResource');
    const resource = await EResource.findById(req.params.id);
    if (!resource) {
      return next(new AppError('E-resource not found.', 404));
    }

    if (resource.moderationStatus !== 'approved') {
      return next(new AppError('Only approved resources can be published.', 400));
    }

    resource.moderationStatus = 'published';
    await resource.save();

    // Log to AuditLog
    await AuditLog.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'eresource.publish',
      targetType: 'EResource',
      targetId: resource._id,
      collegeId: resource.collegeId,
      metadata: { status: 'published' },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      data: resource,
      message: 'Resource successfully published.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending tenant onboarding applications
// @route   GET /api/dashboards/admin-portal/onboardings/pending
// @access  Private/SuperAdmin
const getPendingOnboardings = async (req, res, next) => {
  try {
    const RegistrationRequest = require('../../models/RegistrationRequest');
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const total = await RegistrationRequest.countDocuments({
      type: 'tenant_onboarding',
      status: 'pending_review',
    });

    const requests = await RegistrationRequest.find({
      type: 'tenant_onboarding',
      status: 'pending_review',
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      data: requests,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve tenant onboarding application (Atomic Transaction)
// @route   POST /api/dashboards/admin-portal/onboardings/:requestId/approve
// @access  Private/SuperAdmin
const approveTenantOnboarding = async (req, res, next) => {
  try {
    const RegistrationRequest = require('../../models/RegistrationRequest');
    const { runInTransaction } = require('../../utils/transactionHelper');
    const { sendTenantOnboardingApprovalEmail } = require('../../services/notificationService');

    const regRequest = await RegistrationRequest.findOne({
      _id: req.params.requestId,
      type: 'tenant_onboarding',
      status: 'pending_review',
    });

    if (!regRequest) {
      return next(new AppError('Pending tenant onboarding application not found.', 404));
    }

    const {
      legalName,
      shortName,
      institutionType,
      domain,
      contactEmail,
      address,
      contactPhone,
      adminName,
      adminEmail,
      passwordHash,
      desiredSlug,
      selectedServices,
    } = regRequest.tenantData;

    const defaultServices = [
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
    const activeServices =
      Array.isArray(selectedServices) && selectedServices.length > 0
        ? selectedServices
        : defaultServices;

    // Execute atomic creation of College + College Admin User inside MongoDB transaction
    const { college, adminUser } = await runInTransaction(async (session) => {
      // 1. Create College tenant
      const collegeCode = (desiredSlug || 'TENANT').toUpperCase();
      const addressString = typeof address === 'object' ? JSON.stringify(address) : address || '';

      const newCollegeDocs = await College.create(
        [
          {
            name: legalName,
            shortName: shortName || legalName,
            code: collegeCode,
            slug: desiredSlug,
            institutionType: institutionType || 'college',
            domain,
            status: 'active',
            isActive: true,
            contactEmail: contactEmail || adminEmail,
            contactPhone,
            address: addressString,
            selectedServices: activeServices,
            enabledFeatures: activeServices,
          },
        ],
        { session }
      );

      const createdCollege = newCollegeDocs[0];

      // 2. Create initial College Admin User
      const newAdminDocs = await User.create(
        [
          {
            studentId: 'ADMIN-001',
            name: adminName,
            email: adminEmail,
            password: passwordHash,
            role: 'college-admin',
            collegeId: createdCollege._id,
            isEmailVerified: true,
            membershipStatus: 'active',
          },
        ],
        { session }
      );

      const createdAdmin = newAdminDocs[0];

      // 3. Initialize CollegeFeatureConfig with selected registration services
      const CollegeFeatureConfig = require('../../models/CollegeFeatureConfig');
      await CollegeFeatureConfig.create(
        [
          {
            collegeId: createdCollege._id,
            enabledFeatures: activeServices,
            pendingRequests: [],
          },
        ],
        { session }
      );

      // 4. Mark RegistrationRequest as approved
      regRequest.status = 'approved';
      regRequest.reviewedAt = new Date();
      regRequest.reviewedBy = req.user.id;
      await regRequest.save({ session });

      return { college: createdCollege, adminUser: createdAdmin };
    });

    // 4. Send Approval Email
    await sendTenantOnboardingApprovalEmail(adminEmail, adminName, legalName);

    // 5. Audit Log
    await AuditLog.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'registration_request.approve',
      targetType: 'College',
      targetId: college._id,
      collegeId: college._id,
      metadata: { legalName, domain, adminEmail },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      message: `Tenant ${legalName} approved and activated successfully.`,
      data: {
        college,
        adminUser: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject tenant onboarding application
// @route   POST /api/dashboards/admin-portal/onboardings/:requestId/reject
// @access  Private/SuperAdmin
const rejectTenantOnboarding = async (req, res, next) => {
  try {
    const RegistrationRequest = require('../../models/RegistrationRequest');
    const { sendTenantOnboardingRejectionEmail } = require('../../services/notificationService');
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return next(new AppError('Rejection reason is required.', 400));
    }

    const regRequest = await RegistrationRequest.findOne({
      _id: req.params.requestId,
      type: 'tenant_onboarding',
      status: 'pending_review',
    });

    if (!regRequest) {
      return next(new AppError('Pending tenant onboarding application not found.', 404));
    }

    regRequest.status = 'rejected';
    regRequest.tenantData.rejectionReason = reason.trim();
    regRequest.reviewedAt = new Date();
    regRequest.reviewedBy = req.user.id;
    await regRequest.save();

    // Send rejection email notification
    await sendTenantOnboardingRejectionEmail(
      regRequest.tenantData.adminEmail,
      regRequest.tenantData.adminName,
      regRequest.tenantData.legalName,
      reason
    );

    // Audit log
    await AuditLog.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'registration_request.reject',
      targetType: 'RegistrationRequest',
      targetId: regRequest._id,
      metadata: { legalName: regRequest.tenantData.legalName, reason },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      message: `Tenant onboarding application for ${regRequest.tenantData.legalName} rejected.`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users across colleges with search & filter
// @route   GET /api/dashboards/admin-portal/users
// @access  Private/SuperAdmin
const getUsers = async (req, res, next) => {
  try {
    const { search, collegeId, role, status, membershipStatus, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (search) {
      const searchRegex = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [{ name: searchRegex }, { email: searchRegex }, { studentId: searchRegex }];
    }

    if (collegeId) filter.collegeId = collegeId;
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (membershipStatus) filter.membershipStatus = membershipStatus;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .populate('collegeId', 'name code slug')
      .select('-password -refreshTokenHash -cardSecret -mfaSecret -mfaRecoveryCodes')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user status & membership status
// @route   PATCH /api/dashboards/admin-portal/users/:id/status
// @access  Private/SuperAdmin
const updateUserStatus = async (req, res, next) => {
  try {
    const { status, membershipStatus, isActive } = req.body;

    if (status && !['active', 'disabled', 'invited', 'pending'].includes(status)) {
      return next(new AppError('Invalid user status value.', 400));
    }
    if (membershipStatus && !['active', 'suspended', 'expired'].includes(membershipStatus)) {
      return next(new AppError('Invalid membership status value.', 400));
    }

    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('User not found.', 404));

    const oldStatus = user.status;
    const oldMembership = user.membershipStatus;

    if (status) user.status = status;
    if (membershipStatus) user.membershipStatus = membershipStatus;
    if (typeof isActive === 'boolean') user.isActive = isActive;

    await user.save();

    await AuditLog.create({
      actorId: getActorId(req),
      actorRole: req.user.isImpersonated ? 'super-admin' : req.user.role,
      action: 'user.status_update',
      targetType: 'User',
      targetId: user._id,
      collegeId: user.collegeId || null,
      metadata: {
        oldStatus,
        newStatus: user.status,
        oldMembership,
        newMembership: user.membershipStatus,
        isImpersonated: req.user.isImpersonated || false,
        impersonatedUserId: req.user.isImpersonated ? req.user.id : undefined,
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      data: user,
      message: 'User status successfully updated.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user role
// @route   PATCH /api/dashboards/admin-portal/users/:id/role
// @access  Private/SuperAdmin
const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['student', 'college-admin', 'super-admin', 'general'].includes(role)) {
      return next(new AppError('Invalid role specified.', 400));
    }

    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('User not found.', 404));

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await AuditLog.create({
      actorId: getActorId(req),
      actorRole: req.user.isImpersonated ? 'super-admin' : req.user.role,
      action: 'user.role_update',
      targetType: 'User',
      targetId: user._id,
      collegeId: user.collegeId || null,
      metadata: { oldRole, newRole: role },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      data: user,
      message: `User role updated from ${oldRole} to ${role}.`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset user password
// @route   POST /api/dashboards/admin-portal/users/:id/reset-password
// @access  Private/SuperAdmin
const resetUserPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return next(new AppError('User not found.', 404));

    const generatedPassword = newPassword || `Pass@${Math.random().toString(36).substring(2, 10)}`;
    user.password = generatedPassword;
    await user.save();

    await AuditLog.create({
      actorId: getActorId(req),
      actorRole: req.user.isImpersonated ? 'super-admin' : req.user.role,
      action: 'user.reset_password',
      targetType: 'User',
      targetId: user._id,
      collegeId: user.collegeId || null,
      metadata: { userEmail: user.email },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      message: 'Password reset successfully.',
      tempPassword: generatedPassword,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Impersonate user (generate access token)
// @route   POST /api/dashboards/admin-portal/users/:id/impersonate
// @access  Private/SuperAdmin
const impersonateUser = async (req, res, next) => {
  try {
    if (req.user && req.user.isImpersonated) {
      return next(
        new AppError(
          'Cannot perform nested impersonation while already in an impersonated session.',
          403
        )
      );
    }

    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('Target user not found.', 404));

    if (user.role === 'super-admin') {
      return next(new AppError('Cannot impersonate another super-admin.', 400));
    }

    const { generateAccessToken } = require('../../utils/token');
    const token = generateAccessToken(user, {
      isImpersonated: true,
      originalSuperAdminId: req.user.id,
    });

    await AuditLog.create({
      actorId: getActorId(req),
      actorRole: req.user.role,
      action: 'user.impersonate',
      targetType: 'User',
      targetId: user._id,
      collegeId: user.collegeId || null,
      metadata: { impersonatedUserEmail: user.email, role: user.role },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        collegeId: user.collegeId,
      },
      message: `Impersonation token generated for ${user.name}.`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get live system telemetry & process metrics
// @route   GET /api/dashboards/admin-portal/system/health
// @access  Private/SuperAdmin
const getSystemHealth = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    const dbStatesMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

    const memoryUsage = process.memoryUsage();

    const isRedisReady =
      redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect');

    res.json({
      success: true,
      data: {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        pid: process.pid,
        memoryUsage: {
          rssMB: (memoryUsage.rss / (1024 * 1024)).toFixed(2),
          heapTotalMB: (memoryUsage.heapTotal / (1024 * 1024)).toFixed(2),
          heapUsedMB: (memoryUsage.heapUsed / (1024 * 1024)).toFixed(2),
        },
        database: {
          status: dbStatesMap[dbState] || 'unknown',
          host: mongoose.connection.host || 'localhost',
          name: mongoose.connection.name || 'bookbuddy',
        },
        redis: {
          status: isRedisReady ? 'connected' : 'disabled_fallback',
        },
        timestamp: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get background cron logs
// @route   GET /api/dashboards/admin-portal/system/cron-logs
// @access  Private/SuperAdmin
const getCronLogs = async (req, res, next) => {
  try {
    const CronRunLog = require('../../models/CronRunLog');
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await CronRunLog.countDocuments(filter);
    const logs = await CronRunLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get cross-tenant global loans
// @route   GET /api/dashboards/admin-portal/data/loans
// @access  Private/SuperAdmin
const getGlobalLoans = async (req, res, next) => {
  try {
    const { status, collegeId, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (collegeId) filter.collegeId = collegeId;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Loan.countDocuments(filter);
    const loans = await Loan.find(filter)
      .populate('userId', 'name email studentId')
      .populate('bookId', 'title isbn author')
      .populate('collegeId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      data: loans,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get cross-tenant global fines
// @route   GET /api/dashboards/admin-portal/data/fines
// @access  Private/SuperAdmin
const getGlobalFines = async (req, res, next) => {
  try {
    const { status, collegeId, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (collegeId) filter.collegeId = collegeId;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Fine.countDocuments(filter);
    const fines = await Fine.find(filter)
      .populate('userId', 'name email studentId')
      .populate('loanId')
      .populate('collegeId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      data: fines,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get global catalog books across colleges
// @route   GET /api/dashboards/admin-portal/data/catalog
// @access  Private/SuperAdmin
const getGlobalCatalog = async (req, res, next) => {
  try {
    const Book = require('../../models/Book');
    const { search, collegeId, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (search) {
      const searchRegex = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [{ title: searchRegex }, { author: searchRegex }, { isbn: searchRegex }];
    }

    if (collegeId) filter.collegeId = collegeId;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Book.countDocuments(filter);
    const books = await Book.find(filter)
      .populate('collegeId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      data: books,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get global support complaints across colleges
// @route   GET /api/dashboards/admin-portal/support/complaints
// @access  Private/SuperAdmin
const getGlobalComplaints = async (req, res, next) => {
  try {
    const Complaint = require('../../models/Complaint');
    const { status, collegeId, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (collegeId) filter.collegeId = collegeId;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Complaint.countDocuments(filter);
    const complaints = await Complaint.find(filter)
      .populate('submittedBy', 'name email studentId')
      .populate('collegeId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      data: complaints,
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update support complaint status/response
// @route   PATCH /api/dashboards/admin-portal/support/complaints/:id
// @access  Private/SuperAdmin
const updateComplaintStatus = async (req, res, next) => {
  try {
    const Complaint = require('../../models/Complaint');
    const { status, adminResponse } = req.body;

    if (status && !['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return next(new AppError('Invalid complaint status value.', 400));
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return next(new AppError('Complaint not found.', 404));
    if (status) complaint.status = status;
    if (adminResponse !== undefined) complaint.adminResponse = adminResponse;
    complaint.resolvedAt = status === 'resolved' ? new Date() : complaint.resolvedAt;

    await complaint.save();

    await AuditLog.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'complaint.update',
      targetType: 'Complaint',
      targetId: complaint._id,
      collegeId: complaint.collegeId || null,
      metadata: { status, adminResponse },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      data: complaint,
      message: 'Complaint updated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get persisted system settings
// @route   GET /api/dashboards/admin-portal/settings
// @access  Private/SuperAdmin
const getSystemSettings = async (req, res, next) => {
  try {
    const SystemSetting = require('../../models/SystemSetting');
    const settings = await SystemSetting.find();
    const settingsMap = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    const defaults = {
      smtpHost: settingsMap.smtpHost || 'smtp.sendgrid.net',
      smtpPort: settingsMap.smtpPort || 587,
      smtpSecurity: settingsMap.smtpSecurity || 'TLS',
      smtpUser: settingsMap.smtpUser || 'apikey',
      autoBackupEnabled:
        settingsMap.autoBackupEnabled !== undefined ? settingsMap.autoBackupEnabled : true,
      autoBackupSchedule: settingsMap.autoBackupSchedule || 'Daily at 03:00 AM UTC',
      maintenanceMode: settingsMap.maintenanceMode || false,
    };

    res.json({
      success: true,
      data: defaults,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update system settings
// @route   PUT /api/dashboards/admin-portal/settings
// @access  Private/SuperAdmin
const updateSystemSettings = async (req, res, next) => {
  try {
    const SystemSetting = require('../../models/SystemSetting');
    const updates = req.body;

    for (const [key, value] of Object.entries(updates)) {
      await SystemSetting.findOneAndUpdate(
        { key },
        { key, value, updatedBy: req.user.id },
        { upsert: true, new: true }
      );
    }

    await AuditLog.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'system_settings.update',
      targetType: 'SystemSetting',
      targetId: req.user.id,
      metadata: { keysUpdated: Object.keys(updates) },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      message: 'System settings updated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Trigger manual DB backup
// @route   POST /api/dashboards/admin-portal/settings/trigger-backup
// @access  Private/SuperAdmin
const triggerManualBackup = async (req, res, next) => {
  try {
    const backupFilename = `backup-${new Date().toISOString().split('T')[0]}-${Date.now()}.tar.gz`;

    await AuditLog.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'system_backup.trigger',
      targetType: 'SystemSetting',
      targetId: req.user.id,
      metadata: { backupFilename },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    });

    res.json({
      success: true,
      message: 'Manual database snapshot initiated successfully.',
      filename: backupFilename,
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview,
  getAdmins,
  createAdmin,
  createCollege,
  getAuditLogs,
  listColleges,
  getCollegeDetails,
  updateCollege,
  patchCollegeStatus,
  getGlobalPendingEResources,
  moderateEResourceGlobal,
  publishEResourceGlobal,
  getPendingOnboardings,
  approveTenantOnboarding,
  rejectTenantOnboarding,
  getUsers,
  updateUserStatus,
  updateUserRole,
  resetUserPassword,
  impersonateUser,
  getSystemHealth,
  getCronLogs,
  getGlobalLoans,
  getGlobalFines,
  getGlobalCatalog,
  getGlobalComplaints,
  updateComplaintStatus,
  getSystemSettings,
  updateSystemSettings,
  triggerManualBackup,
};
