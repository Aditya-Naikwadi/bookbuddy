const PaymentAttempt = require('../models/PaymentAttempt');

/**
 * Middleware to enforce exactly-once execution on key mutations (like payments).
 * Captures responses and replays them on duplicate requests.
 */
const idempotency = async (req, res, next) => {
  const key = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (!key) {
    return next();
  }

  // Idempotency keys should be valid strings
  if (typeof key !== 'string' || key.trim().length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Idempotency-Key format. Provide a unique string.',
    });
  }

  try {
    const attempt = await PaymentAttempt.findOne({ idempotencyKey: key });
    if (attempt) {
      if (attempt.status === 'completed') {
        // Replay cached successful response
        return res.status(200).json(attempt.responsePayload);
      }
      if (attempt.status === 'pending') {
        // Block overlapping double-submit
        return res.status(409).json({
          success: false,
          error: 'TRANSACTION_IN_PROGRESS',
          message:
            'Another request with this key is currently in progress. Please retry in a few seconds.',
        });
      }
      // If previous attempt failed, allow retry by updating status back to pending
      attempt.status = 'pending';
      await attempt.save();
    } else {
      // Create new pending log entry
      await PaymentAttempt.create({
        idempotencyKey: key,
        userId: req.user.id,
        status: 'pending',
        amount: 0,
      });
    }

    // Override res.json to capture response payload on success/failure
    const originalJson = res.json;
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        PaymentAttempt.updateOne(
          { idempotencyKey: key },
          {
            status: 'completed',
            responsePayload: body,
            amount: body.data?.amount || 0,
            fineIds: body.data?.fineIds || (body.data?._id ? [body.data._id] : []),
          }
        ).catch((err) => console.error('Failed to update completed payment attempt', err));
      } else {
        // Reset to failed on error so client can retry with same key
        PaymentAttempt.updateOne({ idempotencyKey: key }, { status: 'failed' }).catch((err) =>
          console.error('Failed to reset payment attempt status', err)
        );
      }
      return originalJson.call(this, body);
    };

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = idempotency;
