const express = require('express');
const router = express.Router();
const { generatePresignedUploadUrl } = require('../utils/storage');
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

module.exports = router;
