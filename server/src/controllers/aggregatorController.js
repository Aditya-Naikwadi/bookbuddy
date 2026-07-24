const crypto = require('crypto');
const { syncTopic } = require('../services/bookAggregator');

const jobStore = new Map();

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
  triggerAsyncSync,
  getJobStatus,
};
