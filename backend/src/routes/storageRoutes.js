const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { verifyStorageToken, resolveStorageLocalPath } = require('../utils/storage');
const AppError = require('../utils/AppError');

/**
 * @desc    Direct presigned download endpoint (Protected via HMAC query token)
 * @route   GET /api/v1/storage/download/*
 * @access  Public (Protected via HMAC token)
 */
router.get('/download/{*fileKey}', (req, res, next) => {
  try {
    const rawFileKey = req.params.fileKey || req.params[0];
    const fileKey = Array.isArray(rawFileKey) ? rawFileKey.join('/') : rawFileKey;
    const { token, expires, filename } = req.query;

    if (!fileKey) {
      return next(new AppError('Target file key is required.', 400));
    }

    // Verify cryptographic presigned HMAC token
    const isValid = verifyStorageToken({
      operation: 'download',
      fileKey,
      token,
      expires,
    });

    if (!isValid) {
      return next(
        new AppError('Presigned download token is invalid or has expired. Please re-request.', 403)
      );
    }

    const localPath = resolveStorageLocalPath(fileKey);

    if (!fs.existsSync(localPath)) {
      return next(new AppError('Resource file was not found in storage.', 404));
    }

    // Strict security sandboxing headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");

    const ext = path.extname(localPath).toLowerCase();
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (ext === '.epub') {
      res.setHeader('Content-Type', 'application/epub+zip');
    }

    if (filename) {
      const sanitizedName = String(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
      res.setHeader('Content-Disposition', `inline; filename="${sanitizedName}"`);
    }

    // res.sendFile supports HTTP 206 Partial Content and Range headers automatically
    res.sendFile(localPath);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
