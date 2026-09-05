const crypto = require('crypto');
const Announcement = require('../../models/Announcement');
const LibrarySettings = require('../../models/LibrarySettings');
const Book = require('../../models/Book');
const College = require('../../models/College');
const mongoose = require('mongoose');
const { getOrComputeStats } = require('../../utils/dashboardCache');
const logger = require('../../utils/logger');

// Retry helper for transient MongoDB read operations
const retryRead = async (fn, retries = 2, delayMs = 100) => {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > retries) throw err;
      await new Promise((res) => setTimeout(res, delayMs * attempt));
    }
  }
};

const escapeHtml = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

// @desc    Get single aggregated General Dashboard data (stats, hours, announcements, popular & new arrivals)
// @route   GET /api/v1/college/:id/dashboard
// @access  Public / General (Tenant Scoped)
const getCollegeDashboard = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const targetId = req.params.id || req.query.collegeId || req.user?.collegeId;
    let collegeId = null;

    if (targetId && mongoose.Types.ObjectId.isValid(String(targetId))) {
      collegeId = String(targetId);
    } else {
      const defaultCollege = await retryRead(() =>
        College.findOne({ status: 'active' }).select('_id').lean()
      );
      if (defaultCollege) {
        collegeId = defaultCollege._id.toString();
      }
    }

    // Tenant Isolation Check for logged-in non-super-admin users
    if (req.user && req.user.role !== 'super-admin' && req.user.role !== 'super_admin') {
      const userCollegeId = req.user.collegeId ? String(req.user.collegeId) : null;
      if (userCollegeId && collegeId && userCollegeId !== collegeId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Access denied to another college data',
        });
      }
    }

    const tenantFilter = collegeId
      ? { $or: [{ collegeId: new mongoose.Types.ObjectId(collegeId) }, { collegeId: null }] }
      : {};
    const bookFilter = collegeId
      ? {
          $or: [
            { collegeId: new mongoose.Types.ObjectId(collegeId) },
            { isShareableAcrossColleges: true },
            { collegeId: null },
          ],
        }
      : {};

    // 1. Fetch precomputed/cached stats
    const { stats, cacheHit } = await getOrComputeStats(collegeId);

    // 2. Fetch Announcements
    const rawAnnouncements = await retryRead(() =>
      Announcement.find({
        ...tenantFilter,
        isActive: true,
      })
        .sort({ startDate: -1 })
        .limit(10)
        .lean()
    );

    const announcements = rawAnnouncements.map((a) => ({
      _id: a._id,
      collegeId: a.collegeId,
      title: escapeHtml(a.title),
      content: escapeHtml(a.content),
      message: escapeHtml(a.message || a.content),
      priority: a.priority,
      category: a.category,
      startDate: a.startDate ? new Date(a.startDate).toISOString() : null,
      endDate: a.endDate ? new Date(a.endDate).toISOString() : null,
      createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : null,
    }));

    // 3. Fetch Library Hours Settings
    let librarySettings = null;
    if (collegeId) {
      librarySettings = await retryRead(() =>
        LibrarySettings.findOne({ collegeId: new mongoose.Types.ObjectId(collegeId) }).lean()
      );
    }
    if (!librarySettings) {
      librarySettings = await retryRead(() => LibrarySettings.findOne({}).lean());
    }
    if (!librarySettings) {
      let collegeTimezone = 'Asia/Kolkata';
      if (collegeId) {
        const collegeObj = await retryRead(() =>
          College.findById(collegeId).select('timezone').lean()
        );
        if (collegeObj?.timezone) {
          collegeTimezone = collegeObj.timezone;
        }
      }
      librarySettings = {
        openingHour: '08:00 AM',
        closingHour: '05:00 PM',
        timezone: collegeTimezone,
        isClosedToday: false,
        monthlyGrowthGoal: 0,
      };
    }

    // 4. Fetch Popular Books
    const popularBooks = await retryRead(() =>
      Book.find(bookFilter).sort({ copiesAvailable: -1, title: 1 }).limit(8).lean()
    );

    const formattedPopularBooks = popularBooks.map((b) => ({
      _id: b._id,
      id: b._id,
      isbn: b.isbn,
      title: b.title,
      author: b.author,
      genre: b.category || b.genre || 'General',
      category: b.category || b.genre || 'General',
      year: b.publicationYear || b.publishYear || '2024',
      availableCopies: Number(b.copiesAvailable !== undefined ? b.copiesAvailable : 0),
      totalCopies: Number(b.copiesTotal !== undefined ? b.copiesTotal : 0),
      shelfLocation: b.shelfLocation || 'Main Stacks',
      description: b.description || 'Catalog item.',
      coverUrl: b.coverImageUrl || b.coverUrl || null,
      createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
    }));

    // 5. Fetch New Arrivals
    const newArrivals = await retryRead(() =>
      Book.find(bookFilter).sort({ createdAt: -1 }).limit(6).lean()
    );

    const formattedNewArrivals = newArrivals.map((b) => ({
      _id: b._id,
      id: b._id,
      isbn: b.isbn,
      title: b.title,
      author: b.author,
      genre: b.category || b.genre || 'General',
      category: b.category || b.genre || 'General',
      availableCopies: Number(b.copiesAvailable !== undefined ? b.copiesAvailable : 0),
      totalCopies: Number(b.copiesTotal !== undefined ? b.copiesTotal : 0),
      shelfLocation: b.shelfLocation || 'Main Stacks',
      description: b.description || 'Catalog item.',
      coverUrl: b.coverImageUrl || b.coverUrl || null,
      createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
    }));

    const responsePayload = {
      collegeId,
      announcements,
      librarySettings,
      stats,
      popularBooks: formattedPopularBooks,
      newArrivals: formattedNewArrivals,
    };

    const finalResponseBody = {
      success: true,
      data: responsePayload,
    };

    // Calculate MD5 ETag on exact JSON string
    const payloadString = JSON.stringify(finalResponseBody);
    const etag = `"${crypto.createHash('md5').update(payloadString).digest('hex')}"`;

    // Response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.setHeader('X-Cache-Hit', cacheHit ? 'HIT' : 'MISS');

    // Structured logging
    const duration = Date.now() - startTime;
    logger.info(
      `[GET /api/v1/college/${collegeId}/dashboard] RequestID: ${req.id || 'n/a'} Duration: ${duration}ms CacheHit: ${cacheHit}`
    );

    // Conditional ETag 304 Not Modified Check
    const clientEtag = req.headers['if-none-match'];
    if (
      clientEtag &&
      (clientEtag === etag || clientEtag.replace(/^W\//, '') === etag.replace(/^W\//, ''))
    ) {
      return res.status(304).end();
    }

    res.send(payloadString);
  } catch (error) {
    next(error);
  }
};

// @desc    Get aggregated General Dashboard data directly from MongoDB (Legacy alias)
// @route   GET /api/dashboards/general/home-data
// @access  Public / General
const getGeneralDashboardData = async (req, res, next) => {
  return getCollegeDashboard(req, res, next);
};

module.exports = {
  getGeneralDashboardData,
  getCollegeDashboard,
};
