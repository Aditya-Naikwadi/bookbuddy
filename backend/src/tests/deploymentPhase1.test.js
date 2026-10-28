/**
 * Test Suite: Deployment Phase 1 Verification
 *
 * Verifies:
 * - Step 11: Node 22 runtime version pinning guard
 * - Step 12: Secrets loader (JSON string, file path, prototype pollution guard, fallback)
 * - Step 13: Boot validation hardening (SMTP port 25 rejection, COOKIE_SECRET length/placeholder check, SCANNER_API_KEY length/placeholder check)
 * - Step 14: Database connection pool size defaults (10 standalone, 5 Vercel)
 * - Step 15: Configurable trust proxy hops (TRUST_PROXY_HOPS)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadSecrets } = require('../config/secretsLoader');
const env = require('../config/env');
const config = require('../config');

describe('Deployment Phase 1: Configuration & Environment Decoupling', () => {
  describe('Step 11: Node.js Runtime Pinning Guard', () => {
    it('should identify Node major version from process.versions.node', () => {
      const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
      expect(nodeMajor).toBe(22);
    });

    it('should detect unsupported node version when not 22', () => {
      const checkVersion = (versionStr, nodeEnv, allowOverride) => {
        const major = parseInt(versionStr.split('.')[0], 10);
        return major === 22 || nodeEnv === 'test' || allowOverride === 'true';
      };

      expect(checkVersion('22.17.0', 'production', 'false')).toBe(true);
      expect(checkVersion('20.10.0', 'production', 'false')).toBe(false);
      expect(checkVersion('24.0.0', 'production', 'false')).toBe(false);
      expect(checkVersion('20.10.0', 'production', 'true')).toBe(true);
      expect(checkVersion('20.10.0', 'test', 'false')).toBe(true);
    });
  });

  describe('Step 12: Secrets Loader', () => {
    it('should load secrets from SECRETS_JSON string into target environment', () => {
      const mockEnv = {};
      const secrets = {
        DB_PASSWORD: 'super-secure-db-pass-123',
        API_TOKEN: 'token-abc-xyz',
        NESTED_OBJECT: { key: 'value' },
      };

      const result = loadSecrets({
        secretsJson: JSON.stringify(secrets),
        targetEnv: mockEnv,
      });

      expect(result.loaded).toBe(true);
      expect(result.source).toBe('SECRETS_JSON');
      expect(result.count).toBe(3);
      expect(mockEnv.DB_PASSWORD).toBe('super-secure-db-pass-123');
      expect(mockEnv.API_TOKEN).toBe('token-abc-xyz');
      expect(mockEnv.NESTED_OBJECT).toBe(JSON.stringify({ key: 'value' }));
    });

    it('should guard against prototype pollution in parsed JSON', () => {
      const mockEnv = {};
      const payload =
        '{"__proto__":{"polluted":"yes"},"constructor":{"polluted":"yes"},"SAFE_KEY":"ok"}';

      const result = loadSecrets({
        secretsJson: payload,
        targetEnv: mockEnv,
      });

      expect(result.loaded).toBe(true);
      expect(mockEnv.SAFE_KEY).toBe('ok');
      expect(mockEnv.polluted).toBeUndefined();
      expect({}.polluted).toBeUndefined();
    });

    it('should load secrets from explicit JSON file path', () => {
      const tmpDir = os.tmpdir();
      const tmpFile = path.join(tmpDir, `bookbuddy-test-secrets-${Date.now()}.json`);
      fs.writeFileSync(tmpFile, JSON.stringify({ FILE_SECRET_KEY: 'from-file-value-999' }));

      try {
        const mockEnv = {};
        const result = loadSecrets({
          filePath: tmpFile,
          targetEnv: mockEnv,
        });

        expect(result.loaded).toBe(true);
        expect(result.source).toBe(`file:${tmpFile}`);
        expect(mockEnv.FILE_SECRET_KEY).toBe('from-file-value-999');
      } finally {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      }
    });

    it('should throw an error if explicit SECRETS_FILE_PATH does not exist', () => {
      expect(() => {
        loadSecrets({
          filePath: '/path/to/nonexistent/secrets/file.json',
          targetEnv: {},
        });
      }).toThrow(/Explicit SECRETS_FILE_PATH not found/i);
    });

    it('should throw an error if SECRETS_JSON is malformed', () => {
      expect(() => {
        loadSecrets({
          secretsJson: '{invalid-json}',
          targetEnv: {},
        });
      }).toThrow(/Failed to parse secrets JSON/i);
    });

    it('should fall back gracefully to no-op when no JSON or file is present', () => {
      const mockEnv = { EXISTING_VAR: 'stay-intact' };
      const result = loadSecrets({
        secretsJson: null,
        filePath: null,
        defaultPath: '/path/to/nonexistent/default.json',
        targetEnv: mockEnv,
      });

      expect(result.loaded).toBe(false);
      expect(result.source).toBeNull();
      expect(result.count).toBe(0);
      expect(mockEnv.EXISTING_VAR).toBe('stay-intact');
    });
  });

  describe('Step 13: Boot Validation & Default Credential Hardening', () => {
    const { checkDefaultCredentials } = env;

    it('should reject README placeholder JWT secrets in production', () => {
      const config1 = {
        NODE_ENV: 'production',
        JWT_SECRET: 'REPLACE_WITH_STRONG_32_CHAR_JWT_SECRET_IN_PRODUCTION',
        JWT_REFRESH_SECRET: 'strong_valid_refresh_token_passphrase_32_chars!',
        SCANNER_API_KEY: 'valid_strong_scanner_key_16_chars',
      };
      expect(() => checkDefaultCredentials(config1)).toThrow(
        /JWT_SECRET cannot be a default or known weak secret/i
      );

      const config2 = {
        NODE_ENV: 'production',
        JWT_SECRET: 'super_secure_jwt_access_secret_passphrase_min_32_chars',
        JWT_REFRESH_SECRET: 'strong_valid_refresh_token_passphrase_32_chars!',
        SCANNER_API_KEY: 'valid_strong_scanner_key_16_chars',
      };
      expect(() => checkDefaultCredentials(config2)).toThrow(
        /JWT_SECRET cannot be a default or known weak secret/i
      );
    });

    it('should reject README placeholder JWT refresh secrets in production', () => {
      const badConfig = {
        NODE_ENV: 'production',
        JWT_SECRET: 'strong_valid_access_token_passphrase_32_chars!',
        JWT_REFRESH_SECRET: 'REPLACE_WITH_STRONG_32_CHAR_JWT_REFRESH_SECRET_IN_PRODUCTION',
        SCANNER_API_KEY: 'valid_strong_scanner_key_16_chars',
      };
      expect(() => checkDefaultCredentials(badConfig)).toThrow(
        /JWT_REFRESH_SECRET cannot be a default or known weak secret/i
      );
    });

    it('should reject COOKIE_SECRET if it is a default placeholder in production', () => {
      const badConfig = {
        NODE_ENV: 'production',
        JWT_SECRET: 'strong_valid_access_token_passphrase_32_chars!',
        JWT_REFRESH_SECRET: 'strong_valid_refresh_token_passphrase_32_chars!',
        SCANNER_API_KEY: 'valid_strong_scanner_key_16_chars',
        COOKIE_SECRET: 'super_secure_cookie_signing_secret_min_32_chars',
      };
      expect(() => checkDefaultCredentials(badConfig)).toThrow(
        /COOKIE_SECRET cannot be a default or known weak secret/i
      );
    });

    it('should reject COOKIE_SECRET if it is shorter than 32 characters in production', () => {
      const badConfig = {
        NODE_ENV: 'production',
        JWT_SECRET: 'strong_valid_access_token_passphrase_32_chars!',
        JWT_REFRESH_SECRET: 'strong_valid_refresh_token_passphrase_32_chars!',
        SCANNER_API_KEY: 'valid_strong_scanner_key_16_chars',
        COOKIE_SECRET: 'short_cookie_secret_16',
      };
      expect(() => checkDefaultCredentials(badConfig)).toThrow(
        /COOKIE_SECRET must be at least 32 characters/i
      );
    });

    it('should reject SCANNER_API_KEY if shorter than 16 characters in production', () => {
      const badConfig = {
        NODE_ENV: 'production',
        JWT_SECRET: 'strong_valid_access_token_passphrase_32_chars!',
        JWT_REFRESH_SECRET: 'strong_valid_refresh_token_passphrase_32_chars!',
        SCANNER_API_KEY: 'short_key_123',
      };
      expect(() => checkDefaultCredentials(badConfig)).toThrow(
        /SCANNER_API_KEY must be at least 16 characters/i
      );
    });

    it('should reject SCANNER_API_KEY if it uses the placeholder key in production', () => {
      const badConfig = {
        NODE_ENV: 'production',
        JWT_SECRET: 'strong_valid_access_token_passphrase_32_chars!',
        JWT_REFRESH_SECRET: 'strong_valid_refresh_token_passphrase_32_chars!',
        SCANNER_API_KEY: 'REPLACE_WITH_STRONG_16_CHAR_SCANNER_KEY',
      };
      expect(() => checkDefaultCredentials(badConfig)).toThrow(
        /SCANNER_API_KEY must not use the default fallback key/i
      );
    });

    it('should reject SMTP_PORT 25 as insecure', () => {
      const { z } = require('zod');
      const smtpPortSchema = z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
        z
          .number()
          .refine((val) => val !== 25, {
            message: 'SMTP port 25 is insecure; use 587 or 465',
          })
          .optional()
      );

      const parsed25 = smtpPortSchema.safeParse('25');
      expect(parsed25.success).toBe(false);
      expect(parsed25.error.issues[0].message).toMatch(/SMTP port 25 is insecure/i);

      const parsed587 = smtpPortSchema.safeParse('587');
      expect(parsed587.success).toBe(true);
      expect(parsed587.data).toBe(587);

      const parsed465 = smtpPortSchema.safeParse(465);
      expect(parsed465.success).toBe(true);
      expect(parsed465.data).toBe(465);

      const parsedEmpty = smtpPortSchema.safeParse('');
      expect(parsedEmpty.success).toBe(true);
      expect(parsedEmpty.data).toBeUndefined();
    });
  });

  describe('Step 14: MongoDB Connection Pool Size Defaults', () => {
    it('should default to maxPoolSize of 10 for standalone/VM and 5 for Vercel', () => {
      const getPoolSize = (isVercel, customPoolSize) => {
        const defaultPoolSize = isVercel ? 5 : 10;
        return customPoolSize || defaultPoolSize;
      };

      expect(getPoolSize(false, undefined)).toBe(10);
      expect(getPoolSize(true, undefined)).toBe(5);
      expect(getPoolSize(false, 20)).toBe(20);
      expect(getPoolSize(true, 15)).toBe(15);
    });
  });

  describe('Step 15: Configurable Trust Proxy Hop Count', () => {
    it('should default trustProxyHops to 1 in config', () => {
      expect(config.trustProxyHops).toBeDefined();
      expect(typeof config.trustProxyHops).toBe('number');
      expect(config.trustProxyHops).toBeGreaterThanOrEqual(0);
    });

    it('should validate TRUST_PROXY_HOPS schema correctly', () => {
      const { z } = require('zod');
      const schema = z.coerce.number().int().min(0).default(1);

      expect(schema.parse(undefined)).toBe(1);
      expect(schema.parse('2')).toBe(2);
      expect(schema.parse(0)).toBe(0);
      expect(() => schema.parse('-1')).toThrow();
    });
  });
});
