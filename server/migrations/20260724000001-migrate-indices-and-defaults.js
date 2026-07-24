const crypto = require('crypto');

module.exports = {
  async up(db) {
    // 1. Seed default maxFineLimit: 100 on existing College documents
    await db
      .collection('colleges')
      .updateMany(
        { $or: [{ maxFineLimit: { $exists: false } }, { maxFineLimit: null }] },
        { $set: { maxFineLimit: 100 } }
      );

    // 2. Populate cardSecret on User documents missing it
    const usersWithoutSecret = await db
      .collection('users')
      .find({
        $or: [{ cardSecret: { $exists: false } }, { cardSecret: null }, { cardSecret: '' }],
      })
      .toArray();

    for (const u of usersWithoutSecret) {
      const secret = crypto.randomBytes(32).toString('hex');
      await db.collection('users').updateOne({ _id: u._id }, { $set: { cardSecret: secret } });
    }
  },

  async down(db) {
    await db
      .collection('colleges')
      .updateMany({ maxFineLimit: 100 }, { $unset: { maxFineLimit: '' } });
  },
};
