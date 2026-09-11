const path = require('path');
const fs = require('fs');
const multer = require('multer');
const UploadJob = require('../models/UploadJob');
const UploadAuditLog = require('../models/UploadAuditLog');
const AppError = require('../utils/AppError');
const { processBulkUploadJob } = require('../services/bulkUploadWorker');

// Multer memory storage setup (Serverless & container safe, prevents EROFS)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/csv',
    'text/plain',
    'application/octet-stream',
  ];

  if (ext === '.csv' || allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Invalid file format. Only CSV files (.csv) are supported for bulk student upload.',
        400
      ),
      false
    );
  }
};

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter,
}).single('file');

// @desc    Upload student spreadsheet and enqueue async ingestion job
// @route   POST /api/college/:id/students/bulk-upload
// @access  Private (College Admin / Super Admin)
const submitBulkUpload = async (req, res, next) => {
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      return next(err instanceof AppError ? err : new AppError(err.message, 400));
    }

    // Validate magic bytes and scan for malware
    const { validateMagicBytes } = require('../middlewares/fileUploadValidation');
    return validateMagicBytes(['text/csv', 'text/plain'])(req, res, async (vErr) => {
      if (vErr) return next(vErr);

      try {
        const { id: collegeId } = req.params;

        // Tenant isolation check
        if (
          req.user.role !== 'super-admin' &&
          req.user.role !== 'super_admin' &&
          req.user.collegeId?.toString() !== collegeId
        ) {
          if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return next(
            new AppError('Unauthorized upload request for another institution tenant.', 403)
          );
        }

        if (!req.file) {
          return next(
            new AppError('No CSV file uploaded. Please attach a file using key "file".', 400)
          );
        }

        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        const uploadJob = await UploadJob.create({
          jobId,
          collegeId,
          createdBy: req.user._id || req.user.id,
          fileName: req.file.originalname || 'students.csv',
          fileSizeBytes: req.file.size || (req.file.buffer ? req.file.buffer.length : 0),
          status: 'queued',
        });

        // Trigger worker asynchronously without blocking HTTP response
        setImmediate(() => {
          processBulkUploadJob(jobId, req.file.buffer || req.file.path);
        });

        res.status(202).json({
          success: true,
          message: 'Bulk student upload job queued successfully for background processing.',
          data: {
            jobId: uploadJob.jobId,
            status: uploadJob.status,
            createdAt: uploadJob.createdAt,
          },
        });
      } catch (error) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        next(error);
      }
    });
  });
};

