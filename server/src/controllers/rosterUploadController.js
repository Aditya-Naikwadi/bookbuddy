const crypto = require('crypto');
const xlsx = require('xlsx');
const User = require('../models/User');
const College = require('../models/College');
const StudentUploadBatch = require('../models/StudentUploadBatch');
const mailer = require('../utils/mailer');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

/**
 * Formula Injection Defense:
 * If a cell string value begins with =, +, -, or @, prefix with single quote (')
 */
const sanitizeFormulaInjection = (val) => {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (['=', '+', '-', '@'].some((char) => trimmed.startsWith(char))) {
    return `'${trimmed}`;
  }
  return trimmed;
};

/**
 * Standardize input row fields regardless of header casing or alternate names
 */
const normalizeRow = (rawRow) => {
  const row = {};
  for (const [key, val] of Object.entries(rawRow)) {
    const cleanKey = key
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const cleanVal = typeof val === 'string' ? val.trim() : val;

    if (['studentid', 'rollnumber', 'id', 'studentno', 'regno'].includes(cleanKey)) {
      row.studentId = cleanVal ? String(cleanVal) : '';
    } else if (['name', 'studentname', 'fullname'].includes(cleanKey)) {
      row.name = cleanVal ? String(cleanVal) : '';
    } else if (['email', 'emailaddress', 'studentemail'].includes(cleanKey)) {
      row.email = cleanVal ? String(cleanVal).toLowerCase() : '';
    } else if (['program', 'degree', 'course', 'branch', 'major'].includes(cleanKey)) {
      row.program = cleanVal ? String(cleanVal) : '';
    } else if (['year', 'classyear', 'semester', 'grade'].includes(cleanKey)) {
      row.year = cleanVal ? String(cleanVal) : '';
    } else if (['collegeid', 'college', 'collegename', 'institution'].includes(cleanKey)) {
      row.fileCollegeId = cleanVal ? String(cleanVal) : '';
    }
  }
  return row;
};

/**
 * Step 1: DRY-RUN VALIDATION (POST /api/admin/students/upload/validate)
 * Parses CSV/Excel file, checks data integrity, duplicate checks, collision analysis.
 * ABSOLUTELY NOTHING is written to User/Student collection in this step.
 */
