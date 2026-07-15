const mongoose = require('mongoose');

/**
 * Executes a function within a Mongoose transaction if a Replica Set is available.
 * If running on a standalone local MongoDB instance (e.g. CI, local development),
 * it runs the function directly without starting a transaction to avoid Mongo errors.
 */
const runInTransaction = async (fn) => {
  const conn = mongoose.connection;

  // Safely check if database topology is a replica set
  const descriptionType = conn.client?.topology?.description?.type || '';
  const isReplicaSet = descriptionType.toLowerCase().includes('replicaset') || false;

  if (!isReplicaSet) {
    // Run directly without transactional session
    return await fn(null);
  }

  const session = await conn.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

module.exports = { runInTransaction };
