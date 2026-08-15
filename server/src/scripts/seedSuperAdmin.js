const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
const User = require('../models/User');

async function seedSuperAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB successfully.');

    let superAdmin = await User.findOne({ role: { $in: ['super-admin', 'super_admin'] } }).select(
      '+password'
    );

    if (superAdmin) {
      console.log('--- EXISTING SUPER ADMIN ACCOUNT ---');
      console.log(`Email: ${superAdmin.email}`);
      console.log(`Role: ${superAdmin.role}`);
      console.log('If password is unknown, updating password to: SuperAdmin@123');
      superAdmin.password = await bcrypt.hash('SuperAdmin@123', 10);
      await superAdmin.save();
      console.log('Password reset successfully!');
    } else {
      console.log('--- CREATING NEW SUPER ADMIN ACCOUNT ---');
      const hashedPassword = await bcrypt.hash('SuperAdmin@123', 10);
      superAdmin = await User.create({
        studentId: 'SUPERADMIN-001',
        name: 'System Super Admin',
        email: 'superadmin@bookbuddy.com',
        password: hashedPassword,
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
    await mongoose.connection.close();
  }
}

seedSuperAdmin();
