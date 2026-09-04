const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('../config/db');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
const User = require('../models/User');

async function seedSuperAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('Connected to DB successfully.');

    let superAdmin = await User.findOne({
      $or: [
        { role: { $in: ['super-admin', 'super_admin'] } },
        { email: 'superadmin@bookbuddy.com' },
      ],
    }).select('+password');

    if (superAdmin) {
      console.log('--- EXISTING SUPER ADMIN ACCOUNT ---');
      console.log(`Email: ${superAdmin.email}`);
      console.log(`Role: ${superAdmin.role}`);
      console.log('Resetting password to: SuperAdmin@123');
      superAdmin.password = 'SuperAdmin@123';
      superAdmin.role = 'super-admin';
      superAdmin.isActive = true;
      superAdmin.status = 'active';
      await superAdmin.save();
      console.log('Password reset successfully!');
    } else {
      console.log('--- CREATING NEW SUPER ADMIN ACCOUNT ---');
      superAdmin = await User.create({
        studentId: 'SUPERADMIN-001',
        name: 'System Super Admin',
        email: 'superadmin@bookbuddy.com',
        password: 'SuperAdmin@123',
        role: 'super-admin',
        isActive: true,
        isEmailVerified: true,
        membershipStatus: 'active',
        status: 'active',
      });
      console.log('Created Super Admin account successfully!');
    }

    console.log('\n=======================================');
    console.log('🔑 SUPER ADMIN LOGIN CREDENTIALS:');
    console.log(`URL:      http://localhost:5173/auth/login`);
    console.log(`Email:    ${superAdmin.email}`);
    console.log(`Password: SuperAdmin@123`);
    console.log('=======================================\n');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

seedSuperAdmin();
