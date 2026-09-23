const crypto = require('crypto');
const xlsx = require('xlsx');
const User = require('../models/User');
const College = require('../models/College');
const StudentUploadBatch = require('../models/StudentUploadBatch');
const mailer = require('../utils/mailer');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { isTwilioConfigured, sendCredentialSMS } = require('../services/smsService');
const { normalizeEmail, normalizeStudentId, ROLES } = require('@bookbuddy/shared');

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
 * Generate cryptographically secure 12-character temporary password
 */
function generateSecureTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;

  let pwd = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    special[crypto.randomInt(0, special.length)],
  ];

  for (let i = 4; i < 12; i++) {
    pwd.push(all[crypto.randomInt(0, all.length)]);
  }

  // Shuffle Fisher-Yates
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }

  return pwd.join('');
}

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
      row.studentId = cleanVal ? normalizeStudentId(cleanVal) : '';
    } else if (['name', 'studentname', 'fullname'].includes(cleanKey)) {
      row.name = cleanVal ? String(cleanVal) : '';
    } else if (['email', 'emailaddress', 'studentemail'].includes(cleanKey)) {
      row.email = cleanVal ? normalizeEmail(cleanVal) : '';
    } else if (
      ['program', 'degree', 'course', 'branch', 'major', 'department'].includes(cleanKey)
    ) {
      row.program = cleanVal ? String(cleanVal) : '';
    } else if (['year', 'classyear', 'semester', 'grade'].includes(cleanKey)) {
      row.year = cleanVal ? String(cleanVal) : '';
    } else if (['collegeid', 'college', 'collegename', 'institution'].includes(cleanKey)) {
      row.fileCollegeId = cleanVal ? String(cleanVal) : '';
    } else if (['phone', 'phonenumber', 'mobile', 'contact'].includes(cleanKey)) {
      row.phone = cleanVal ? String(cleanVal) : '';
    }
  }
  return row;
};

/**
 * Step 1: DRY-RUN VALIDATION (POST /api/admin/students/upload/validate)
 * Parses CSV/Excel file, checks data integrity, duplicate checks, collision analysis.
 * Writes NO student account records.
 */
exports.validateRosterUpload = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload a valid CSV or Excel file', 400));
  }

  const adminCollegeId = req.user.collegeId;
  if (!adminCollegeId) {
    return next(new AppError('Admin user must belong to a college', 403));
  }

  const college = await College.findById(adminCollegeId);
  if (!college) {
    return next(new AppError('College not found', 404));
  }

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

  if (rawRows.length > 25000) {
    return next(new AppError('File exceeds maximum limit of 25,000 student rows per upload', 400));
  }

  const errors = [];
  const warnings = [];
  const validRows = [];
  const seenStudentIds = new Set();
  const seenEmails = new Set();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  rawRows.forEach((rawRow, index) => {
    const rowNum = index + 2;
    const normalized = normalizeRow(rawRow);

    if (normalized.fileCollegeId && !warnings.some((w) => w.code === 'FILE_COLLEGE_IGNORED')) {
      warnings.push({
        code: 'FILE_COLLEGE_IGNORED',
        message:
          'College identifier in file ignored. Records will be strictly created under your administrative college context.',
      });
    }

    const { studentId, name, email, program, year, phone } = normalized;

    if (!studentId) {
      errors.push({
        rowNumber: rowNum,
        studentId: '',
        email: email || '',
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

    if (email && !emailRegex.test(email)) {
      errors.push({
        rowNumber: rowNum,
        studentId,
        email,
        reason: `Invalid email format (${email})`,
      });
      return;
    }

    if (seenStudentIds.has(studentId)) {
      errors.push({
        rowNumber: rowNum,
        studentId,
        email: email || '',
        reason: `Duplicate Student ID (${studentId}) within file`,
      });
      return;
    }

    if (email && seenEmails.has(email)) {
      errors.push({
        rowNumber: rowNum,
        studentId,
        email,
        reason: `Duplicate Email (${email}) within file`,
      });
      return;
    }

    seenStudentIds.add(studentId);
    if (email) {
      seenEmails.add(email);
    }

    validRows.push({
      rowNumber: rowNum,
      studentId: sanitizeFormulaInjection(studentId),
      name: sanitizeFormulaInjection(name),
      email: email ? sanitizeFormulaInjection(email) : '',
      program: sanitizeFormulaInjection(program || ''),
      year: sanitizeFormulaInjection(year || ''),
      phone: phone ? sanitizeFormulaInjection(phone) : '',
      hasEmail: Boolean(email),
    });
  });

  // DB Collision Analysis under session adminCollegeId
  const existingStudents = await User.find(
    { collegeId: adminCollegeId, studentId: { $in: Array.from(seenStudentIds) } },
    'studentId email name status'
  ).lean();

  const existingStudentIdMap = new Map(
    existingStudents.map((s) => [normalizeStudentId(s.studentId), s])
  );

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
    previewRows: validRows.slice(0, 100),
    validRowsPayload: validRows,
  });
});

