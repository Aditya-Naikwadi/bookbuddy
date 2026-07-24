const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const UploadJob = require('../models/UploadJob');
const User = require('../models/User');
const logger = require('../utils/logger');
const { sendEmail } = require('./notificationService');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  } catch (err) {
    // Ignore socket error if Socket.io is not initialized in test/standalone env
  }
};

/**
 * Stream-parse CSV file and returns array of row objects.
 */
const streamParseCsv = async (filePath) => {
  const fileStream = fs.createReadStream(filePath);
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
 * Writes downloadable error report CSV file.
 */
const writeErrorReportCsv = async (jobId, errorDetails) => {
  try {
    const reportsDir = path.join(__dirname, '../../uploads/reports');
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
const processBulkUploadJob = async (jobId, filePath) => {
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

    const rows = await streamParseCsv(filePath);
    job.totalRows = rows.length;
    await job.save();

    if (rows.length === 0) {
      job.status = 'completed';
      job.completedAt = new Date();
      await job.save();
      emitProgressEvent(jobId, { status: 'completed', progress: 100 });
      return;
    }

    // Default pre-hashed temp password for invited students
    const tempSalt = await bcrypt.genSalt(10);
    const defaultPasswordHash = await bcrypt.hash('Welcome123!', tempSalt);

    // Track duplicates across file
    const seenStudentIds = new Set();
    const seenEmails = new Set();

    // Query existing DB records for this college
    const existingUsers = await User.find({ collegeId: job.collegeId })
      .select('studentId email')
      .lean();
    const dbStudentIds = new Set(existingUsers.map((u) => u.studentId));
    const dbEmails = new Set(existingUsers.map((u) => u.email));

    const CHUNK_SIZE = 500;
    let chunk = [];
    const createdUsersForEmails = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = row._rowIndex || i + 2;
      const name = row.name || row['full name'] || row['student name'] || '';
      const email = (row.email || '').toLowerCase().trim();
      const studentId = (row.studentid || row['student id'] || row.id || '').trim();
      const department = row.department || row.major || '';

      // Validation 1: Required fields
      if (!name || !email || !studentId) {
        job.failedRows += 1;
        job.errorDetails.push({
          row: rowIndex,
          studentId,
          email,
          reason: 'Missing required field (name, email, or studentId).',
        });
        job.processedRows += 1;
        continue;
      }

      // Validation 2: Email format
      if (!emailRegex.test(email)) {
        job.failedRows += 1;
        job.errorDetails.push({
          row: rowIndex,
          studentId,
          email,
          reason: 'Invalid email address format.',
        });
        job.processedRows += 1;
        continue;
      }

      // Validation 3: Duplicate within file
      if (seenStudentIds.has(studentId) || seenEmails.has(email)) {
        job.failedRows += 1;
        job.errorDetails.push({
          row: rowIndex,
          studentId,
          email,
          reason: 'Duplicate studentId or email within uploaded file.',
        });
        job.processedRows += 1;
        continue;
      }

      // Validation 4: Duplicate in DB
      if (dbStudentIds.has(studentId) || dbEmails.has(email)) {
        job.failedRows += 1;
        job.errorDetails.push({
          row: rowIndex,
          studentId,
          email,
          reason: 'Student ID or email already registered for this institution.',
        });
        job.processedRows += 1;
        continue;
      }

      seenStudentIds.add(studentId);
      seenEmails.add(email);

      const invitationToken = crypto.randomBytes(32).toString('hex');
      const newUserDoc = {
        collegeId: job.collegeId,
        name,
        email,
        studentId,
        major: department,
        password: defaultPasswordHash,
        role: 'student',
        status: 'invited',
        invitedVia: 'bulk_upload',
        invitationToken,
        isEmailVerified: true,
        membershipStatus: 'active',
      };

      chunk.push(newUserDoc);
      createdUsersForEmails.push({ name, email, invitationToken });

      // Write chunk if chunk size met or at end of file
      if (chunk.length >= CHUNK_SIZE || i === rows.length - 1) {
        if (chunk.length > 0) {
          try {
            const inserted = await User.insertMany(chunk, { ordered: false });
            job.succeededRows += inserted.length;
          } catch (insertErr) {
            if (insertErr.insertedDocs) {
              job.succeededRows += insertErr.insertedDocs.length;
            }
            if (insertErr.writeErrors) {
              for (const we of insertErr.writeErrors) {
                job.failedRows += 1;
                job.errorDetails.push({
                  row: rowIndex,
                  studentId: we.err?.op?.studentId || '',
                  email: we.err?.op?.email || '',
                  reason: `Database constraint error: ${we.errmsg || 'Duplicate key'}`,
                });
              }
            }
          }
          chunk = [];
        }

        job.processedRows = i + 1;
        job.lastCheckpointRow = i + 1;
        await job.save();

        const progressPct = Math.round((job.processedRows / job.totalRows) * 100);
        emitProgressEvent(jobId, {
          status: 'processing',
          processedRows: job.processedRows,
          totalRows: job.totalRows,
          succeededRows: job.succeededRows,
          failedRows: job.failedRows,
          progress: progressPct,
        });
      }
    }

    // Flush any remaining items in chunk after loop ends
    if (chunk.length > 0) {
      try {
        const inserted = await User.insertMany(chunk, { ordered: false });
        job.succeededRows += inserted.length;
      } catch (insertErr) {
        if (insertErr.insertedDocs) {
          job.succeededRows += insertErr.insertedDocs.length;
        }
      }
      chunk = [];
    }

    // Write error report CSV if any failures occurred
    if (job.failedRows > 0) {
      const reportUrl = await writeErrorReportCsv(jobId, job.errorDetails);
      job.errorReportUrl = reportUrl;
    }

    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();

    emitProgressEvent(jobId, {
      status: 'completed',
      processedRows: job.processedRows,
      succeededRows: job.succeededRows,
      failedRows: job.failedRows,
      errorReportUrl: job.errorReportUrl,
      progress: 100,
    });

    // Enqueue invitation email dispatch asynchronously
    setImmediate(async () => {
      for (const u of createdUsersForEmails) {
        try {
          await sendEmail(
            null,
            u.email,
            'bulk_student_invitation',
            `Hello ${u.name}, welcome to BookBuddy! Your account has been provisioned. Log in or complete setup with token: ${u.invitationToken}`
          );
        } catch {
          // ignore email notification error
        }
      }
    });

    // Clean up uploaded raw file
    if (fs.existsSync(filePath)) {
      fs.promises.unlink(filePath).catch(() => {});
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
};
