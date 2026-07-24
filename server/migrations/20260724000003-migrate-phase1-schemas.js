module.exports = {
  async up(db) {
    // Synchronize unique & compound indexes on core collections
    await db.collection('payments').createIndex({ providerSessionId: 1 }, { sparse: true });
    await db.collection('payments').createIndex({ providerEventId: 1 }, { sparse: true });
    await db.collection('annotations').createIndex({ userId: 1, resourceId: 1 });
    await db.collection('eresourcesubmissions').createIndex({ collegeId: 1, status: 1 });
    await db.collection('labbookings').createIndex({ seatId: 1, date: 1, status: 1 });
  },

  async down(db) {
    try {
      await db.collection('payments').dropIndex({ providerSessionId: 1 });
      await db.collection('payments').dropIndex({ providerEventId: 1 });
      await db.collection('annotations').dropIndex({ userId: 1, resourceId: 1 });
      await db.collection('eresourcesubmissions').dropIndex({ collegeId: 1, status: 1 });
      await db.collection('labbookings').dropIndex({ seatId: 1, date: 1, status: 1 });
    } catch {
      // Ignore if index doesn't exist
    }
  },
};
