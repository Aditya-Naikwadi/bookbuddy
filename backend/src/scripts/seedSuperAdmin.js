const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('../config/db');

// Load env variables
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
const User = require('../models/User');

async function seedSuperAdmin() {
  try {
    console.log('Connecting to MongoDB database...');
    await connectDB();
    console.log('Database connection established.');

    const seedEmail = process.env.SEED_SUPER_ADMIN_EMAIL || 'SuperAdmin@bookbuddy.com';
    const plainPassword = (
      process.env.SEED_SUPER_ADMIN_PASSWORD ||
      process.env.SUPERADMIN_PASSWORD ||
      ''
    ).trim();

    const isProduction = process.env.NODE_ENV === 'production';
    const args = process.argv.slice(2);

    if (isProduction && !args.includes('--allow-production')) {
      throw new Error(
        '❌ FATAL: Seeding super-admin in production requires the explicit --allow-production flag.'
      );
    }

    const FORBIDDEN_PASSWORDS = [
      'admin',
      'admin123',
      'password',
      'password123',
      'changeme',
      'superadmin',
      'superadmin123',
      'devsuperadminpass@2026!',
      '12345678',
      '1234567890',
    ];

    if (plainPassword && FORBIDDEN_PASSWORDS.includes(plainPassword.toLowerCase())) {
      throw new Error(
        '❌ FATAL: Specified super-admin password is a known weak or default password. Provide a strong unique password.'
      );
    }

    if (isProduction) {
      if (!plainPassword) {
        throw new Error(
          '❌ FATAL: SEED_SUPER_ADMIN_PASSWORD environment variable is required to provision the super admin in production.'
        );
      }
      if (
        plainPassword.length < 14 ||
        !/[A-Z]/.test(plainPassword) ||
        !/[a-z]/.test(plainPassword) ||
        !/[0-9]/.test(plainPassword) ||
        !/[^A-Za-z0-9]/.test(plainPassword)
      ) {
        throw new Error(
          '❌ FATAL: Production super-admin password must be at least 14 characters long and include uppercase, lowercase, numbers, and symbols.'
        );
      }
    }

    const crypto = require('crypto');
    const finalPlainPassword =
      plainPassword ||
      `BB-${crypto.randomBytes(8).toString('hex')}-${crypto.randomInt(1000, 9999)}!Aa`;

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

      // Explicitly hash password using Argon2id before storage
      const argon2 = require('argon2');
      const hashedPassword = await argon2.hash(finalPlainPassword, { type: argon2.argon2id });

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
