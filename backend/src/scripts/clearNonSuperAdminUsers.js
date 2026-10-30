const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function clearNonSuperAdminUsers() {
  try {
    console.log('\n======================================================');
    console.log('🛡️  BOOKBUDDY USER DATA PURGE (PRESERVE SUPER ADMIN)');
    console.log('======================================================');

    await connectDB();

    // 1. Verify Super Admin exists before doing anything
    const superAdmin = await User.findOne({
      role: { $in: ['super-admin', 'super_admin'] },
    }).select('+password');

    if (!superAdmin) {
      throw new Error('❌ ABORT: No Super Admin account found in database. Refusing to purge.');
    }

    console.log(`\n👑 Super Admin Account Found (WILL BE PRESERVED):`);
    console.log(`   ID:    ${superAdmin._id}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Role:  ${superAdmin.role}`);
    console.log(`   Name:  ${superAdmin.name}`);

    // 2. Query all non-superadmin users
    const nonSuperUsers = await User.find({
      _id: { $ne: superAdmin._id },
      role: { $nin: ['super-admin', 'super_admin'] },
    }).select('_id email role name studentId');

    const totalToDelete = nonSuperUsers.length;
    console.log(`\nFound ${totalToDelete} non-superadmin users to remove:`);
    const roleBreakdown = {};
    for (const u of nonSuperUsers) {
      roleBreakdown[u.role] = (roleBreakdown[u.role] || 0) + 1;
    }
    for (const [r, cnt] of Object.entries(roleBreakdown)) {
      console.log(`   - ${r}: ${cnt}`);
    }

    if (totalToDelete === 0) {
      console.log('\n✅ No non-superadmin users found. Nothing to remove.');
      return;
    }

    const userIds = nonSuperUsers.map((u) => u._id);

    // 3. Purge related personal/session collections
    const collectionsToClean = [
      'refreshtokens',
      'loans',
      'fines',
      'bookmarks',
      'annotations',
      'readingprogresses',
      'readingpositions',
      'registrationrequests',
      'studentjoinrequests',
      'notifications',
      'notificationpreferences',
      'devicetokens',
      'labbookings',
      'checkinlogs',
      'readingactivitylogs',
      'complaints',
      'feedbacks',
      'booksuggestions',
      'userstickers',
      'streaks',
    ];

    console.log('\n🧹 Purging associated user records across collections...');
    for (const colName of collectionsToClean) {
      try {
        const col = mongoose.connection.db.collection(colName);
        const result = await col.deleteMany({
          $or: [
            { userId: { $in: userIds } },
            { user: { $in: userIds } },
            { studentId: { $in: userIds } },
            { requestedBy: { $in: userIds } },
            { reviewedBy: { $in: userIds } },
          ],
        });
        if (result.deletedCount > 0) {
          console.log(`   ✓ ${colName}: deleted ${result.deletedCount} documents`);
        }
      } catch (_err) {
        // Collection might not exist or have no index, safe to continue
      }
    }

    // 4. Purge the non-superadmin users themselves
    console.log('\n🗑️ Removing non-superadmin user accounts from "users" collection...');
    const userDeleteResult = await User.deleteMany({
      _id: { $in: userIds },
    });
    console.log(`   ✓ Successfully deleted ${userDeleteResult.deletedCount} user accounts.`);

    // 5. Verify database state
    const remainingUsers = await User.find({}).select('email role name');
    console.log('\n======================================================');
    console.log(`📊 FINAL VERIFICATION:`);
    console.log(`   Total users remaining in database: ${remainingUsers.length}`);
    for (const u of remainingUsers) {
      console.log(`   - ${u.email} (${u.role})`);
    }
    console.log('======================================================');
    console.log('✅ Purge completed successfully. Super Admin credentials intact.\n');
  } catch (error) {
    console.error('\n❌ Purge Error:', error.message);
    throw error;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

if (require.main === module) {
  clearNonSuperAdminUsers()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = clearNonSuperAdminUsers;
