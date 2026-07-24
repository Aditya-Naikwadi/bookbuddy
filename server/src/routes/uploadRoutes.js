const express = require('express');
const router = express.Router();
const { generatePresignedUploadUrl } = require('../utils/storage');
const { generateCloudinarySignature } = require('../utils/cloudinary');
const AppError = require('../utils/AppError');
const { protect } = require('../middlewares/auth');

/**
 * @desc    Generate a presigned direct upload URL (bypasses 4.5MB serverless payload limit)
 * @route   POST /api/v1/uploads/presigned-url
 * @access  Private
 */
router.post('/presigned-url', protect, async (req, res, next) => {
  try {
    const { fileName, fileType, folder } = req.body;

    if (!fileName) {
      return next(new AppError('fileName is required for presigned upload URL generation.', 400));
    }

    const uploadMeta = await generatePresignedUploadUrl({
      fileName,
      fileType: fileType || 'application/octet-stream',
      folder: folder || 'uploads',
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
router.post('/cloudinary-signature', protect, async (req, res, next) => {
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

module.exports = router;
