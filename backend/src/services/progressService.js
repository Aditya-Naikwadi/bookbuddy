const ReadingProgress = require('../models/ReadingProgress');

/**
 * Upsert reading progress for a specific user and resource
 * Enforces Last-Write-Wins (LWW) timestamp resolution deterministically.
 * Clamps client timestamps to current server time to protect against client clock skew.
 */
const upsertProgress = async ({
  userId,
  resourceId,
  resourceType,
  position,
  percentageComplete,
  deviceId,
  updatedAt,
}) => {
  const serverNow = new Date();
  let incomingUpdatedAt = updatedAt ? new Date(updatedAt) : serverNow;

  // Protect against client clock skew into the future
  if (incomingUpdatedAt.getTime() > serverNow.getTime()) {
    incomingUpdatedAt = serverNow;
  }

  try {
    const updated = await ReadingProgress.findOneAndUpdate(
      {
        userId,
        resourceId,
        $or: [{ updatedAt: { $lte: incomingUpdatedAt } }, { updatedAt: { $exists: false } }],
      },
      {
        $set: {
          resourceType,
          position,
          percentageComplete,
          deviceId,
          updatedAt: incomingUpdatedAt,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true, timestamps: false }
    );
    return updated;
  } catch (err) {
    if (err.code === 11000) {
      const existing = await ReadingProgress.findOne({ userId, resourceId });
      if (existing && new Date(existing.updatedAt).getTime() <= incomingUpdatedAt.getTime()) {
        return await ReadingProgress.findOneAndUpdate(
          { _id: existing._id },
          {
            $set: {
              resourceType,
              position,
              percentageComplete,
              deviceId,
              updatedAt: incomingUpdatedAt,
            },
          },
          { returnDocument: 'after', runValidators: true, timestamps: false }
        );
      }
      return existing;
    }
    throw err;
  }
};

/**
 * Fetch reading progress for a user and resource
 */
const getProgress = async (userId, resourceId) => {
  return await ReadingProgress.findOne({ userId, resourceId });
};

module.exports = {
  upsertProgress,
  getProgress,
};
