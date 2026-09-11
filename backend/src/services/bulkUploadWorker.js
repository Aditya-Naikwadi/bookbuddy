const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const UploadJob = require('../models/UploadJob');
const UploadAuditLog = require('../models/UploadAuditLog');
const User = require('../models/User');
const College = require('../models/College');
const logger = require('../utils/logger');
const { sendEmail } = require('./notificationService');
const { isTwilioConfigured, sendCredentialSMS } = require('./smsService');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IN_MEMORY_ERRORS = 100;

/**
 * Generates a high-entropy cryptographically secure random temporary password.
 * Guarantees uppercase, lowercase, digit, and special character.
 */
const generateSecureTempPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;

  const required = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    special[crypto.randomInt(0, special.length)],
  ];

  const remaining = [];
  for (let i = 0; i < 8; i++) {
    remaining.push(all[crypto.randomInt(0, all.length)]);
  }

  const combined = [...required, ...remaining];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join('');
};

const pushErrorDetail = (job, errorObj) => {
  if (job.errorDetails.length < MAX_IN_MEMORY_ERRORS) {
    job.errorDetails.push(errorObj);
  }
};

/**
 * Emits real-time Socket.io progress event to per-job room.
 */
const emitProgressEvent = (jobId, data) => {
  try {
    const { getIO } = require('../sockets');
    const io = getIO();
    if (io) {
      io.to(`job:${jobId}`).emit('upload:progress', data);
    }
  } catch {
    // Ignore socket error if Socket.io is not initialized in test/standalone env
  }
};

const { Readable } = require('stream');
const os = require('os');

/**
 * Stream-parse CSV file or memory Buffer and returns array of row objects.
 */
