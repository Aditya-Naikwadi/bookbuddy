module.exports = {
  async up(db) {
    await db
      .collection('notificationlogs')
      .updateMany({ read: { $exists: false } }, { $set: { read: false, readAt: null } });

    await db
      .collection('notifications')
      .updateMany({ read: { $exists: false } }, { $set: { read: false, readAt: null } });
  },

  async down(db) {
    await db
      .collection('notificationlogs')
      .updateMany({ read: false, readAt: null }, { $unset: { read: '', readAt: '' } });

    await db
      .collection('notifications')
      .updateMany({ read: false, readAt: null }, { $unset: { read: '', readAt: '' } });
  },
};
