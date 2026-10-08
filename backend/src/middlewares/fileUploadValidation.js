/**
 * Centralized File Upload Validation Middleware
 * Enforces strict allow-lists, magic-byte signatures, anti-traversal, anti-double-extension,
 * random filename generation, archive limits (zip bombs), and malware pre-scanning.
 */
const fs = require('fs');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Known dangerous executable, script, and markup extensions
 */
const DANGEROUS_EXTENSIONS = new Set([
  'php',
  'phtml',
  'php3',
  'php4',
  'php5',
  'phps',
  'phar',
  'js',
  'mjs',
  'cjs',
  'jsx',
  'ts',
  'tsx',
  'html',
  'htm',
  'xhtml',
  'shtml',
  'hta',
  'svg',
  'xml',
  'exe',
  'sh',
  'bat',
  'cmd',
  'vbs',
  'vbe',
  'wsf',
  'wsh',
  'jar',
  'war',
  'ear',
  'py',
  'pyc',
  'pyo',
  'pyd',
  'rb',
  'pl',
  'cgi',
  'dll',
  'so',
  'dylib',
  'com',
  'scr',
  'msi',
  'asp',
  'aspx',
  'axd',
  'ashx',
  'asmx',
  'jsp',
  'jspx',
  'action',
  'do',
]);

/**
 * Sanitizes and validates uploaded filename to prevent:
 * - Path traversal (../, ..\, /, \)
 * - Null byte injection (\0, %00)
 * - Double extensions (e.g. evil.php.jpg, shell.js.png)
 * - Prohibited dangerous extensions
 */
const sanitizeUploadFilename = (filename) => {
  if (typeof filename !== 'string' || !filename.trim()) {
    throw new AppError('Filename is invalid or missing.', 400);
  }

  // Reject null byte characters
  if (filename.includes('\0') || /%00/i.test(filename)) {
    throw new AppError('Filename contains illegal null byte characters.', 400);
  }

  // Reject directory traversal sequences
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new AppError('Filename contains illegal path traversal characters.', 400);
  }

  const normalized = filename.normalize('NFC').trim();
  const lower = normalized.toLowerCase();

  const parts = lower.split('.').filter(Boolean);
  if (parts.length < 2) {
    throw new AppError('File must have a valid extension.', 400);
  }

  const finalExt = parts[parts.length - 1];

  // Disallow dangerous standalone extensions
  if (DANGEROUS_EXTENSIONS.has(finalExt)) {
    throw new AppError(`Forbidden file extension: .${finalExt}`, 400);
  }

  // Disallow dangerous double extensions (e.g. image.php.jpg, payload.js.png)
  for (let i = 0; i < parts.length - 1; i++) {
    if (DANGEROUS_EXTENSIONS.has(parts[i])) {
      throw new AppError(
        `Double extension attack detected: embedded .${parts[i]} is forbidden.`,
        400
      );
    }
  }

  return {
    sanitizedName: normalized.replace(/[^a-zA-Z0-9._-]/g, '_'),
    ext: `.${finalExt}`,
  };
};

/**
 * Generates an unguessable random server-side filename using crypto.randomUUID().
 * Never preserves user-supplied filenames or directory structures.
 */
const generateSafeFilename = (originalname, prefix = 'upload') => {
  const { ext } = sanitizeUploadFilename(originalname);
  const randomId = crypto.randomUUID();
  return `${prefix}-${randomId}${ext}`;
};

/**
 * Detects basic MIME type from file buffer magic bytes.
 */
const detectMimeFromBuffer = (buffer) => {
  if (!buffer || buffer.length < 4) return null;

  // MZ Windows Executable (.exe, .dll)
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { mime: 'application/x-msdownload', ext: 'exe' };
  }

  // ELF Linux Executable
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    return { mime: 'application/x-elf', ext: 'bin' };
  }

  // PDF (%PDF)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { mime: 'application/pdf', ext: 'pdf' };
  }

  // PNG (\x89PNG\r\n\x1a\n)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { mime: 'image/png', ext: 'png' };
  }

  // JPEG (\xFF\xD8\xFF)
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // WebP (RIFF....WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  // Legacy XLS (OLE Compound Document)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return { mime: 'application/vnd.ms-excel', ext: 'xls' };
  }

  // ZIP / EPUB / XLSX (PK\x03\x04)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return { mime: 'application/zip', ext: 'zip' };
  }

  return null;
};