exports.validateRosterUpload = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload a valid CSV or Excel file', 400));
  }

  // Derive tenant collegeId strictly from admin session
  const adminCollegeId = req.user.collegeId;
  if (!adminCollegeId) {
    return next(new AppError('Admin user must belong to a college', 403));
  }

  const college = await College.findById(adminCollegeId);
  if (!college) {
    return next(new AppError('College not found', 444));
  }

  // Parse workbook from buffer
  let workbook;
  try {
    workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  } catch (err) {
    return next(new AppError(`Failed to parse file: ${err.message}`, 400));
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return next(new AppError('Uploaded file contains no sheets', 400));
  }

  const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  if (rawRows.length === 0) {
    return next(new AppError('Uploaded file is empty', 400));
  }

  if (rawRows.length > 5000) {
    return next(new AppError('File exceeds maximum limit of 5,000 student rows per upload', 400));
  }

  const errors = [];
  const warnings = [];
  const validRows = [];
  const seenStudentIds = new Set();
  const seenEmails = new Set();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Row by row validation
  rawRows.forEach((rawRow, index) => {
    const rowNum = index + 2; // Header is row 1
    const normalized = normalizeRow(rawRow);

    // Warn if file includes a college column (trust strictly session collegeId)
    if (normalized.fileCollegeId && !warnings.some((w) => w.code === 'FILE_COLLEGE_IGNORED')) {
      warnings.push({
        code: 'FILE_COLLEGE_IGNORED',
        message:
          'College identifier in file ignored. Records will be strictly created under your administrative college context.',
      });
    }

    const { studentId, name, email, program, year } = normalized;

    if (!studentId) {
      errors.push({
        rowNumber: rowNum,
        studentId: '',
        email: '',
        reason: 'Missing Student ID / Roll Number',
      });
      return;
    }

    if (!name) {
      errors.push({
        rowNumber: rowNum,
        studentId,
        email: email || '',
        reason: 'Missing Student Name',
      });
      return;
    }

    if (!email || !emailRegex.test(email)) {
      errors.push({
        rowNumber: rowNum,
        studentId,
        email: email || '',
        reason: 'Invalid or missing email address',
      });
      return;
    }

    // In-file duplicate detection
    if (seenStudentIds.has(studentId)) {
      errors.push({
        rowNumber: rowNum,
        studentId,
        email,
        reason: `Duplicate Student ID (${studentId}) within file`,
      });
      return;
    }

    if (seenEmails.has(email)) {
      errors.push({
        rowNumber: rowNum,
        studentId,
        email,
        reason: `Duplicate Email (${email}) within file`,
      });
      return;
    }

    seenStudentIds.add(studentId);
    seenEmails.add(email);

    validRows.push({
      rowNumber: rowNum,
      studentId: sanitizeFormulaInjection(studentId),
      name: sanitizeFormulaInjection(name),
      email: sanitizeFormulaInjection(email),
      program: sanitizeFormulaInjection(program),
      year: sanitizeFormulaInjection(year),
    });
  });

  // DB Collision Analysis under session adminCollegeId
  const existingStudents = await User.find(
    { collegeId: adminCollegeId, studentId: { $in: Array.from(seenStudentIds) } },
    'studentId email'
  ).lean();

  const existingStudentIdMap = new Map(existingStudents.map((s) => [s.studentId, s]));

  let toCreateCount = 0;
  let toUpdateCount = 0;

  validRows.forEach((row) => {
    if (existingStudentIdMap.has(row.studentId)) {
      toUpdateCount += 1;
      row.action = 'update';
    } else {
      toCreateCount += 1;
      row.action = 'create';
    }
  });

  // Save preview metadata to StudentUploadBatch (writes NO student account records!)
  const batch = await StudentUploadBatch.create({
    collegeId: adminCollegeId,
    uploadedBy: req.user._id,
    fileName: req.file.originalname,
    totalRows: rawRows.length,
    validRowsCount: validRows.length,
    createdCount: toCreateCount,
    updatedCount: toUpdateCount,
    failedRows: errors,
    status: 'preview',
  });

  res.status(200).json({
    success: true,
    message: 'File validated successfully (dry-run report).',
    batchId: batch._id,
    fileName: req.file.originalname,
    summary: {
      totalRows: rawRows.length,
      validRowsCount: validRows.length,
      failedRowsCount: errors.length,
      toCreateCount,
      toUpdateCount,
    },
    errors,
    warnings,
    previewRows: validRows.slice(0, 100), // First 100 rows preview
    validRowsPayload: validRows, // Full payload for commit call
  });
});

/**
 * Step 2: COMMIT ROSTER UPLOAD (POST /api/admin/students/upload/commit)
 * Creates/Updates student accounts, issues single-use activation tokens, sends emails.
 */
