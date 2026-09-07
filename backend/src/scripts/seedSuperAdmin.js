const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');
const connectDB = require('../config/db');

// Load env variables
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
const User = require('../models/User');

async function seedSuperAdmin() {
  try {
    console.log('Connecting to MongoDB database...');
    await connectDB();
    console.log('Database connection established.');

    const seedEmail = 'SuperAdmin@bookbuddy.com';
    const plainPassword = process.env.SEED_SUPER_ADMIN_PASSWORD || 'SuperAdminPass@2026!';

    let superAdmin = await User.findOne({
      $or: [{ email: seedEmail.toLowerCase() }, { role: { $in: ['super-admin', 'super_admin'] } }],
    }).select('+password');

    if (superAdmin) {
      console.log('--- EXISTING SUPER ADMIN ACCOUNT IDENTIFIED ---');
      console.log(`Email: ${superAdmin.email}`);
      console.log(`Role: ${superAdmin.role}`);
      console.log('Account already exists. Preserving existing user record.');

      // Ensure mustChangePasswordOnNextLogin is true
      if (!superAdmin.mustChangePasswordOnNextLogin) {
        superAdmin.mustChangePasswordOnNextLogin = true;
        await superAdmin.save();
        console.log('Updated mustChangePasswordOnNextLogin: true on existing super-admin.');
      }
      return superAdmin;
    } else {
      console.log('--- PROVISIONING SUPER ADMIN ACCOUNT ---');

      // Explicitly hash password using bcrypt before storage
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(plainPassword, salt);

      superAdmin = await User.create({
        studentId: 'SUPERADMIN-001',
        name: 'System Super Admin',
        email: seedEmail,
        password: hashedPassword,
        role: 'super-admin',
        isActive: true,
        isEmailVerified: true,
        membershipStatus: 'active',
        status: 'active',
        mustChangePasswordOnNextLogin: true,
      });

      console.log('✓ Super Admin account provisioned successfully!');
      console.log(`✓ Account Email: ${superAdmin.email}`);
      console.log(`✓ Account Role: ${superAdmin.role}`);
      console.log('✓ Password stored securely as bcrypt hash in database.');
      console.log('✓ Plaintext secret loaded from SEED_SUPER_ADMIN_PASSWORD environment variable.');
      console.log('✓ set mustChangePasswordOnNextLogin: true');
      return superAdmin;
    }
  } catch (err) {
    console.error('Super Admin seeding error:', err);
    throw err;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

if (require.main === module) {
  seedSuperAdmin();
}

module.exports = seedSuperAdmin;
