const asyncHandler = require('express-async-handler');
const gutenbergService = require('../services/gutenbergService');
const EResource = require('../models/EResource');
const { recordQualifyingAction } = require('../services/streakService');
const events = require('../sockets/events');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { safeFetch } = require('../utils/ssrfValidator');

// @desc    Browse / Search external Gutenberg books
// @route   GET /api/eresources/external
// @access  Private
const listExternal = asyncHandler(async (req, res) => {
  const { search, language, topic, page } = req.query;

  try {
    const data = await gutenbergService.searchBooks({ search, language, topic, page });
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500);
    throw new Error(error.message);
  }
});

// @desc    Get external book detail
// @route   GET /api/eresources/external/:gutenbergId
// @access  Private
const getExternalDetail = asyncHandler(async (req, res) => {
  try {
    const data = await gutenbergService.getBookById(req.params.gutenbergId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500);
    throw new Error(error.message);
  }
});

// @desc    Lazy-import an external book into BookBuddy DB
// @route   POST /api/eresources/external/:gutenbergId/open
// @access  Private
const openExternal = asyncHandler(async (req, res) => {
  const { gutenbergId } = req.params;

  // 1. Check if it already exists in our DB
  let resource = await EResource.findOne({
    source: 'gutenberg',
    externalId: Number(gutenbergId) || gutenbergId,
  });

  // 2. If not, fetch from Gutenberg and create it
  if (!resource) {
    try {
      const bookData = await gutenbergService.getBookById(gutenbergId);

      let collegeId = req.user?.collegeId;
      if (!collegeId) {
        const College = require('../models/College');
        const defaultCollege = await College.findOne({ isActive: true });
        if (defaultCollege) {
          collegeId = defaultCollege._id;
        }
      }

      resource = await EResource.create({
        collegeId,
        title: bookData.title,
        author: bookData.author || 'Unknown Author',
        category: 'Open Access', // Default mapped category
        type: bookData.epubUrl ? 'epub' : 'pdf',
        fileUrl: bookData.epubUrl || bookData.readUrl || 'https://gutenberg.org',
        uploadedBy: req.user?.id || req.user?._id,
        moderationStatus: 'approved',
        url: bookData.readUrl || bookData.epubUrl || '',
        source: 'gutenberg',
        externalId: bookData.externalId,
        readUrl: bookData.readUrl,
        epubUrl: bookData.epubUrl,
        downloadCount: bookData.downloadCount,
        isDownloadable: true,
        isPublished: true,
      });
    } catch (error) {
      throw new AppError(error.message, error.statusCode || 500);
    }
  }

  res.json({ success: true, data: { resourceId: resource._id } });
});

// @desc    Proxy content to client (bypass CORS)
// @route   GET /api/eresources/:id/content?format=html|epub
// @access  Private
const proxyContent = asyncHandler(async (req, res) => {
  const resource = await EResource.findById(req.params.id);

  if (!resource || resource.source !== 'gutenberg') {
    throw new AppError('Resource not found or is not an external resource', 404);
  }

  // Tenant Boundary Check: resource must belong to user's college or user is super-admin
  if (
    resource.collegeId &&
    req.user?.collegeId &&
    resource.collegeId.toString() !== req.user.collegeId.toString() &&
    req.user.role !== 'super-admin' &&
    req.user.role !== 'super_admin'
  ) {
    throw new AppError('Resource not found or is not an external resource', 404);
  }

  const { format } = req.query;
  const targetUrl = format === 'epub' ? resource.epubUrl : resource.readUrl;

  if (!targetUrl) {
    throw new AppError(`Format ${format} is not available for this resource`, 400);
  }

  try {
    // We proxy it as a stream with full SSRF, DNS-rebinding, content-type and size caps
    const response = await safeFetch(targetUrl, {
      allowedDomains: ['gutenberg.org', '*.gutenberg.org', 'gutendex.com'],
      timeout: 15000,
      maxRedirects: 5,
      maxContentLength: 50 * 1024 * 1024,
      allowedContentTypes: [
        'application/epub+zip',
        'text/html',
        'text/plain',
        'application/zip',
        'application/octet-stream',
      ],
      responseType: 'stream',
    });

    // Pass along headers and apply browser sandboxing to prevent script execution on our origin
    res.setHeader('Content-Type', response.headers['content-type'] || 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800'); // 1 day browser, 7 days Cloudflare edge
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");

    // Attach stream error handling to avoid unhandled rejections or uncaught exceptions
    if (response.data && typeof response.data.on === 'function') {
      response.data.on('error', (streamErr) => {
        logger.error(`[Proxy Content Stream Error]: ${streamErr.message}`);
        if (!res.headersSent) {
          res.status(502).json({ success: false, message: 'Stream error from upstream server' });
        } else {
          res.end();
        }
      });
    }

    // Safely abort upstream stream if client disconnects early
    res.on('close', () => {
      if (
        response.data &&
        !response.data.destroyed &&
        typeof response.data.destroy === 'function'
      ) {
        response.data.destroy();
      }
    });

    response.data.pipe(res);
  } catch (error) {
    logger.error(`[Proxy Content] Upstream fetch error: ${error.message}`);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to proxy content from upstream server', 502);
  }
});

// @desc    Record reading progress
// @route   POST /api/eresources/:id/progress
// @access  Private
const updateReadingProgress = asyncHandler(async (req, res) => {
  const { readingTimeMinutes } = req.body;

  // In a real implementation we'd save this to a ReadingProgress model,
  // but for the streak requirement, we just verify it's >= 3 minutes.
  if (readingTimeMinutes >= 3) {
    const streakData = await recordQualifyingAction(
      req.user.id,
      req.user.collegeId,
      'eresource_read'
    );
    if (streakData && req.app.get('io')) {
      req.app.get('io').to(`user:${req.user.id}`).emit(events.STREAK_UPDATED, streakData);
    }
  }

  res.json({ success: true });
});

module.exports = {
  listExternal,
  getExternalDetail,
  openExternal,
  proxyContent,
  updateReadingProgress,
};
