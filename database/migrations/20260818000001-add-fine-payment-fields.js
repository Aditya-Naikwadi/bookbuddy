module.exports = {
  async up(db) {
    // Backfill paymentStatus: 'unpaid' and paymentTransactionId: null on existing fine documents
    await db
      .collection('fines')
      .updateMany(
        { paymentStatus: { $exists: false } },
        { $set: { paymentStatus: 'unpaid', paymentTransactionId: null } }
      );
  },

  async down(db) {
    await db
      .collection('fines')
      .updateMany({}, { $unset: { paymentStatus: '', paymentTransactionId: '' } });
  },
};
