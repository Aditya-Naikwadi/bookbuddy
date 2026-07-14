const axios = require('axios');
const logger = require('./logger');

/**
 * Pushes unexpected (non-operational) error details to an external webhook.
 * Safe and acts as a no-op if ERROR_WEBHOOK_URL is not set.
 */
const sendAlert = async (err, req) => {
  const webhookUrl = process.env.ERROR_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  try {
    const payload = {
      text: `🚨 *Unexpected Error in BookBuddy Backend*`,
      attachments: [
        {
          color: '#FF0000',
          fields: [
            { title: 'Message', value: err.message || 'No message', short: false },
            { title: 'Status Code', value: String(err.statusCode || 500), short: true },
            { title: 'Request ID', value: req.id || 'N/A', short: true },
            { title: 'Path', value: `${req.method} ${req.originalUrl || req.url}`, short: true },
            { title: 'Stack Trace', value: err.stack ? err.stack.substring(0, 1000) : 'N/A', short: false },
          ],
        },
      ],
    };
    // Fire-and-forget request to avoid blocking the main thread or response
    axios.post(webhookUrl, payload).catch((webErr) => {
      logger.error('Failed to send webhook alert', { error: webErr.message });
    });
  } catch (webhookErr) {
    logger.error('Alerting system failed:', { error: webhookErr.message });
  }
};

module.exports = { sendAlert };