const streamParseCsv = async (fileSource) => {
  const fileStream = Buffer.isBuffer(fileSource)
    ? Readable.from(fileSource)
    : fs.createReadStream(fileSource);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const rows = [];
  let headers = null;
  let lineCount = 0;

  for await (const line of rl) {
    lineCount++;
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const values = trimmedLine.split(',').map((v) => v.replace(/^["']|["']$/g, '').trim());

    if (!headers) {
      headers = values.map((h) => h.toLowerCase());
      continue;
    }

    const rowObj = {};
    headers.forEach((header, index) => {
      rowObj[header] = values[index] !== undefined ? values[index] : '';
    });
    rowObj._rowIndex = lineCount;
    rows.push(rowObj);
  }

  return rows;
};

/**
 * Writes downloadable error report CSV file. Uses serverless-safe os.tmpdir().
 */
const writeErrorReportCsv = async (jobId, errorDetails) => {
  try {
    const reportsDir = path.join(os.tmpdir(), 'bookbuddy_reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = path.join(reportsDir, `error_report_${jobId}.csv`);
    let csvContent = 'Row,Student ID,Email,Error Reason\n';

    for (const err of errorDetails) {
      const escapedReason = `"${(err.reason || '').replace(/"/g, '""')}"`;
      csvContent += `${err.row},${err.studentId || ''},${err.email || ''},${escapedReason}\n`;
    }

    await fs.promises.writeFile(reportPath, csvContent, 'utf8');
    return `/uploads/reports/error_report_${jobId}.csv`;
  } catch (err) {
    logger.error(`Failed to write error report CSV for job ${jobId}: ${err.message}`);
    return null;
  }
};

/**
 * Main async worker process for processing bulk student ingestion.
 */
const processBulkUploadJob = async (jobId, fileSource) => {
  let job;
  try {
    job = await UploadJob.findOne({ jobId });
    if (!job) {
      logger.error(`Bulk upload job not found: ${jobId}`);
      return;
    }

    job.status = 'processing';
    await job.save();

    emitProgressEvent(jobId, { status: 'processing', progress: 0 });

    const rows = await streamParseCsv(fileSource);
    job.totalRows = rows.length;
    await job.save();

    if (rows.length === 0) {
      job.status = 'completed';
      job.completedAt = new Date();
      await job.save();
      emitProgressEvent(jobId, { status: 'completed', progress: 100 });
      return;
    }

    const college = await College.findById(job.collegeId).select('name slug domain').lean();
    const collegeSlug = college?.slug || '';

    // Track seen entries within the uploaded file
    const seenStudentIds = new Set();
    const seenEmails = new Set();

    const emailsToDispatch = [];
    const smsToDispatch = [];
    const credentialSlips = [];

    const deliverySummary = {
      emailed: 0,
      sms: 0,
      handout: 0,
    };

    const CHUNK_SIZE = 250;

    for (let batchStart = 0; batchStart < rows.length; batchStart += CHUNK_SIZE) {
      const batchRows = rows.slice(batchStart, batchStart + CHUNK_SIZE);

      const batchCandidateStudentIds = batchRows
        .map((r) => (r.studentid || r['student id'] || r.id || '').trim().toLowerCase())
        .filter(Boolean);

      // Query existing users in DB matching candidate studentIds for this college
      const existingBatchUsers = await User.find({
        collegeId: job.collegeId,
        studentId: { $in: batchCandidateStudentIds },
      });

      const existingUserMap = new Map();
      for (const u of existingBatchUsers) {
        if (u.studentId) existingUserMap.set(u.studentId.toLowerCase(), u);
      }

      for (let i = 0; i < batchRows.length; i++) {
        const row = batchRows[i];
        const globalRowIndex = batchStart + i;
        const rowIndex = row._rowIndex || globalRowIndex + 2;
        const name = (row.name || row['full name'] || row['student name'] || '').trim();
        const rawStudentId = (row.studentid || row['student id'] || row.id || '').trim();
        const normalizedStudentId = rawStudentId.toLowerCase();
        const rawEmail = (row.email || '').trim();
        const email = rawEmail.toLowerCase();
        const department = (row.department || row.major || '').trim();
        const year = (row.year || '').trim();
        const program = (row.program || '').trim();
        const phone = (row.phone || row.mobile || row.contact || '').trim();

        // Validation 1: Name and Student ID are strictly required
        if (!name || !rawStudentId) {
          job.failedRows += 1;
          pushErrorDetail(job, {
            row: rowIndex,
            studentId: rawStudentId,
            email,
            reason: 'Missing required field (name or studentId).',
          });
          job.processedRows += 1;
          continue;
        }

        // Validation 2: If email is provided, validate email format
        if (email && !emailRegex.test(email)) {
          job.failedRows += 1;
          pushErrorDetail(job, {
            row: rowIndex,
            studentId: rawStudentId,
            email,
            reason: 'Invalid email address format.',
          });
          job.processedRows += 1;
          continue;
        }

        // Validation 3: Duplicate within file
        if (seenStudentIds.has(normalizedStudentId) || (email && seenEmails.has(email))) {
          job.failedRows += 1;
          pushErrorDetail(job, {
            row: rowIndex,
            studentId: rawStudentId,
            email,
            reason: 'Duplicate studentId or email within uploaded file.',
          });
          job.processedRows += 1;
          continue;
        }

        seenStudentIds.add(normalizedStudentId);
        if (email) seenEmails.add(email);

        const tempPassword = generateSecureTempPassword();
        const invitationToken = crypto.randomBytes(32).toString('hex');

        // Check if student already exists for this tenant
        if (existingUserMap.has(normalizedStudentId)) {
          // --- RE-UPLOAD UPSERT: UPDATE DON'T DUPLICATE ---
          const existingUser = existingUserMap.get(normalizedStudentId);

          existingUser.name = name;
          if (department) {
            existingUser.department = department;
            existingUser.major = department;
          }
          if (year) existingUser.year = year;
          if (program) existingUser.program = program;
          if (phone) existingUser.phone = phone;

          // If student now provided an email and didn't have one before
          if (email && !existingUser.email) {
            existingUser.email = email;
          }

          // Security preservation:
          // Do NOT overwrite password or reset mustChangePasswordOnNextLogin if already activated
          const isActivated =
            existingUser.status === 'active' ||
            existingUser.mustChangePasswordOnNextLogin === false;

          if (!isActivated) {
            // Student is still in invited status: update temp password and refresh invitation
            existingUser.password = tempPassword;
            existingUser.mustChangePasswordOnNextLogin = true;
            existingUser.invitationToken = invitationToken;

            // Delivery determination
            if (existingUser.email) {
              deliverySummary.emailed += 1;
              emailsToDispatch.push({
                name,
                email: existingUser.email,
                studentId: rawStudentId,
                tempPassword,
                invitationToken,
                collegeSlug,
              });
            } else if (phone) {
              deliverySummary.sms += 1;
              if (isTwilioConfigured()) {
                smsToDispatch.push({
                  name,
                  phone,
                  studentId: rawStudentId,
                  tempPassword,
                  collegeSlug,
                });
              }
              credentialSlips.push({
                studentId: rawStudentId,
                name,
                department,
                phone,
                tempPassword,
                deliveryChannel: 'sms',
              });
            } else {
              deliverySummary.handout += 1;
              credentialSlips.push({
                studentId: rawStudentId,
                name,
                department,
                phone,
                tempPassword,
                deliveryChannel: 'handout',
              });
            }
          }

          await existingUser.save();
          job.updatedRows += 1;
          job.succeededRows += 1;
        } else {
          // --- NEW STUDENT CREATION ---
          // Check if email already exists for another student in this college
          if (email) {
            const emailInUse = await User.findOne({
              collegeId: job.collegeId,
              email,
              studentId: { $ne: normalizedStudentId },
            }).lean();

            if (emailInUse) {
              job.failedRows += 1;
              pushErrorDetail(job, {
                row: rowIndex,
                studentId: rawStudentId,
                email,
                reason: 'Email is already registered to another student in this institution.',
              });
              job.processedRows += 1;
              continue;
            }
          }

          const newUserDoc = {
            collegeId: job.collegeId,
            name,
            studentId: normalizedStudentId,
            password: tempPassword,
            role: 'student',
            status: 'invited',
            invitedVia: 'bulk_upload',
            invitationToken,
            isEmailVerified: !!email,
            membershipStatus: 'active',
            mustChangePasswordOnNextLogin: true,
          };
          if (email) newUserDoc.email = email;
          if (department) {
            newUserDoc.department = department;
            newUserDoc.major = department;
          }
          if (year) newUserDoc.year = year;
          if (program) newUserDoc.program = program;
          if (phone) newUserDoc.phone = phone;

          await User.create(newUserDoc);
          job.insertedRows += 1;
          job.succeededRows += 1;

          // Delivery channel tracking
          if (email) {
            deliverySummary.emailed += 1;
            emailsToDispatch.push({
              name,
              email,
              studentId: rawStudentId,
              tempPassword,
              invitationToken,
              collegeSlug,
            });
          } else if (phone) {
            deliverySummary.sms += 1;
            if (isTwilioConfigured()) {
              smsToDispatch.push({
                name,
                phone,
                studentId: rawStudentId,
                tempPassword,
                collegeSlug,
              });
            }
            credentialSlips.push({
              studentId: rawStudentId,
              name,
              department,
              phone,
              tempPassword,
              deliveryChannel: 'sms',
            });
          } else {
            deliverySummary.handout += 1;
            credentialSlips.push({
              studentId: rawStudentId,
              name,
              department,
              phone,
              tempPassword,
              deliveryChannel: 'handout',
            });
          }
        }

        job.processedRows += 1;
        job.lastCheckpointRow = globalRowIndex + 1;
      }

      job.deliverySummary = deliverySummary;
      job.credentialSlips = credentialSlips;
      await job.save();

      const progressPct = Math.round((job.processedRows / job.totalRows) * 100);
      emitProgressEvent(jobId, {
        status: 'processing',
        processedRows: job.processedRows,
        totalRows: job.totalRows,
        succeededRows: job.succeededRows,
        insertedRows: job.insertedRows,
        updatedRows: job.updatedRows,
        failedRows: job.failedRows,
        progress: progressPct,
      });
    }

    // Write error report CSV if any failures occurred
    if (job.failedRows > 0) {
      const reportUrl = await writeErrorReportCsv(jobId, job.errorDetails);
      job.errorReportUrl = reportUrl;
    }

    // --- VERSIONED UPLOAD AUDIT LOG CREATION ---
    let version = 1;
    try {
      const latestAudit = await UploadAuditLog.findOne({ collegeId: job.collegeId })
        .sort({ version: -1 })
        .select('version')
        .lean();
      if (latestAudit && typeof latestAudit.version === 'number') {
        version = latestAudit.version + 1;
      }

      let uploaderInfo = { userId: job.createdBy };
      const uploader = await User.findById(job.createdBy).select('name email role').lean();
      if (uploader) {
        uploaderInfo = {
          userId: uploader._id,
          name: uploader.name,
          email: uploader.email,
          role: uploader.role,
        };
      }

      await UploadAuditLog.create({
        collegeId: job.collegeId,
        jobId,
        version,
        uploadedBy: uploaderInfo,
        fileName: job.fileName || 'students.csv',
        fileSizeBytes: job.fileSizeBytes || 0,
        totalRows: job.totalRows,
        insertedRows: job.insertedRows,
        updatedRows: job.updatedRows,
        failedRows: job.failedRows,
        deliverySummary: job.deliverySummary,
        errorDetails: job.errorDetails,
        credentialSlips: job.credentialSlips,
        completedAt: new Date(),
      });

      job.auditLogVersion = version;
    } catch (auditErr) {
      logger.error(
        `Failed to create versioned UploadAuditLog for job ${jobId}: ${auditErr.message}`
      );
    }

    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();

    emitProgressEvent(jobId, {
      status: 'completed',
      processedRows: job.processedRows,
      succeededRows: job.succeededRows,
      insertedRows: job.insertedRows,
      updatedRows: job.updatedRows,
      failedRows: job.failedRows,
      deliverySummary: job.deliverySummary,
      version: job.auditLogVersion,
      errorReportUrl: job.errorReportUrl,
      progress: 100,
    });

    // Enqueue welcome emails asynchronously with login credentials and portal URL
    setImmediate(async () => {
      for (const u of emailsToDispatch) {
        try {
          const portalLink = u.collegeSlug ? `/c/${u.collegeSlug}` : '/login';
          const emailBody = [
            `Hello ${u.name},`,
            `Welcome to BookBuddy! Your student account for your institution has been provisioned.`,
            `Student ID: ${u.studentId}`,
            `Temporary Password: ${u.tempPassword}`,
            `Access your institution portal here: ${portalLink}`,
            `Please note: You will be required to set your own permanent password upon your first login.`,
          ].join('\n\n');

          await sendEmail(null, u.email, 'bulk_student_invitation', emailBody);
        } catch {
          // ignore email notification error
        }
      }
    });

    // Enqueue welcome SMS asynchronously for phone-only students via Twilio
    if (smsToDispatch.length > 0) {
      setImmediate(async () => {
        for (const s of smsToDispatch) {
          try {
            await sendCredentialSMS({
              to: s.phone,
              studentId: s.studentId,
              tempPassword: s.tempPassword,
              name: s.name,
              collegeSlug: s.collegeSlug,
            });
          } catch {
            // ignore sms notification error
          }
        }
      });
    }

    // Clean up uploaded raw file if it was saved on disk
    if (typeof fileSource === 'string' && fs.existsSync(fileSource)) {
      fs.promises.unlink(fileSource).catch(() => {});
    }
  } catch (error) {
    logger.error(`Error processing bulk upload job ${jobId}: ${error.message}`);
    if (job) {
      job.status = 'failed';
      await job.save();
      emitProgressEvent(jobId, { status: 'failed', error: error.message });
    }
  }
};

module.exports = {
  processBulkUploadJob,
  generateSecureTempPassword,
};