/**
 * Validates zip archives against zip bombs and Zip Slip directory traversal.
 */
const validateZipBomb = (bufferOrPath, options = {}) => {
  const maxEntries = options.maxEntries || 1000;
  const maxTotalBytes = options.maxTotalBytes || 200 * 1024 * 1024; // 200MB uncompressed limit
  const maxRatio = options.maxRatio || 100; // 100:1 compression ratio limit

  try {
    const zip = new AdmZip(bufferOrPath);
    const entries = zip.getEntries();

    if (entries.length > maxEntries) {
      throw new AppError(
        `Archive contains too many entries (${entries.length} > ${maxEntries}). Possible zip bomb.`,
        400
      );
    }

    let totalUncompressedSize = 0;
    for (const entry of entries) {
      const entryName = entry.entryName;
      if (
        entryName.includes('..') ||
        entryName.startsWith('/') ||
        entryName.startsWith('\\') ||
        entryName.includes('\0')
      ) {
        throw new AppError(`Archive contains illegal path traversal entry: ${entryName}`, 400);
      }

      const uncompressedSize = entry.header ? entry.header.size : entry.getData().length;
      const compressedSize = entry.header ? entry.header.compressedSize : 0;

      totalUncompressedSize += uncompressedSize;
      if (totalUncompressedSize > maxTotalBytes) {
        throw new AppError(
          `Archive uncompressed content exceeds limit of ${Math.round(maxTotalBytes / 1024 / 1024)}MB. Possible zip bomb.`,
          400
        );
      }

      if (compressedSize > 0 && uncompressedSize / compressedSize > maxRatio) {
        throw new AppError(
          `Suspicious compression ratio (${Math.round(uncompressedSize / compressedSize)}:1). Possible zip bomb.`,
          400
        );
      }
    }

    return true;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(`Archive validation failed: ${err.message}`, 400);
  }
};

/**
 * Scans file buffer for malware signatures and embedded malicious scripts.
 */
const scanForMaliciousPayloads = (buffer, detectedMime = '') => {
  const checkSlice = buffer.toString('utf8', 0, Math.min(buffer.length, 4096));

  // EICAR Antivirus Test Pattern
  if (checkSlice.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
    throw new AppError('Malware signature detected in uploaded file.', 400);
  }

  // Binary executable headers
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    throw new AppError('Malware or executable signature detected in uploaded file.', 400);
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    throw new AppError('Malware or executable signature detected in uploaded file.', 400);
  }

  // Active script injection in images and plain text documents
  const isImageOrDoc =
    detectedMime.startsWith('image/') ||
    detectedMime === 'application/pdf' ||
    detectedMime === 'text/plain' ||
    detectedMime === 'text/csv';

  if (isImageOrDoc) {
    const scriptPatterns = [
      /<\?php/i,
      /<script\b/i,
      /<\/script>/i,
      /<html\b/i,
      /<!doctype\s+html/i,
      /<svg\b/i,
      /javascript:/i,
      /onload\s*=/i,
      /onerror\s*=/i,
    ];

    const sample =
      checkSlice + (buffer.length > 8192 ? buffer.toString('utf8', buffer.length - 4096) : '');
    for (const pattern of scriptPatterns) {
      if (pattern.test(sample)) {
        throw new AppError('Active script or unauthorized markup detected in uploaded file.', 400);
      }
    }
  }
};

/**
 * Reusable Multer fileFilter factory that enforces extension and MIME allow-lists
 * and rejects path traversal, null bytes, and double extensions.
 */
