/**
 * Migration: Normalize legacy user roles to canonical representations.
 *
 * Safety standards:
 * - Backup-first: Backs up all matching un-normalized user documents to
 *   '_backup_user_roles_pre_normalization' before making modifications.
 * - Idempotent: Can be safely re-run without duplicate modifications or data corruption.
 * - Reversible: Down migration restores previous role values from the backup collection.
 */

const BACKUP_COLLECTION = '_backup_user_roles_pre_normalization';

module.exports = {
  async up(db) {
    const usersCollection = db.collection('users');
    const backupCollection = db.collection(BACKUP_COLLECTION);

    // 1. Identify users with un-normalized roles
    const unnormalizedFilter = {
      role: { $in: ['college-student', 'college_admin', 'super_admin'] },
    };

    const targetUsers = await usersCollection.find(unnormalizedFilter).toArray();

    if (targetUsers.length > 0) {
      const backupDocs = targetUsers.map((u) => ({
        originalUserId: u._id,
        originalRole: u.role,
        userSnapshot: u,
        migratedAt: new Date(),
      }));

      // Insert backup records (ignore duplicate key errors on re-runs)
      try {
        await backupCollection.insertMany(backupDocs, { ordered: false });
      } catch (err) {
        // If some records were already backed up in a previous run, proceed safely
        if (err.code !== 11000 && !err.writeErrors) {
          throw err;
        }
      }
    }

    // 2. Perform safe, atomic normalization updates
    // A. college-student -> student
    await usersCollection.updateMany(
      { role: 'college-student' },
      { $set: { role: 'student', updatedAt: new Date() } }
    );

    // B. college_admin -> college-admin
    await usersCollection.updateMany(
      { role: 'college_admin' },
      { $set: { role: 'college-admin', updatedAt: new Date() } }
    );

    // C. super_admin -> super-admin
    await usersCollection.updateMany(
      { role: 'super_admin' },
      { $set: { role: 'super-admin', updatedAt: new Date() } }
    );
  },

  async down(db) {
    const usersCollection = db.collection('users');
    const backupCollection = db.collection(BACKUP_COLLECTION);

    const backups = await backupCollection.find().toArray();
    for (const backup of backups) {
      await usersCollection.updateOne(
        { _id: backup.originalUserId },
        { $set: { role: backup.originalRole } }
      );
    }

    // Drop the backup collection after full restoration
    await backupCollection.drop().catch(() => {});
  },
};
