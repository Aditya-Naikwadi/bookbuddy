/**
 * Idempotent helper: ensures an index exists with the exact requested options.
 * See 20260724000003-migrate-phase1-schemas.js for full documentation.
 */
async function ensureIndex(db, collectionName, keySpec, options = {}) {
  const collection = db.collection(collectionName);

  const autoName = Object.entries(keySpec)
    .map(([field, dir]) => `${field}_${dir}`)
    .join('_');
  const indexName = options.name || autoName;

  let existingIndexes;
  try {
    existingIndexes = await collection.indexes();
  } catch (err) {
    // Collection doesn't exist yet — indexes() throws "ns does not exist".
    existingIndexes = [];
  }
  const existing = existingIndexes.find((idx) => idx.name === indexName);

  if (existing) {
    const optionKeys = ['unique', 'sparse', 'partialFilterExpression', 'expireAfterSeconds'];
    const needsRecreate = optionKeys.some((key) => {
      const requested = options[key];
      const current = existing[key];
      if (requested === undefined && current === undefined) return false;
      if (requested === undefined && current === false) return false;
      return JSON.stringify(requested) !== JSON.stringify(current);
    });

    if (!needsRecreate) return;
    await collection.dropIndex(indexName);
  }

  await collection.createIndex(keySpec, { ...options, name: indexName });
}

module.exports = {
  async up(db) {
    // Compound indexes matching their respective Mongoose schemas exactly.
    // Uses ensureIndex to be safe against pre-existing schema-level indexes.
    await ensureIndex(db, 'refreshtokens', { userId: 1, expiresAt: 1 });
    await ensureIndex(db, 'devicetokens', { userId: 1, lastSeenAt: -1 });
    await ensureIndex(db, 'notificationlogs', { userId: 1, createdAt: -1 });
  },

  async down(db) {
    try {
      await db.collection('refreshtokens').dropIndex('userId_1_expiresAt_1');
      await db.collection('devicetokens').dropIndex('userId_1_lastSeenAt_-1');
      await db.collection('notificationlogs').dropIndex('userId_1_createdAt_-1');
    } catch {
      // Ignore if index doesn't exist
    }
  },
};