// @desc    Get status and progress of a bulk upload job
// @route   GET /api/college/:id/students/upload/:jobId
// @access  Private (College Admin / Super Admin)
const getBulkUploadStatus = async (req, res, next) => {
  try {
    const { id: collegeId, jobId } = req.params;

    // Tenant isolation check
    if (
      req.user.role !== 'super-admin' &&
      req.user.role !== 'super_admin' &&
      req.user.collegeId?.toString() !== collegeId
    ) {
      return next(new AppError("Unauthorized access to another tenant's upload job.", 403));
    }

    const job = await UploadJob.findOne({ jobId, collegeId }).lean();
    if (!job) {
      return next(new AppError('Upload job not found.', 404));
    }

    res.json({
      success: true,
      data: {
        jobId: job.jobId,
        status: job.status,
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        succeededRows: job.succeededRows,
        insertedRows: job.insertedRows || 0,
        updatedRows: job.updatedRows || 0,
        failedRows: job.failedRows,
        lastCheckpointRow: job.lastCheckpointRow,
        deliverySummary: job.deliverySummary || { emailed: 0, sms: 0, handout: 0 },
        auditLogVersion: job.auditLogVersion || null,
        errorReportUrl: job.errorReportUrl,
        errorDetails: job.errorDetails || [],
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download error report CSV for a bulk upload job
// @route   GET /api/college/:id/students/upload/:jobId/errors
// @access  Private (College Admin / Super Admin)
const downloadUploadErrorReport = async (req, res, next) => {
  try {
    const { id: collegeId, jobId } = req.params;

    // Tenant isolation check
    if (
      req.user.role !== 'super-admin' &&
      req.user.role !== 'super_admin' &&
      req.user.collegeId?.toString() !== collegeId
    ) {
      return next(new AppError("Unauthorized access to another tenant's error report.", 403));
    }

    const job = await UploadJob.findOne({ jobId, collegeId });
    if (!job) {
      return next(new AppError('Upload job not found.', 404));
    }

    if (!job.errorReportUrl) {
      return next(new AppError('No error report exists for this upload job.', 404));
    }

    const os = require('os');
    const tmpPath = path.join(os.tmpdir(), 'bookbuddy_reports', path.basename(job.errorReportUrl));
    const localPath = path.join(__dirname, '../../', job.errorReportUrl);
    const fullPath = fs.existsSync(tmpPath) ? tmpPath : fs.existsSync(localPath) ? localPath : null;

    if (!fullPath) {
      return next(new AppError('Error report file has expired or was removed.', 404));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=error_report_${jobId}.csv`);
    res.sendFile(fullPath);
  } catch (error) {
    next(error);
  }
};

// @desc    Download printed handouts / credential slips CSV for offline students
// @route   GET /api/college/:id/students/upload/:jobId/handouts
// @access  Private (College Admin / Super Admin)
const downloadPrintedHandouts = async (req, res, next) => {
  try {
    const { id: collegeId, jobId } = req.params;

    if (
      req.user.role !== 'super-admin' &&
      req.user.role !== 'super_admin' &&
      req.user.collegeId?.toString() !== collegeId
    ) {
      return next(new AppError("Unauthorized access to another tenant's credential slips.", 403));
    }

    const job = await UploadJob.findOne({ jobId, collegeId });
    if (!job) {
      return next(new AppError('Upload job not found.', 404));
    }

    const slips = job.credentialSlips || [];
    let csv = 'Student ID,Name,Department,Phone,Temporary Password,Delivery Channel\n';
    for (const slip of slips) {
      const id = slip.studentId || '';
      const name = `"${(slip.name || '').replace(/"/g, '""')}"`;
      const dept = `"${(slip.department || '').replace(/"/g, '""')}"`;
      const phone = `"${(slip.phone || '').replace(/"/g, '""')}"`;
      const pass = slip.tempPassword || '';
      const channel = slip.deliveryChannel || 'handout';
      csv += `${id},${name},${dept},${phone},${pass},${channel}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=credential_handouts_${jobId}.csv`);
    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

// @desc    Get versioned upload audit log history for a college tenant
// @route   GET /api/college/:id/students/upload-audit-logs
// @access  Private (College Admin / Super Admin)
const getUploadAuditLogs = async (req, res, next) => {
  try {
    const { id: collegeId } = req.params;

    if (
      req.user.role !== 'super-admin' &&
      req.user.role !== 'super_admin' &&
      req.user.collegeId?.toString() !== collegeId
    ) {
      return next(new AppError("Unauthorized access to another tenant's audit logs.", 403));
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      UploadAuditLog.find({ collegeId })
        .sort({ version: -1 })
        .skip(skip)
        .limit(limit)
        .select('-credentialSlips')
        .lean(),
      UploadAuditLog.countDocuments({ collegeId }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed upload audit log for a specific version
// @route   GET /api/college/:id/students/upload-audit-logs/:version
// @access  Private (College Admin / Super Admin)
const getUploadAuditLogByVersion = async (req, res, next) => {
  try {
    const { id: collegeId, version } = req.params;

    if (
      req.user.role !== 'super-admin' &&
      req.user.role !== 'super_admin' &&
      req.user.collegeId?.toString() !== collegeId
    ) {
      return next(new AppError("Unauthorized access to another tenant's audit logs.", 403));
    }

    const auditLog = await UploadAuditLog.findOne({
      collegeId,
      version: parseInt(version, 10),
    }).lean();

    if (!auditLog) {
      return next(new AppError(`Upload audit log for version ${version} not found.`, 404));
    }

    res.json({
      success: true,
      data: auditLog,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download printed handouts / slips for a specific audit version
// @route   GET /api/college/:id/students/upload-audit-logs/:version/handouts
// @access  Private (College Admin / Super Admin)
const downloadAuditLogHandouts = async (req, res, next) => {
  try {
    const { id: collegeId, version } = req.params;

    if (
      req.user.role !== 'super-admin' &&
      req.user.role !== 'super_admin' &&
      req.user.collegeId?.toString() !== collegeId
    ) {
      return next(new AppError("Unauthorized access to another tenant's credential slips.", 403));
    }

    const auditLog = await UploadAuditLog.findOne({
      collegeId,
      version: parseInt(version, 10),
    });

    if (!auditLog) {
      return next(new AppError(`Upload audit log for version ${version} not found.`, 404));
    }

    const slips = auditLog.credentialSlips || [];
    let csv = 'Student ID,Name,Department,Phone,Temporary Password,Delivery Channel\n';
    for (const slip of slips) {
      const id = slip.studentId || '';
      const name = `"${(slip.name || '').replace(/"/g, '""')}"`;
      const dept = `"${(slip.department || '').replace(/"/g, '""')}"`;
      const phone = `"${(slip.phone || '').replace(/"/g, '""')}"`;
      const pass = slip.tempPassword || '';
      const channel = slip.deliveryChannel || 'handout';
      csv += `${id},${name},${dept},${phone},${pass},${channel}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=credential_handouts_v${version}.csv`
    );
    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitBulkUpload,
  getBulkUploadStatus,
  downloadUploadErrorReport,
  downloadPrintedHandouts,
  getUploadAuditLogs,
  getUploadAuditLogByVersion,
  downloadAuditLogHandouts,
};