exports.commitRosterUpload = asyncHandler(async (req, res, next) => {
  const { batchId, validRows } = req.body;

  if (!batchId) {
    return next(new AppError('Batch ID is required for commit', 400));
  }

  const adminCollegeId = req.user.collegeId;
  const college = await College.findById(adminCollegeId);
  if (!college) {
    return next(new AppError('College context not found', 404));
  }

  const batch = await StudentUploadBatch.findOne({ _id: batchId, collegeId: adminCollegeId });
  if (!batch) {
    return next(new AppError('Upload batch preview not found or unauthorized', 404));
  }

  if (batch.status === 'committed') {
    return next(new AppError('This upload batch has already been committed', 400));
  }

  if (!Array.isArray(validRows) || validRows.length === 0) {
    return next(new AppError('No valid rows provided for commit', 400));
  }

  let createdCount = 0;
  let updatedCount = 0;
  const activeStudentIdsInBatch = [];

  for (const row of validRows) {
    const { studentId, name, email, program, year } = row;
    activeStudentIdsInBatch.push(studentId);

    // Query existing student strictly by { collegeId, studentId }
    const existing = await User.findOne({ collegeId: adminCollegeId, studentId });

    if (existing) {
      // Update non-credential metadata only — NEVER reset existing password or token!
      existing.name = name || existing.name;
      existing.program = program || existing.program;
      existing.year = year || existing.year;
      existing.uploadBatchId = batch._id;
      existing.uploadedAt = new Date();
      if (existing.status === 'inactive') {
        existing.status = 'active';
      }
      await existing.save();
      updatedCount += 1;
    } else {
      // Generate cryptographically random single-use activation token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours expiry

      await User.create({
        collegeId: adminCollegeId, // Session-derived collegeId
        studentId,
        name,
        email,
        program,
        year,
        role: 'student',
        status: 'invited',
        invitedVia: 'bulk_upload',
        activationTokenHash: tokenHash,
        activationTokenExpiresAt: expiresAt,
        uploadBatchId: batch._id,
        uploadedAt: new Date(),
      });

      createdCount += 1;

      // Dispatch activation email asynchronously
      try {
        const domain = process.env.CLIENT_URL || 'http://localhost:5173';
        const activationLink = `${domain}/c/${college.slug}/activate?token=${rawToken}`;
        await mailer.sendMail({
          to: email,
          subject: `Activate Your ${college.name} BookBuddy Account`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
              <h2 style="color: #4f46e5;">Welcome to ${college.name} BookBuddy!</h2>
              <p>Hello ${name},</p>
              <p>An official student account has been created for you by your college administration.</p>
              <p>Please set your password using the secure link below (valid for 48 hours):</p>
              <p style="margin: 25px 0;">
                <a href="${activationLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Activate My Account</a>
              </p>
              <p style="color: #6b7280; font-size: 13px;">If you cannot click the button, copy and paste this link into your browser:<br>${activationLink}</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="color: #9ca3af; font-size: 12px;">Student ID: ${studentId} | College: ${college.name}</p>
            </div>
          `,
        });
      } catch (mailErr) {
        logger.error(`Failed to send activation email to ${email}: ${mailErr.message}`);
      }
    }
  }

  // Update batch record status
  batch.status = 'committed';
  batch.createdCount = createdCount;
  batch.updatedCount = updatedCount;
  batch.committedAt = new Date();
  await batch.save();

  res.status(200).json({
    success: true,
    message: `Roster upload committed successfully. ${createdCount} accounts created, ${updatedCount} records updated.`,
    summary: {
      createdCount,
      updatedCount,
      totalCommitted: createdCount + updatedCount,
    },
    batchId: batch._id,
  });
});

/**
 * GET /api/admin/students/export — Export College Roster with Formula Injection Sanitization
 */
exports.exportRoster = asyncHandler(async (req, res, next) => {
  const adminCollegeId = req.user.collegeId;
  const students = await User.find({ collegeId: adminCollegeId, role: 'student' }).lean();

  const exportData = students.map((s) => ({
    'Student ID': sanitizeFormulaInjection(s.studentId),
    Name: sanitizeFormulaInjection(s.name),
    Email: sanitizeFormulaInjection(s.email),
    Program: sanitizeFormulaInjection(s.program || ''),
    Year: sanitizeFormulaInjection(s.year || ''),
    Status: s.status,
    'Uploaded At': s.uploadedAt ? new Date(s.uploadedAt).toISOString() : '',
  }));

  const worksheet = xlsx.utils.json_to_sheet(exportData);
  const csvBuffer = xlsx.utils.sheet_to_csv(worksheet);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=roster_export_${Date.now()}.csv`);
  res.status(200).send(csvBuffer);
});
