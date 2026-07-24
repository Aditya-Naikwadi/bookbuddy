module.exports = {
  async up(db) {
    await db.collection('refreshtokens').createIndex({ userId: 1, expiresAt: 1 });
    await db.collection('devicetokens').createIndex({ userId: 1, lastSeenAt: -1 });
    await db.collection('notificationlogs').createIndex({ userId: 1, createdAt: -1 });
  },

  async down(db) {
    try {
      await db.collection('refreshtokens').dropIndex({ userId: 1, expiresAt: 1 });
      await db.collection('devicetokens').dropIndex({ userId: 1, lastSeenAt: -1 });
      await db.collection('notificationlogs').dropIndex({ userId: 1, createdAt: -1 });
    } catch {
      // Ignore if index doesn't exist
    }
  },
};