const NOTIFICATION_CONCURRENCY = parseInt(process.env.ROSTER_NOTIFICATION_CONCURRENCY || '25', 10);

/**
 * Concurrently processes an array of notification tasks with a bounded concurrency pool (backpressure).
 * Ensures at most `concurrency` asynchronous workers run simultaneously, preventing socket exhaustion.
 *
 * @param {Array} items
 * @param {number} concurrency
 * @param {Function} workerFn
 * @returns {Promise<Array>}
 */
async function dispatchWithBackpressure(items, concurrency, workerFn) {
  if (!items || items.length === 0) return [];
  const results = new Array(items.length);
  let cursor = 0;
  const workerLimit = Math.max(1, Math.min(concurrency, items.length));

  const workers = Array.from({ length: workerLimit }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        results[idx] = await workerFn(items[idx], idx);
      } catch (err) {
        results[idx] = { error: err };
      }
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Background Processor for Asynchronous Roster Ingestion
 */
async function processRosterBatchAsync(
  batchId,
  adminCollegeId,
  validRows,
  bulkDeactivateAbsent,
  college
) {
  try {
    const batch = await StudentUploadBatch.findById(batchId);
    if (!batch) return;

    batch.status = 'processing';
    await batch.save();

    let createdCount = 0;
    let updatedCount = 0;
    let deactivatedCount = 0;
    const rowResults = [];
    const credentialSlips = [];
    const processedStudentIds = new Set();

    const domain = process.env.CLIENT_URL || 'http://localhost:5173';

    const CHUNK_SIZE = 500;

    for (let c = 0; c < validRows.length; c += CHUNK_SIZE) {
      const chunk = validRows.slice(c, c + CHUNK_SIZE);
      const chunkStudentIds = chunk.map((r) => normalizeStudentId(r.studentId));

      // Single query lookup for all existing students in this chunk
      const existingInChunk = await User.find({
        collegeId: adminCollegeId,
        studentId: { $in: chunkStudentIds },
      });
      const existingMap = new Map(existingInChunk.map((u) => [normalizeStudentId(u.studentId), u]));

      const newUsersToCreate = [];
      const notificationTasks = [];
      const existingUpdatePromises = [];

      for (let i = 0; i < chunk.length; i++) {
        const row = chunk[i];
        const overallIndex = c + i;
        const { rowNumber, studentId, name, email, program, year, phone } = row;
        const normalizedStudentId = normalizeStudentId(studentId);
        processedStudentIds.add(normalizedStudentId);

        const existing = existingMap.get(normalizedStudentId);

        if (existing) {
          // Update metadata only — preserve existing password and credentials!
          existing.name = name || existing.name;
          existing.program = program || existing.program;
          existing.year = year || existing.year;
          if (email && !existing.email) existing.email = email;
          if (phone && !existing.phone) existing.phone = phone;
          existing.uploadBatchId = batch._id;
          existing.uploadedAt = new Date();

          if (existing.status === 'inactive') {
            existing.status = 'active';
          }

          existingUpdatePromises.push(existing.save());
          updatedCount += 1;

          rowResults.push({
            rowNumber: rowNumber || overallIndex + 2,
            studentId: normalizedStudentId,
            name,
            email: existing.email || email || '',
            action: 'updated',
            deliveryStatus: 'active_preserved',
            reason: 'Existing student record updated; active credentials preserved.',
          });
        } else {
          // New student account provisioning
          const tempPassword = generateSecureTempPassword();
          const rawToken = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
          const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

          newUsersToCreate.push({
            collegeId: adminCollegeId,
            studentId: normalizedStudentId,
            name,
            email: email || undefined,
            phone: phone || undefined,
            program,
            year,
            role: 'student',
            status: 'invited',
            password: tempPassword,
            mustChangePasswordOnNextLogin: true,
            invitedVia: 'bulk_upload',
            activationTokenHash: tokenHash,
            activationTokenExpiresAt: expiresAt,
            uploadBatchId: batch._id,
            uploadedAt: new Date(),
          });

          notificationTasks.push({
            rowNumber: rowNumber || overallIndex + 2,
            overallIndex,
            studentId: normalizedStudentId,
            name,
            email,
            phone,
            program,
            tempPassword,
            rawToken,
          });

          createdCount += 1;
        }
      }

      // Execute existing updates concurrently
      if (existingUpdatePromises.length > 0) {
        await Promise.all(existingUpdatePromises);
      }

      // Execute new user creations concurrently with pre-hashed passwords
      if (newUsersToCreate.length > 0) {
        const argon2 = require('argon2');
        const argonOptions =
          process.env.NODE_ENV === 'test'
            ? { type: argon2.argon2id, timeCost: 1, memoryCost: 2048 }
            : { type: argon2.argon2id };
        await Promise.all(
          newUsersToCreate.map(async (u) => {
            u.cardSecret = crypto.randomBytes(32).toString('hex');
            u.studentId = normalizeStudentId(u.studentId);
            if (u.email) u.email = normalizeEmail(u.email);
            u.password = await argon2.hash(u.password, argonOptions);
          })
        );
        await User.insertMany(newUsersToCreate, { ordered: false });
      }

      // Dispatch activation emails / SMS using bounded concurrent batching with backpressure
      if (notificationTasks.length > 0) {
        const dispatchResults = await dispatchWithBackpressure(
          notificationTasks,
          NOTIFICATION_CONCURRENCY,
          async (task) => {
            const {
              rowNumber,
              overallIndex,
              studentId: nStudentId,
              name: sName,
              email: sEmail,
              phone: sPhone,
              program: sProg,
              tempPassword: sPwd,
              rawToken: sToken,
            } = task;

            if (sEmail) {
              try {
                const activationLink = `${domain}/c/${college.slug}/activate?token=${sToken}`;
                await mailer.sendMail({
                  to: sEmail,
                  subject: `Welcome to ${college.name} BookBuddy Library`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                      <h2 style="color: #4f46e5;">Welcome to ${college.name} BookBuddy!</h2>
                      <p>Hello ${sName},</p>
                      <p>Your official student library account has been created by your institution.</p>
                      <p><strong>Temporary Password:</strong> <code style="background: #f3f4f6; padding: 2px 6px; font-weight: bold;">${sPwd}</code></p>
                      <p>Please activate your account and choose a new password using the button below:</p>
                      <p style="margin: 25px 0;">
                        <a href="${activationLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Activate My Account</a>
                      </p>
                      <p style="color: #6b7280; font-size: 12px;">Link valid for 48 hours. Student ID: ${nStudentId}</p>
                    </div>
                  `,
                });

                return {
                  rowResult: {
                    rowNumber: rowNumber || overallIndex + 2,
                    studentId: nStudentId,
                    name: sName,
                    email: sEmail,
                    action: 'created',
                    deliveryStatus: 'sent',
                    reason: 'Activation email and temporary credentials dispatched.',
                  },
                };
              } catch (mailErr) {
                return {
                  rowResult: {
                    rowNumber: rowNumber || overallIndex + 2,
                    studentId: nStudentId,
                    name: sName,
                    email: sEmail,
                    action: 'created',
                    deliveryStatus: 'bounced',
                    reason: `Email delivery failed: ${mailErr.message}`,
                  },
                  credentialSlip: {
                    studentId: nStudentId,
                    name: sName,
                    email: sEmail,
                    program: sProg,
                    tempPassword: sPwd,
                    deliveryChannel: 'bounced_email_fallback',
                  },
                };
              }
            } else if (sPhone && isTwilioConfigured()) {
              try {
                const smsResult = await sendCredentialSMS({
                  to: sPhone,
                  studentId: nStudentId,
                  tempPassword: sPwd,
                  name: sName,
                  collegeName: college.name,
                  collegeSlug: college.slug,
                });

                if (smsResult.success) {
                  return {
                    rowResult: {
                      rowNumber: rowNumber || overallIndex + 2,
                      studentId: nStudentId,
                      name: sName,
                      email: sPhone,
                      action: 'created',
                      deliveryStatus: 'sms_queued',
                      reason: 'Temporary credentials dispatched via Twilio SMS.',
                    },
                  };
                } else {
                  return {
                    rowResult: {
                      rowNumber: rowNumber || overallIndex + 2,
                      studentId: nStudentId,
                      name: sName,
                      email: sPhone,
                      action: 'created',
                      deliveryStatus: 'no_contact_info',
                      reason: `SMS delivery failed (${smsResult.error || 'provider error'}). Generated offline credential slip for handout.`,
                    },
                    credentialSlip: {
                      studentId: nStudentId,
                      name: sName,
                      email: sEmail,
                      program: sProg,
                      tempPassword: sPwd,
                      deliveryChannel: 'printed_handout',
                    },
                  };
                }
              } catch (smsErr) {
                return {
                  rowResult: {
                    rowNumber: rowNumber || overallIndex + 2,
                    studentId: nStudentId,
                    name: sName,
                    email: sPhone,
                    action: 'created',
                    deliveryStatus: 'no_contact_info',
                    reason: `SMS dispatch exception: ${smsErr.message}. Generated offline credential slip for handout.`,
                  },
                  credentialSlip: {
                    studentId: nStudentId,
                    name: sName,
                    email: sEmail,
                    program: sProg,
                    tempPassword: sPwd,
                    deliveryChannel: 'printed_handout',
                  },
                };
              }
            } else {
              // Missing email & phone fallback path -> Handout slip generated
              return {
                rowResult: {
                  rowNumber: rowNumber || overallIndex + 2,
                  studentId: nStudentId,
                  name: sName,
                  email: sPhone || '',
                  action: 'created',
                  deliveryStatus: 'no_contact_info',
                  reason:
                    sPhone && !isTwilioConfigured()
                      ? 'Twilio SMS unconfigured. Generated offline credential slip for handout.'
                      : 'No email address on file. Generated offline credential slip for handout.',
                },
                credentialSlip: {
                  studentId: nStudentId,
                  name: sName,
                  email: sEmail,
                  program: sProg,
                  tempPassword: sPwd,
                  deliveryChannel: 'printed_handout',
                },
              };
            }
          }
        );

        for (const res of dispatchResults) {
          if (res?.rowResult) rowResults.push(res.rowResult);
          if (res?.credentialSlip) credentialSlips.push(res.credentialSlip);
        }
      }

      // Track progress per chunk
      batch.processedRows = Math.min(c + chunk.length, validRows.length);
    }

    // Step 3: Non-destructive Bulk Deactivation for absent students in a single query
    if (bulkDeactivateAbsent) {
      const absentFilter = {
        collegeId: adminCollegeId,
        role: ROLES.STUDENT,
        status: { $in: ['active', 'invited'] },
        studentId: { $nin: Array.from(processedStudentIds) },
      };

      const deactivationResult = await User.updateMany(absentFilter, {
        $set: {
          status: 'inactive',
          deactivatedAt: new Date(),
          deactivationReason: `Omitted from roster upload batch #${batch._id}`,
        },
      });

      deactivatedCount = deactivationResult.modifiedCount || 0;
    }

    batch.status = 'committed';
    batch.createdCount = createdCount;
    batch.updatedCount = updatedCount;
    batch.deactivatedCount = deactivatedCount;
    batch.processedRows = validRows.length;
    batch.rowResults = rowResults;
    batch.credentialSlips = credentialSlips;
    batch.committedAt = new Date();
    await batch.save();

    logger.info(
      `[BULK UPLOAD INGESTION COMPLETE] Batch ${batch._id}: Created ${createdCount}, Updated ${updatedCount}, Deactivated ${deactivatedCount}`
    );
  } catch (err) {
    logger.error(`[BULK UPLOAD INGESTION FAILED] Batch ${batchId}: ${err.message}`);
    try {
      await StudentUploadBatch.findByIdAndUpdate(batchId, {
        status: 'failed',
        errorMessage: err.message,
      });
    } catch (saveErr) {
      logger.error(`Failed to update batch error status: ${saveErr.message}`);
    }
  }
}

/**
 * Step 2: NON-BLOCKING COMMIT ROSTER UPLOAD (POST /api/admin/students/upload/commit)
 * Initiates background ingestion job and returns HTTP 202 immediately.
 */
exports.commitRosterUpload = asyncHandler(async (req, res, next) => {
  const { batchId, validRows, bulkDeactivateAbsent } = req.body;

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

  if (batch.status === 'processing') {
    return next(new AppError('This upload batch is already being processed', 400));
  }

  if (!Array.isArray(validRows) || validRows.length === 0) {
    return next(new AppError('No valid rows provided for commit', 400));
  }

  batch.status = 'processing';
  batch.bulkDeactivateAbsent = Boolean(bulkDeactivateAbsent);
  await batch.save();

  // Kick off background job without awaiting
  setImmediate(() => {
    processRosterBatchAsync(
      batch._id,
      adminCollegeId,
      validRows,
      Boolean(bulkDeactivateAbsent),
      college
    );
  });

  res.status(202).json({
    success: true,
    message: 'Roster upload ingestion started in background.',
    batchId: batch._id,
    status: 'processing',
    totalRows: validRows.length,
  });
});

/**
 * GET /api/admin/students/upload/:batchId/status — Check ingestion progress
 */
exports.getBatchStatus = asyncHandler(async (req, res, next) => {
  const { batchId } = req.params;
  const adminCollegeId = req.user.collegeId;

  const batch = await StudentUploadBatch.findOne({
    _id: batchId,
    collegeId: adminCollegeId,
  }).select(
    'status totalRows validRowsCount processedRows createdCount updatedCount deactivatedCount committedAt errorMessage'
  );

  if (!batch) {
    return next(new AppError('Batch record not found', 404));
  }

  res.status(200).json({
    success: true,
    batch,
  });
});

/**
 * GET /api/admin/students/upload/:batchId/delivery-status — Detailed per-row delivery statuses
 */
exports.getBatchDeliveryStatus = asyncHandler(async (req, res, next) => {
  const { batchId } = req.params;
  const adminCollegeId = req.user.collegeId;

  const batch = await StudentUploadBatch.findOne({
    _id: batchId,
    collegeId: adminCollegeId,
  }).lean();

  if (!batch) {
    return next(new AppError('Batch record not found', 404));
  }

  let rowResults = batch.rowResults || [];

  if (batch.deactivatedCount > 0 && !rowResults.some((r) => r.action === 'deactivated')) {
    const deactivatedUsers = await User.find({
      collegeId: adminCollegeId,
      deactivationReason: `Omitted from roster upload batch #${batch._id}`,
    })
      .select('studentId name email')
      .lean();

    const deactivatedRows = deactivatedUsers.map((u) => ({
      rowNumber: null,
      studentId: u.studentId,
      name: u.name,
      email: u.email || '',
      action: 'deactivated',
      deliveryStatus: 'inactive',
      reason: 'Absent from new roster upload (marked inactive, account preserved).',
    }));
    rowResults = [...rowResults, ...deactivatedRows];
  }

  const deliverySummary = {
    totalProcessed: rowResults.length,
    created: batch.createdCount || 0,
    updated: batch.updatedCount || 0,
    deactivated: batch.deactivatedCount || 0,
    sent: rowResults.filter((r) => r.deliveryStatus === 'sent' || r.deliveryStatus === 'sms_queued')
      .length,
    sms_queued: rowResults.filter((r) => r.deliveryStatus === 'sms_queued').length,
    bounced: rowResults.filter((r) => r.deliveryStatus === 'bounced').length,
    no_contact_info: rowResults.filter((r) => r.deliveryStatus === 'no_contact_info').length,
    active_preserved: rowResults.filter((r) => r.deliveryStatus === 'active_preserved').length,
    inactive: rowResults.filter((r) => r.deliveryStatus === 'inactive').length,
    failed: rowResults.filter((r) => r.deliveryStatus === 'failed').length,
  };

  res.status(200).json({
    success: true,
    batchId: batch._id,
    status: batch.status,
    summary: deliverySummary,
    hasCredentialSlips: (batch.credentialSlips || []).length > 0,
    credentialSlipsCount: (batch.credentialSlips || []).length,
    rowResults,
  });
});

/**
 * GET /api/admin/students/upload/:batchId/handouts — Download offline credential slips CSV
 */
exports.downloadBatchHandouts = asyncHandler(async (req, res, next) => {
  const { batchId } = req.params;
  const adminCollegeId = req.user.collegeId;

  const batch = await StudentUploadBatch.findOne({
    _id: batchId,
    collegeId: adminCollegeId,
  }).lean();

  if (!batch) {
    return next(new AppError('Batch record not found', 404));
  }

  const slips = batch.credentialSlips || [];
  if (slips.length === 0) {
    return next(new AppError('No offline credential slips available for this batch', 404));
  }

  const exportData = slips.map((s) => ({
    'Student ID': sanitizeFormulaInjection(s.studentId),
    Name: sanitizeFormulaInjection(s.name),
    Program: sanitizeFormulaInjection(s.program || ''),
    'Temporary Password': sanitizeFormulaInjection(s.tempPassword),
    'Delivery Channel': s.deliveryChannel,
    Instructions: 'Change password upon first login at institution library portal.',
  }));

  const worksheet = xlsx.utils.json_to_sheet(exportData);
  const csvBuffer = xlsx.utils.sheet_to_csv(worksheet);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=credential_handouts_${batchId}.csv`);
  res.status(200).send(csvBuffer);
});

/**
 * GET /api/admin/students/export — Export College Roster with Formula Injection Sanitization
 */
exports.exportRoster = asyncHandler(async (req, res) => {
  const adminCollegeId = req.user.collegeId;
  const students = await User.find({ collegeId: adminCollegeId, role: 'student' }).lean();

  const exportData = students.map((s) => ({
    'Student ID': sanitizeFormulaInjection(s.studentId),
    Name: sanitizeFormulaInjection(s.name),
    Email: sanitizeFormulaInjection(s.email || ''),
    Program: sanitizeFormulaInjection(s.program || ''),
    Year: sanitizeFormulaInjection(s.year || ''),
    Status: s.status,
    'Deactivated At': s.deactivatedAt ? new Date(s.deactivatedAt).toISOString() : '',
    'Deactivation Reason': s.deactivationReason || '',
    'Uploaded At': s.uploadedAt ? new Date(s.uploadedAt).toISOString() : '',
  }));

  const worksheet = xlsx.utils.json_to_sheet(exportData);
  const csvBuffer = xlsx.utils.sheet_to_csv(worksheet);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=roster_export_${Date.now()}.csv`);
  res.status(200).send(csvBuffer);
});

exports.processRosterBatchAsync = processRosterBatchAsync;
exports.dispatchWithBackpressure = dispatchWithBackpressure;
