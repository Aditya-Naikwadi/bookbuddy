/**
 * Idempotent helper: ensures an index exists with the exact requested options.
 * - If an index with the same auto-generated name already exists with identical
 *   key+options → no-op (safe re-run).
 * - If it exists with DIFFERENT options → drops the stale one first, then
 *   creates the corrected version.
 * - If it doesn't exist at all → creates it fresh.
 *
 * This prevents the "index already exists with different options" MongoError
 * that occurs when Mongoose's autoIndex creates a schema-level index before a
 * migration tries to create the same-named index with different options.
 */
async function ensureIndex(db, collectionName, keySpec, options = {}) {
  const collection = db.collection(collectionName);

  // Derive the canonical index name MongoDB would auto-generate
  const autoName = Object.entries(keySpec)
    .map(([field, dir]) => `${field}_${dir}`)
    .join('_');
  const indexName = options.name || autoName;

  let existingIndexes;
  try {
    existingIndexes = await collection.indexes();
  } catch {
    // Collection doesn't exist yet — indexes() throws "ns does not exist".
    // createIndex below will auto-create the collection.
    existingIndexes = [];
  }
  const existing = existingIndexes.find((idx) => idx.name === indexName);

  if (existing) {
    // Check whether every requested option already matches the existing index
    const optionKeys = ['unique', 'sparse', 'partialFilterExpression', 'expireAfterSeconds'];
    const needsRecreate = optionKeys.some((key) => {
      const requested = options[key];
      const current = existing[key];
      if (requested === undefined && current === undefined) return false;
      if (requested === undefined && current === false) return false; // MongoDB defaults
      return JSON.stringify(requested) !== JSON.stringify(current);
    });

    if (!needsRecreate) {
      // Index already exists with correct options — skip
      return;
    }

    // Options differ — drop stale index before re-creating
    await collection.dropIndex(indexName);
  }

  await collection.createIndex(keySpec, { ...options, name: indexName });
}

module.exports = {
  async up(db) {
    // Synchronize unique & compound indexes on core collections.
    // Uses ensureIndex to be safe against pre-existing schema-level indexes.

    // providerSessionId: sparse (no unique — this field is optional)
    await ensureIndex(db, 'payments', { providerSessionId: 1 }, { sparse: true });

    // providerEventId: unique + sparse — must match Payment.js schema exactly.
    // NOTE: This index is intentionally defined in both the Mongoose schema and
    // this migration. Both MUST specify { unique: true, sparse: true }. See
    // Payment.js for the schema-side declaration.
    await ensureIndex(db, 'payments', { providerEventId: 1 }, { unique: true, sparse: true });

    // Compound indexes (no special options — match their respective schemas)
    await ensureIndex(db, 'annotations', { userId: 1, resourceId: 1 });
    await ensureIndex(db, 'eresourcesubmissions', { collegeId: 1, status: 1 });
    await ensureIndex(db, 'labbookings', { seatId: 1, date: 1, status: 1 });
  },

  async down(db) {
    try {
      await db.collection('payments').dropIndex('providerSessionId_1');
      await db.collection('payments').dropIndex('providerEventId_1');
      await db.collection('annotations').dropIndex('userId_1_resourceId_1');
      await db.collection('eresourcesubmissions').dropIndex('collegeId_1_status_1');
      await db.collection('labbookings').dropIndex('seatId_1_date_1_status_1');
    } catch {
      // Ignore if index doesn't exist
    }
  },
};