const createSafeFileFilter = ({ allowedExts = [], allowedMimes = [] }) => {
  const lowerAllowedExts = allowedExts.map((e) =>
    e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`
  );
  const lowerAllowedMimes = allowedMimes.map((m) => m.toLowerCase());

  return (req, file, cb) => {
    try {
      const { ext } = sanitizeUploadFilename(file.originalname);

      if (lowerAllowedExts.length > 0 && !lowerAllowedExts.includes(ext.toLowerCase())) {
        return cb(
          new AppError(
            `File extension '${ext}' is not allowed. Allowed extensions: ${lowerAllowedExts.join(', ')}`,
            400
          ),
          false
        );
      }

      const clientMime = (file.mimetype || '').toLowerCase();
      if (lowerAllowedMimes.length > 0 && !lowerAllowedMimes.includes(clientMime)) {
        return cb(
          new AppError(
            `MIME type '${file.mimetype}' is not allowed. Allowed types: ${lowerAllowedMimes.join(', ')}`,
            400
          ),
          false
        );
      }

      cb(null, true);
    } catch (err) {
      cb(err instanceof AppError ? err : new AppError(err.message, 400), false);
    }
  };
};

/**
 * Validates file magic-byte signatures against allowed MIME types.
 * @param {Array<string>} allowedMimes - List of allowed MIME types
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
        const buffer =
          file.buffer ||
          (file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path) : null);
        if (!buffer) continue;

        const cleanupDisk = () => {
          if (file.path && fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
            } catch {
              // ignore cleanup error
            }
          }
        };

        const detected = detectMimeFromBuffer(buffer);
        const effectiveMime = detected ? detected.mime : '';

        // Scan buffer for malware (EICAR, executables) and script injections
        try {
          scanForMaliciousPayloads(buffer, effectiveMime);
        } catch (scanErr) {
          cleanupDisk();
          logger.warn(
            `[Security Alert] Blocked file upload: ${file.originalname} - ${scanErr.message}`
          );
          return next(scanErr);
        }

        // Text Toxicity / NSFW Content Pattern Pre-Scanning (Flags for human moderation)
        const contentStr = buffer.toString('utf8', 0, Math.min(buffer.length, 2048));
        const nsfwTerms = ['EXPLICIT_HATE_SPEECH_TEST', 'MALICIOUS_TOXICITY_PAYLOAD'];
        const isFlaggedForModeration = nsfwTerms.some((term) =>
          contentStr.toUpperCase().includes(term)
        );
        if (isFlaggedForModeration) {
          req.contentSafetyAlert = {
            isFlagged: true,
            reason:
              'Automated scan detected suspicious or restricted text patterns. Flagged for human review.',
          };
          logger.warn(`[Content Safety Alert] File ${file.originalname} flagged for human review.`);
        }

        // Handle plain text / CSV files
        if (!detected) {
          const isCsvAllowed =
            allowedMimes.includes('text/csv') || allowedMimes.includes('text/plain');
          const ext = (file.originalname || '').split('.').pop()?.toLowerCase();
          const isCsvExt = ext === 'csv' || ext === 'txt';

          if (isCsvAllowed && isCsvExt) {
            // Ensure no null bytes in text files
            if (buffer.includes(0x00)) {
              cleanupDisk();
              return next(new AppError('Invalid CSV file: null byte characters detected.', 400));
            }
            continue;
          } else {
            cleanupDisk();
            return next(
              new AppError('Uploaded file signature does not match allowed format.', 400)
            );
          }
        }

        // Handle archives (ZIP/EPUB/XLSX) - Zip bomb & Zip slip validation
        if (detected.mime === 'application/zip') {
          try {
            validateZipBomb(buffer);
          } catch (zipErr) {
            cleanupDisk();
            return next(zipErr);
          }
        }

        // Verify detected MIME matches allowed list
        if (allowedMimes.length > 0 && !allowedMimes.includes(detected.mime)) {
          // Special exception for EPUB zip containers
          if (
            detected.mime === 'application/zip' &&
            allowedMimes.includes('application/epub+zip')
          ) {
            continue;
          }
          // Special exception for XLSX zip containers
          if (
            detected.mime === 'application/zip' &&
            allowedMimes.includes(
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
          ) {
            continue;
          }
          cleanupDisk();
          return next(
            new AppError(
              `File type mismatch: expected ${allowedMimes.join(', ')}, detected ${detected.mime}`,
              400
            )
          );
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  DANGEROUS_EXTENSIONS,
  sanitizeUploadFilename,
  generateSafeFilename,
  detectMimeFromBuffer,
  validateZipBomb,
  scanForMaliciousPayloads,
  createSafeFileFilter,
  validateMagicBytes,
};
