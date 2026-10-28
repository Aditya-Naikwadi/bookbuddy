const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const mongoose = require('mongoose');
const { safeFetch } = require('../utils/ssrfValidator');
const EResource = require('../models/EResource');
const ReadingPosition = require('../models/ReadingPosition');
const AppError = require('../utils/AppError');
const tenantScope = require('../utils/tenantScope');
const { generateSafeFilename, validateZipBomb } = require('../middlewares/fileUploadValidation');

/**
 * Validates uploaded EPUB files for validity, zip bombs, and malicious script tags
 */
const validateEPUBStructure = (filePath) => {
  try {
    // 0. Zip bomb & zip slip protection
    validateZipBomb(filePath, {
      maxEntries: 1000,
      maxTotalBytes: 200 * 1024 * 1024,
      maxRatio: 100,
    });

    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();

    // 1. Must contain "mimetype" file as one of the entries
    const mimetypeEntry = zipEntries.find((entry) => entry.entryName === 'mimetype');
    if (!mimetypeEntry) {
      return { valid: false, reason: 'mimetype file is missing from EPUB root' };
    }

    const mimetypeContent = mimetypeEntry.getData().toString('utf8').trim();
    if (mimetypeContent !== 'application/epub+zip') {
      return { valid: false, reason: 'Invalid mimetype inside EPUB container' };
    }

    // 2. Scan inner HTML/XHTML/SVG content for script tags (Stored XSS mitigation)
    const scriptRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
    const onloadRegex = /onload\s*=/gi;

    for (const entry of zipEntries) {
      const name = entry.entryName.toLowerCase();
      if (
        name.endsWith('.html') ||
        name.endsWith('.xhtml') ||
        name.endsWith('.htm') ||
        name.endsWith('.svg') ||
        name.endsWith('.xml')
      ) {
        const fileContent = entry.getData().toString('utf8');
        if (scriptRegex.test(fileContent) || onloadRegex.test(fileContent)) {
          return {
            valid: false,
            reason: `Malicious active script content detected in entry: ${entry.entryName}`,
          };
        }
      }
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, reason: `Failed to unpack ZIP structure: ${err.message}` };
  }
};

/**
 * @desc    Upload an EPUB textbook/document
 * @route   POST /api/reader/upload
 * @access  Private (Staff/Admin)
 */
