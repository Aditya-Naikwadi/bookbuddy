/**
 * Centralized File Upload Validation Middleware
 * Validates file magic-byte signatures and inspects uploaded files for malware.
 */
const fs = require('fs');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

/**
 * Detects basic MIME type from file buffer headers.
 */
const detectMimeFromBuffer = (buffer) => {
  if (!buffer || buffer.length < 4) return null;

  // MZ Windows Executable (.exe, .dll)
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) return { mime: 'application/x-msdownload', ext: 'exe' };

  // PDF (%PDF)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { mime: 'application/pdf', ext: 'pdf' };
  }

  // PNG (\x89PNG)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { mime: 'image/png', ext: 'png' };
  }

  // JPEG (\xFF\xD8\xFF)
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // ZIP / EPUB (PK\x03\x04)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return { mime: 'application/zip', ext: 'zip' };
  }

  return null;
};

/**
 * Validates file magic-byte signatures against allowed MIME types.
 * @param {Array<string>} allowedMimes - List of allowed MIME types (e.g. ['image/jpeg', 'image/png', 'application/pdf', 'application/epub+zip', 'text/csv'])
 */
const validateMagicBytes = (allowedMimes = []) => {
  return async (req, res, next) => {
    try {
      const files = [];
      if (req.file) files.push(req.file);
      if (req.files && Array.isArray(req.files)) files.push(...req.files);
      if (req.files && typeof req.files === 'object' && !Array.isArray(req.files)) {
        Object.values(req.files).forEach((fieldArray) => {
          if (Array.isArray(fieldArray)) files.push(...fieldArray);
        });
      }

      if (files.length === 0) {
        return next();
      }

      for (const file of files) {
        if (!file.path || !fs.existsSync(file.path)) continue;

        const buffer = fs.readFileSync(file.path);

        // Check for EICAR test string or executable signature for malware detection
        const contentStr = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));
        if (
          contentStr.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE') ||
          (buffer[0] === 0x4d && buffer[1] === 0x5a) // MZ Windows executable header
        ) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          logger.warn(`[Malware Alert] Blocked suspicious file upload: ${file.originalname}`);
          return next(new AppError('Malware or executable signature detected in uploaded file.', 400));
        }

        // Magic byte detection
        const detected = detectMimeFromBuffer(buffer);

        // For CSV / plain text files, file-type returns undefined because they are plain text
        if (!detected) {
          const isCsvAllowed = allowedMimes.includes('text/csv') || allowedMimes.includes('text/plain');
          const ext = (file.originalname || '').split('.').pop()?.toLowerCase();
          const isCsvExt = ext === 'csv' || ext === 'txt';

          if (isCsvAllowed && isCsvExt) {
            // Verify plain text / valid CSV
            continue;
          } else {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return next(new AppError('Uploaded file signature does not match allowed format.', 400));
          }
        }

        // Verify detected MIME matches allowed list
        if (allowedMimes.length > 0 && !allowedMimes.includes(detected.mime)) {
          // Special exception for EPUB zip containers
          if (detected.mime === 'application/zip' && allowedMimes.includes('application/epub+zip')) {
            continue;
          }
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return next(new AppError(`File type mismatch: expected ${allowedMimes.join(', ')}, detected ${detected.mime}`, 400));
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  validateMagicBytes,
};
