const crypto = require('crypto');
const { syncTopic } = require('../services/bookAggregator');
const UnifiedBook = require('../models/UnifiedBook');

const jobStore = new Map();

/**
 * @desc    Get aggregated external books (UnifiedBook collection)
 * @route   GET /api/v1/aggregator
 * @access  Public / Authenticated (Global - Not Tenant Scoped)
 */
const getAggregatedBooks = async (req, res, next) => {
  try {
    const { q, query, source, page = 1, limit = 12 } = req.query;
    const searchTerm = q || query || '';
    const filter = {};

    if (searchTerm) {
      filter.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { authors: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    if (source && source !== 'all') {
      filter.sources = source;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 12;
    const skip = (pageNum - 1) * limitNum;

    let total = await UnifiedBook.countDocuments(filter);

    // Auto-sync fallback: If collection is empty, trigger initial topic sync on demand
    if (total === 0) {
      const targetTopic = searchTerm || 'computer science';
      await syncTopic(targetTopic).catch(() => {});
      total = await UnifiedBook.countDocuments(filter);
    }

    const books = await UnifiedBook.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.json({
      success: true,
      data: books,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Trigger async non-blocking topic sync (HTTP 202 Ack)
 * @route   POST /api/v1/aggregator/sync
 * @access  Private (Admin)
 */
const triggerAsyncSync = async (req, res, next) => {
  try {
    const { topic } = req.body;
    const targetTopic = topic || 'computer science';

    const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const jobRecord = {
      id: jobId,
      topic: targetTopic,
      status: 'processing',
      startedAt: new Date().toISOString(),
      result: null,
      error: null,
    };

    jobStore.set(jobId, jobRecord);

    // Fire & forget async processing thread
    syncTopic(targetTopic)
      .then((result) => {
        jobRecord.status = 'completed';
        jobRecord.completedAt = new Date().toISOString();
        jobRecord.result = result;
      })
      .catch((err) => {
        jobRecord.status = 'failed';
        jobRecord.completedAt = new Date().toISOString();
        jobRecord.error = err.message;
      });

    // Return immediate HTTP 202 Accepted acknowledgement
    res.status(202).json({
      success: true,
      message: `Aggregation ingestion job for topic "${targetTopic}" initiated successfully.`,
      jobId,
      statusUrl: `/api/v1/aggregator/jobs/${jobId}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get status of async aggregation job
 * @route   GET /api/v1/aggregator/jobs/:id
 * @access  Private (Admin)
 */
const getJobStatus = async (req, res, next) => {
  try {
    const job = jobStore.get(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    res.json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAggregatedBooks,
  triggerAsyncSync,
  getJobStatus,
};
