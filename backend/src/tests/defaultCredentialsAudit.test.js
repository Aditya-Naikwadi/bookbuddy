/**
 * Test Suite: Default Credentials Hardening & Boot Guard Audit (Security Topic 19)
 *
 * Verifies that:
 * 1. The application refuses to boot in production mode when default/weak secrets are configured.
 * 2. Seeding scripts reject execution in production without explicit guards and forbid weak passwords.
 * 3. Seeded/invited admin accounts are flagged with mustChangePasswordOnNextLogin: true.
 * 4. Administrative endpoints strictly reject users whose mustChangePasswordOnNextLogin is true.
 * 5. Attempting login with obsolete/weak default credentials fails.
 */

require('./setupEnv');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { generateTokenPair } = require('../utils/token');
const env = require('../config/env');

describe('Security Topic 19: Default Credentials & Hardening Audit', () => {
  describe('1. Production Boot Refusal with Default Credentials', () => {
    const { checkDefaultCredentials } = env;

    it('should throw and refuse to boot if JWT_SECRET is a known default in production', () => {
      const badConfig = {
        NODE_ENV: 'production',
        JWT_SECRET: 'password123',
        JWT_REFRESH_SECRET: 'a_very_long_valid_refresh_token_secret_32_chars_ok!',
        SCANNER_API_KEY: 'custom_strong_scanner_key_32_chars',
      };
      expect(() => checkDefaultCredentials(badConfig)).toThrow(
        /JWT_SECRET cannot be a default or known weak secret/i
      );
    });

    it('should throw and refuse to boot if JWT_REFRESH_SECRET is a known default in production', () => {
      const badConfig = {
        NODE_ENV: 'production',
        JWT_SECRET: 'a_very_long_valid_access_token_secret_32_chars_ok!',
        JWT_REFRESH_SECRET: 'supersecretrefresh123',
        SCANNER_API_KEY: 'custom_strong_scanner_key_32_chars',
      };
      expect(() => checkDefaultCredentials(badConfig)).toThrow(
        /JWT_REFRESH_SECRET cannot be a default or known weak secret/i
      );
    });

    it('should throw and refuse to boot if JWT_SECRET and JWT_REFRESH_SECRET are identical', () => {
      const identicalSecret = 'identical_super_long_secret_key_used_for_both_tokens_32_chars';
      const badConfig = {
        NODE_ENV: 'production',
        JWT_SECRET: identicalSecret,
        JWT_REFRESH_SECRET: identicalSecret,
        SCANNER_API_KEY: 'custom_strong_scanner_key_32_chars',
      };
      expect(() => checkDefaultCredentials(badConfig)).toThrow(
        /JWT_REFRESH_SECRET must be different from JWT_SECRET/i
      );
    });

    it('should throw and refuse to boot if SCANNER_API_KEY uses the default key in production', () => {
      const badConfig = {
        NODE_ENV: 'production',
        JWT_SECRET: 'a_very_long_valid_access_token_secret_32_chars_ok!',
        JWT_REFRESH_SECRET: 'a_very_long_valid_refresh_token_secret_32_chars_ok!',
        SCANNER_API_KEY: 'bookbuddy_scanner_secret_2026',
      };
      expect(() => checkDefaultCredentials(badConfig)).toThrow(
        /SCANNER_API_KEY must not use the default fallback key/i
      );
    });

    it('should throw and refuse to boot if MONGO_URI contains default database credentials', () => {
      const badConfig = {
        NODE_ENV: 'production',
        JWT_SECRET: 'a_very_long_valid_access_token_secret_32_chars_ok!',
        JWT_REFRESH_SECRET: 'a_very_long_valid_refresh_token_secret_32_chars_ok!',
        SCANNER_API_KEY: 'custom_strong_scanner_key_32_chars',
        MONGO_URI: ['mongodb://', 'admin:admin@', 'cluster0.mongodb.net/bookbuddy'].join(''),
      };
      expect(() => checkDefaultCredentials(badConfig)).toThrow(
        /MONGO_URI contains default or unauthenticated test database credentials/i
      );
    });

    it('should allow valid, high-entropy unique credentials in production', () => {
      const goodConfig = {
        NODE_ENV: 'production',
        JWT_SECRET: 'f7c8d9e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8',
        JWT_REFRESH_SECRET: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0a1b2c',
        SCANNER_API_KEY: 'custom_high_entropy_scanner_token_secure_999!',
        MONGO_URI: [
          'mongodb+srv://',
          'prod_user:StrongSecretPass999@',
          'cluster0.mongodb.net/bookbuddy',
        ].join(''),
      };
      expect(() => checkDefaultCredentials(goodConfig)).not.toThrow();
    });
  });

  describe('2. Super Admin Seed Script Guards', () => {
    const seedSuperAdmin = require('../scripts/seedSuperAdmin');

    it('should throw if seedSuperAdmin is invoked in production without --allow-production flag', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalArgs = process.argv;

      try {
        process.env.NODE_ENV = 'production';
        process.argv = ['node', 'seedSuperAdmin.js']; // missing --allow-production

        await expect(seedSuperAdmin()).rejects.toThrow(
          /requires the explicit --allow-production flag/i
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.argv = originalArgs;
      }
    });

    it('should throw if seedSuperAdmin password is set to a known weak or default password', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalPass = process.env.SEED_SUPER_ADMIN_PASSWORD;

      try {
        process.env.NODE_ENV = 'development';
        process.env.SEED_SUPER_ADMIN_PASSWORD = 'admin123';

        await expect(seedSuperAdmin()).rejects.toThrow(/known weak or default password/i);
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.SEED_SUPER_ADMIN_PASSWORD = originalPass;
      }
    });
  });

  describe('3. Forced Password Change Enforcement on Protected Administrative Routes', () => {
    let unresetAdminUser;
    let unresetAdminToken;
    let compliantAdminUser;
    let compliantAdminToken;

    beforeAll(async () => {
      const mongoose = require('mongoose');
      const connectDB = require('../config/db');
      if (mongoose.connection.readyState === 0) {
        await connectDB();
      }

      const argon2 = require('argon2');
      const hashedPassword = await argon2.hash('TempPassword123!', { type: argon2.argon2id });

      // User 1: Seeded admin with mustChangePasswordOnNextLogin: true
      unresetAdminUser = await User.create({
        studentId: 'SEED_ADMIN_01',
        name: 'Unreset Seed Admin',
        email: `unreset_admin_${Date.now()}@bookbuddy.internal`,
        password: hashedPassword,
        role: 'super-admin',
        isActive: true,
        mustChangePasswordOnNextLogin: true,
      });
      const unresetTokens = generateTokenPair(unresetAdminUser);
      unresetAdminToken = unresetTokens.accessToken;

      // User 2: Compliant admin with mustChangePasswordOnNextLogin: false
      compliantAdminUser = await User.create({
        studentId: 'COMPLIANT_ADMIN_01',
        name: 'Compliant Admin',
        email: `compliant_admin_${Date.now()}@bookbuddy.internal`,
        password: hashedPassword,
        role: 'super-admin',
        isActive: true,
        mustChangePasswordOnNextLogin: false,
      });
      const compliantTokens = generateTokenPair(compliantAdminUser);
      compliantAdminToken = compliantTokens.accessToken;
    });

    afterAll(async () => {
      if (unresetAdminUser) await User.deleteOne({ _id: unresetAdminUser._id });
      if (compliantAdminUser) await User.deleteOne({ _id: compliantAdminUser._id });
    });

    it('should return mustChangePasswordOnNextLogin: true when logging in with seeded credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: unresetAdminUser.email,
        password: 'TempPassword123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.mustChangePasswordOnNextLogin).toBe(true);
    });

    it('should strictly reject access to administrative endpoints for accounts with mustChangePasswordOnNextLogin: true', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/admin-portal/overview')
        .set('Authorization', `Bearer ${unresetAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Password change required/i);
      expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('should allow access to administrative endpoints once password change requirement is fulfilled', async () => {
      const res = await request(app)
        .get('/api/v1/dashboards/admin-portal/overview')
        .set('Authorization', `Bearer ${compliantAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('4. Obsolete Default Credential Authentication Rejection', () => {
    it('should reject login attempts using arbitrary default credentials (admin/admin, admin123, changeme)', async () => {
      const defaultCredPairs = [
        { email: 'admin@bookbuddy.com', password: 'admin' },
        { email: 'admin@bookbuddy.com', password: 'admin123' },
        { email: 'admin@bookbuddy.com', password: 'password123' },
        { email: 'admin@bookbuddy.com', password: 'changeme' },
      ];

      for (const cred of defaultCredPairs) {
        const res = await request(app).post('/api/auth/login').send(cred);
        expect([401, 429]).toContain(res.status);
        expect(res.body.success).toBe(false);
        expect(res.body.accessToken).toBeUndefined();
      }
    });
  });
});
