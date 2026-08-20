const ReadingProgress = require('../models/ReadingProgress');

/**
 * Upsert reading progress for a specific user and resource
 * Enforces Last-Write-Wins (LWW) timestamp resolution deterministically
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
  const incomingUpdatedAt = updatedAt ? new Date(updatedAt) : new Date();

  // 1. Try atomic update if existing.updatedAt <= incomingUpdatedAt
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
    { returnDocument: 'after', runValidators: true, timestamps: false }
  );

  if (updated) {
    return updated;
  }

  // 2. If update matched 0 documents (either no document exists or existing is newer):
  const existing = await ReadingProgress.findOne({ userId, resourceId });
  if (existing) {
    // Existing record has a newer timestamp; keep existing
    return existing;
  }

  // 3. Insert initial progress document
  try {
    const [created] = await ReadingProgress.create(
      [
        {
          userId,
          resourceId,
          resourceType,
          position,
          percentageComplete,
          deviceId,
          updatedAt: incomingUpdatedAt,
        },
      ],
      { timestamps: false }
    );
    return created;
  } catch (err) {
    if (err.code === 11000) {
      // Race condition safety: if created concurrently, retry upsert
      return await upsertProgress({
        userId,
        resourceId,
        resourceType,
        position,
        percentageComplete,
        deviceId,
        updatedAt: incomingUpdatedAt,
      });
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