const uploadEbook = async (req, res, next) => {
  try {
    const { resolveStorageLocalPath } = require('../utils/storage');

    // Case 1: Direct-to-storage presigned upload registration (Zero-Express payload)
    if (req.body && req.body.fileKey) {
      const fileKey = req.body.fileKey;
      const targetPath = resolveStorageLocalPath(fileKey);

      if (!fs.existsSync(targetPath)) {
        throw new AppError('Uploaded resource file could not be located in storage.', 404);
      }

      const isEpub = fileKey.toLowerCase().endsWith('.epub');
      if (isEpub) {
        const check = validateEPUBStructure(targetPath);
        if (!check.valid) {
          if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
          throw new AppError(`EPUB validation failed: ${check.reason}`, 400);
        }
      }

      const stats = fs.statSync(targetPath);

      const resource = await EResource.create({
        collegeId: req.user.collegeId,
        title: req.body.title || path.basename(fileKey).replace(/\.[^/.]+$/, ''),
        author: req.body.author || 'Unknown Author',
        category: req.body.category || 'Uploaded Textbooks',
        type: isEpub ? 'epub' : 'pdf',
        fileUrl: `/uploads/${fileKey}`,
        uploadedBy: req.user.id,
        moderationStatus: 'approved',
        source: 'internal',
        sourceType: 'internal-upload',
        storageKey: fileKey,
        fileSizeBytes: req.body.fileSizeBytes || stats.size,
        mimeType: isEpub ? 'application/epub+zip' : 'application/pdf',
        uploadStatus: 'available',
      });

      return res.status(201).json({
        success: true,
        message: 'Ebook registered and validated from storage successfully.',
        data: resource,
      });
    }

    // Case 2: Multipart form upload (Legacy fallback)
    if (!req.file) {
      throw new AppError('No file was uploaded and no fileKey was provided.', 400);
    }

    const tempPath = req.file.path;
    const finalDir = path.join(__dirname, '../../uploads/ebooks');

    // Create uploads directory if not exists
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }

    const finalPath = path.join(finalDir, generateSafeFilename(req.file.originalname, 'ebook'));

    // Perform EPUB structural and script validation
    const check = validateEPUBStructure(tempPath);
    if (!check.valid) {
      // Remove temporary file on reject
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      throw new AppError(`EPUB validation failed: ${check.reason}`, 400);
    }

    // Move file to final location
    fs.renameSync(tempPath, finalPath);

    const relativeStorageKey = path
      .relative(path.join(__dirname, '../..'), finalPath)
      .replace(/\\/g, '/');

    // Create EResource record
    const resource = await EResource.create({
      collegeId: req.user.collegeId,
      title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ''),
      author: req.body.author || 'Unknown Author',
      category: req.body.category || 'Uploaded Textbooks',
      type: 'epub',
      fileUrl: `/api/reader/local/${path.basename(finalPath)}`,
      uploadedBy: req.user.id,
      moderationStatus: 'approved',
      source: 'internal',
      sourceType: 'internal-upload',
      storageKey: relativeStorageKey,
      fileSizeBytes: req.file.size,
      mimeType: 'application/epub+zip',
      uploadStatus: 'available',
    });

    res.status(201).json({
      success: true,
      message: 'Ebook uploaded and validated successfully.',
      data: resource,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Stream EPUB/text content supporting Range requests or redirect to signed URL
 * @route   GET /api/reader/:resourceId/content
 * @access  Private
 */
const streamEbookContent = async (req, res, next) => {
  try {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");

    const { resourceId } = req.params;
    const { format = 'epub' } = req.query;

    const eresourceRepo = tenantScope(EResource, req);
    const resource = await eresourceRepo.findById(resourceId);

    if (!resource) {
      throw new AppError('Ebook resource not found or unauthorized access.', 404);
    }

    const isAllowedStatus = resource.moderationStatus === 'published' || resource.isPublished;

    if (!isAllowedStatus && req.user.role !== 'super-admin' && req.user.role !== 'college-admin') {
      throw new AppError('This e-resource is not published yet.', 403);
    }

    // Download audit logging
    const DownloadLog = require('../models/DownloadLog');
    const { getClientIp } = require('../utils/clientIpHelper');
    try {
      await DownloadLog.create({
        userId: req.user.id || req.user._id,
        resourceId: resource._id,
        collegeId: resource.collegeId || req.user.collegeId,
        ipAddress: getClientIp(req),
        downloadedAt: new Date(),
      });
    } catch (_logErr) {
      // Non-blocking log failure
    }

    if (resource.source === 'gutenberg') {
      const targetUrl = format === 'epub' ? resource.epubUrl : resource.readUrl;
      if (!targetUrl) {
        throw new AppError(`Format ${format} is not available for this resource.`, 400);
      }

      // Stream Gutenberg content with support for Range header forward and secure redirect following
      const headers = {};
      if (req.headers.range) {
        headers.range = req.headers.range;
      }

      const response = await safeFetch(targetUrl, {
        allowedDomains: ['www.gutenberg.org', 'gutenberg.org', 'gutendex.com'],
        headers,
        timeout: 15000,
        maxRedirects: 5,
        maxContentLength: 50 * 1024 * 1024,
        allowedContentTypes: [
          'application/epub+zip',
          'text/plain',
          'text/html',
          'application/zip',
          'application/octet-stream',
        ],
        responseType: 'stream',
      });

      // Strictly backend-controlled headers and Cloudflare edge cache headers
      res.setHeader('Content-Type', format === 'epub' ? 'application/epub+zip' : 'text/plain');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800'); // 1 day browser, 7 days Cloudflare edge
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");

      // Forward response status (200 / 206) and size boundaries
      res.status(response.status);
      if (response.headers['content-range']) {
        res.setHeader('Content-Range', response.headers['content-range']);
      }
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }

      response.data.pipe(res);
    } else {
      // Internal resources
      if (!resource.storageKey) {
        throw new AppError('Internal storage key is missing for this resource.', 404);
      }

      // Check if client requested signed URL metadata instead of direct binary stream
      if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
        const storage = require('../utils/storage');
        const signed = await storage.generatePresignedDownloadUrl({
          fileKey: resource.storageKey,
          fileName: resource.title,
          expiresInSeconds: 900,
        });

        return res.json({
          success: true,
          downloadUrl: signed.downloadUrl,
          expiresInSeconds: signed.expiresInSeconds,
          resourceId: resource._id,
          title: resource.title,
        });
      }

      // If client requests direct redirect to signed storage URL
      if (req.query.redirect === 'true') {
        const storage = require('../utils/storage');
        const signed = await storage.generatePresignedDownloadUrl({
          fileKey: resource.storageKey,
          fileName: resource.title,
          expiresInSeconds: 900,
        });

        return res.redirect(302, signed.downloadUrl);
      }

      // Proxied byte streaming with HTTP 206 partial content support
      const { resolveStorageLocalPath } = require('../utils/storage');
      let absolutePath;
      try {
        absolutePath = resolveStorageLocalPath(resource.storageKey);
      } catch {
        absolutePath = path.join(__dirname, '../..', resource.storageKey);
      }

      if (!fs.existsSync(absolutePath)) {
        throw new AppError('Resource file could not be located in object storage.', 404);
      }

      const isPdf =
        resource.type === 'pdf' ||
        resource.fileType === 'pdf' ||
        absolutePath.toLowerCase().endsWith('.pdf');
      res.setHeader('Content-Type', isPdf ? 'application/pdf' : 'application/epub+zip');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");

      // res.sendFile automatically handles HTTP Range requests and 206 status codes
      res.sendFile(absolutePath);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get reading position (supports EPUB cfi & PDF page)
 * @route   GET /api/reader/:resourceId/position
 * @access  Private
 */
const getReadingPosition = async (req, res, next) => {
  try {
    const { resourceId } = req.params;

    const isObjectId = mongoose.Types.ObjectId.isValid(String(resourceId));
    const resource = isObjectId ? await EResource.findById(resourceId) : null;
    const positionQuery = {
      userId: req.user.id || req.user._id,
      resourceId,
    };
    if (req.user.collegeId) {
      positionQuery.collegeId = req.user.collegeId;
    }
    const positionDoc = await ReadingPosition.findOne(positionQuery);

    const isPdf =
      resource &&
      (resource.type === 'pdf' ||
        resource.fileType === 'pdf' ||
        resource.fileUrl?.toLowerCase().endsWith('.pdf'));

    res.json({
      success: true,
      data: {
        resourceId,
        fileType: isPdf ? 'pdf' : 'epub',
        position: positionDoc ? positionDoc.position : '',
        cfi: positionDoc ? positionDoc.cfi : null,
        page: positionDoc ? positionDoc.page : isPdf ? 1 : null,
        progressPercentage: positionDoc ? positionDoc.progressPercentage : 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Set/upsert reading position validating fileType (cfi for epub, page for pdf)
 * @route   PUT /api/reader/:resourceId/position
 * @access  Private
 */
const setReadingPosition = async (req, res, next) => {
  try {
    const { resourceId } = req.params;
    const { cfi, page, progressPercentage, position } = req.body;

    const isObjectId = mongoose.Types.ObjectId.isValid(String(resourceId));
    const resource = isObjectId ? await EResource.findById(resourceId) : null;
    if (isObjectId && !resource) {
      throw new AppError('E-resource not found.', 404);
    }

    const isPdf =
      resource.type === 'pdf' ||
      resource.fileType === 'pdf' ||
      resource.fileUrl?.toLowerCase().endsWith('.pdf');

    // Validation branching based on resource fileType
    if (isPdf) {
      if (page === undefined || page === null || typeof page !== 'number') {
        throw new AppError('Invalid payload: "page" (number) is required for PDF resources.', 400);
      }
    } else {
      if (!cfi && !position) {
        throw new AppError('Invalid payload: "cfi" is required for EPUB resources.', 400);
      }
    }

    const updateFields = {
      position: isPdf ? String(page) : cfi || position,
      progressPercentage: progressPercentage || 0,
      collegeId: req.user.collegeId || null,
    };

    if (isPdf) {
      updateFields.page = page;
    } else {
      updateFields.cfi = cfi || position;
    }

    const positionFilter = {
      userId: req.user.id || req.user._id,
      resourceId,
    };
    if (req.user.collegeId) {
      positionFilter.collegeId = req.user.collegeId;
    }

    const updated = await ReadingPosition.findOneAndUpdate(positionFilter, updateFields, {
      returnDocument: 'after',
      upsert: true,
    });

    // Write/increment today's ReadingActivityLog row for historical time-series analytics
    const ReadingActivityLog = require('../models/ReadingActivityLog');
    const todayStr = new Date().toISOString().split('T')[0];
    const pagesDelta = req.body.pagesDelta || 1;
    const minutesDelta = req.body.minutesDelta || 2;

    await ReadingActivityLog.findOneAndUpdate(
      {
        userId: req.user.id || req.user._id,
        date: todayStr,
      },
      {
        $setOnInsert: { collegeId: req.user.collegeId },
        $inc: { pagesRead: pagesDelta, minutesRead: minutesDelta },
      },
      { upsert: true, returnDocument: 'after' }
    );

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadEbook,
  streamEbookContent,
  getReadingPosition,
  setReadingPosition,
};
