const path = require('path');
const fs = require('fs');
const multer = require('multer');
const UploadJob = require('../models/UploadJob');
const AppError = require('../utils/AppError');
const { processBulkUploadJob } = require('../services/bulkUploadWorker');

// Multer storage setup
const uploadDir = path.join(__dirname, '../../uploads/bulk-students');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `bulk-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

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
          if (req.file && fs.existsSync(req.file.path)) {
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
          status: 'queued',
        });

        // Trigger worker asynchronously without blocking HTTP response
        setImmediate(() => {
          processBulkUploadJob(jobId, req.file.path);
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
        if (req.file && fs.existsSync(req.file.path)) {
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
        failedRows: job.failedRows,
        lastCheckpointRow: job.lastCheckpointRow,
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

    const fullPath = path.join(__dirname, '../../', job.errorReportUrl);
    if (!fs.existsSync(fullPath)) {
      return next(new AppError('Error report file has expired or was removed.', 404));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=error_report_${jobId}.csv`);
    res.sendFile(fullPath);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitBulkUpload,
  getBulkUploadStatus,
  downloadUploadErrorReport,
};
