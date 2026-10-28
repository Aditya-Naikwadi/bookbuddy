const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const {
  generatePresignedUploadUrl,
  verifyStorageToken,
  resolveStorageLocalPath,
} = require('../utils/storage');
const { generateCloudinarySignature } = require('../utils/cloudinary');
const AppError = require('../utils/AppError');
const { protect } = require('../middlewares/auth');
const { expensiveRouteLimiter } = require('../middlewares/rateLimiters');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * @desc    Generate a presigned direct upload URL (bypasses serverless payload limit)
 * @route   POST /api/v1/uploads/presigned-url
 * @access  Private
 */
router.post('/presigned-url', protect, expensiveRouteLimiter, async (req, res, next) => {
  try {
    const { fileName, fileType, folder, maxSizeBytes } = req.body;

    if (!fileName) {
      return next(new AppError('fileName is required for presigned upload URL generation.', 400));
    }

    const uploadMeta = await generatePresignedUploadUrl({
      fileName,
      fileType: fileType || 'application/octet-stream',
      folder: folder || 'uploads',
      maxSizeBytes: maxSizeBytes || config.storage?.maxEbookSizeBytes || 50 * 1024 * 1024,
    });

    res.status(200).json({
      success: true,
      data: uploadMeta,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @desc    Generate Cloudinary upload signature for direct CDN browser upload
 * @route   POST /api/v1/uploads/cloudinary-signature
 * @access  Private
 */
router.post('/cloudinary-signature', protect, expensiveRouteLimiter, async (req, res, next) => {
  try {
    const { folder, tags } = req.body;

    const signatureData = generateCloudinarySignature({
      folder: folder || 'bookbuddy',
      tags: tags || [],
    });

    res.status(200).json({
      success: true,
      data: signatureData,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Handler for direct-to-storage stream uploads (local / self-hosted VM disk)
 * Validates HMAC signature and timestamp; enforces streaming size limit without RAM buffering
 */
const directUploadStreamHandler = async (req, res, next) => {
  try {
    const rawFileKey = req.params.fileKey || req.params[0];
    const fileKey = Array.isArray(rawFileKey) ? rawFileKey.join('/') : rawFileKey;
    const { token, expires } = req.query;

    if (!fileKey) {
      return next(new AppError('Target file key is required.', 400));
    }

    // Verify presigned HMAC authorization token
    const isValid = verifyStorageToken({
      operation: 'upload',
      fileKey,
      token,
      expires,
    });

    if (!isValid) {
      return next(
        new AppError('Presigned upload token is invalid or has expired. Please re-request.', 403)
      );
    }

    const maxSizeBytes = config.storage?.maxEbookSizeBytes || 50 * 1024 * 1024;
    const contentLength = Number(req.headers['content-length']);

    if (contentLength && contentLength > maxSizeBytes) {
      return next(
        new AppError(
          `File size exceeds maximum allowed upload limit (${Math.round(maxSizeBytes / (1024 * 1024))}MB).`,
          413
        )
      );
    }

    const targetPath = resolveStorageLocalPath(fileKey);
    const parentDir = path.dirname(targetPath);

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    let bytesReceived = 0;
    let limitExceeded = false;
    const writeStream = fs.createWriteStream(targetPath);

    req.on('data', (chunk) => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxSizeBytes && !limitExceeded) {
        limitExceeded = true;
        writeStream.destroy();
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
        return next(
          new AppError(
            `Payload too large: streamed bytes exceeded ${Math.round(maxSizeBytes / (1024 * 1024))}MB limit.`,
            413
          )
        );
      }
    });

    writeStream.on('error', (err) => {
      logger.error(`Direct upload write error for ${fileKey}: ${err.message}`);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      if (!res.headersSent) {
        next(new AppError('Failed to persist uploaded file to storage disk.', 500));
      }
    });

    writeStream.on('finish', () => {
      if (limitExceeded) return;
      res.status(200).json({
        success: true,
        message: 'File successfully uploaded directly to storage.',
        data: {
          fileKey,
          publicUrl: `/uploads/${fileKey}`,
          sizeBytes: bytesReceived,
        },
      });
    });

    req.pipe(writeStream);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Direct-to-storage upload endpoint (Local / Self-hosted VM provider)
 * @route   PUT /api/v1/uploads/direct/* OR POST /api/v1/uploads/direct/*
 * @access  Public (Protected via HMAC presigned query signature)
 */
router.put('/direct/{*fileKey}', directUploadStreamHandler);
router.post('/direct/{*fileKey}', directUploadStreamHandler);

module.exports = router;
