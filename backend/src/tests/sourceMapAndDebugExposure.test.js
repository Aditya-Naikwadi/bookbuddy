/**
 * Test Suite: Source Map and Debug Leftovers Exposure Audit (Security Topic 18)
 *
 * Verifies that:
 * 1. Source map files (*.map) are completely blocked and return 404.
 * 2. Dotfiles and hidden resources (/.env, /.git/config, etc.) are blocked and return 404.
 * 3. Backup and temporary editor files (*.bak, *.swp, *.old, etc.) are blocked and return 404.
 * 4. Technology-disclosing headers (X-Powered-By) are eliminated.
 * 5. Production error handler omits verbose stack traces.
 * 6. Frontend production build artifacts contain zero .map files and zero sourceMappingURL references.
 */

require('./setupEnv');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../app');
const errorHandler = require('../middlewares/errorHandler');

describe('Security Topic 18: Source Map & Debug Leftovers Hardening', () => {
  describe('1. Source Map Exposure Prevention', () => {
    it('should return 404 for direct requests to bundle .map files', async () => {
      const res = await request(app).get('/assets/index.js.map');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('should return 404 for nested or vendor .map files', async () => {
      const res = await request(app).get('/dist/assets/vendor-react-B2ZyopSm.js.map');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 for API path source map probes', async () => {
      const res = await request(app).get('/api/v1/auth/login.js.map');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 for query parameter source map probes', async () => {
      const res = await request(app).get('/main.map?v=123');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Dotfiles and Sensitive Directory Blocking', () => {
    it('should return 404 when requesting /.env or variations', async () => {
      const variations = ['/.env', '/.env.production', '/.env.local', '/backend/.env'];
      for (const uri of variations) {
        const res = await request(app).get(uri);
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      }
    });

    it('should return 404 when requesting git repository metadata', async () => {
      const gitPaths = ['/.git/config', '/.git/HEAD', '/.gitignore'];
      for (const uri of gitPaths) {
        const res = await request(app).get(uri);
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      }
    });

    it('should return 404 for hidden editor or OS files', async () => {
      const paths = ['/.DS_Store', '/.vscode/settings.json', '/.bash_history'];
      for (const uri of paths) {
        const res = await request(app).get(uri);
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      }
    });

    it('should allow standard RFC 8615 .well-known paths past the dotfile filter', async () => {
      const res = await request(app).get('/.well-known/security.txt');
      // Should reach normal routing (not intercepted by the dotfile 404 blocker)
      expect(res.body.message).not.toBe('Resource not found');
    });
  });

  describe('3. Sensitive Backup and Editor Temp File Blocking', () => {
    it('should return 404 for backup files (.bak, .backup, .old, .orig, .save)', async () => {
      const backupUris = [
        '/database.bak',
        '/users.backup',
        '/config.old',
        '/app.js.orig',
        '/schema.save',
      ];
      for (const uri of backupUris) {
        const res = await request(app).get(uri);
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      }
    });

    it('should return 404 for editor swap and temporary files (.swp, .tmp, ~)', async () => {
      const tempUris = ['/app.js.swp', '/dump.tmp', '/index.js~'];
      for (const uri of tempUris) {
        const res = await request(app).get(uri);
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      }
    });
  });

  describe('4. Framework Fingerprinting & Header Disclosure', () => {
    it('should never expose X-Powered-By header on API responses', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('should never expose X-Powered-By header on 404 responses', async () => {
      const res = await request(app).get('/non-existent-route-for-test');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('5. Error Stack Trace Sanitation in Production', () => {
    it('should omit stack trace from error response when NODE_ENV is production', () => {
      const mockReq = { id: 'req-test-123' };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockNext = jest.fn();

      const originalEnv = process.env.NODE_ENV;
      const config = require('../config');
      const originalConfigEnv = config.nodeEnv;

      try {
        config.nodeEnv = 'production';
        process.env.NODE_ENV = 'production';

        const err = new Error('Database query failure with sensitive internal info');
        err.stack = 'Error: Database query failure\n    at internalQuery (database.js:42:15)';

        errorHandler(err, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalled();
        const sentPayload = mockRes.json.mock.calls[0][0];

        expect(sentPayload.success).toBe(false);
        expect(sentPayload.stack).toBeUndefined();
        expect(sentPayload.message).toBe('An unexpected error occurred. Please contact support.');
      } finally {
        config.nodeEnv = originalConfigEnv;
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('6. Production Bundle Source Map Audit', () => {
    const distPath = path.resolve(__dirname, '../../../frontend/dist');

    it('should ensure frontend/dist build output contains 0 .map files', () => {
      if (!fs.existsSync(distPath)) {
        // If dist folder doesn't exist yet, pass test
        return;
      }

      function findMapFiles(dir) {
        let results = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results = results.concat(findMapFiles(fullPath));
          } else if (entry.name.endsWith('.map')) {
            results.push(fullPath);
          }
        }
        return results;
      }

      const mapFiles = findMapFiles(distPath);
      expect(mapFiles).toEqual([]);
    });

    it('should ensure compiled JavaScript bundles contain no sourceMappingURL directives', () => {
      const assetsPath = path.join(distPath, 'assets');
      if (!fs.existsSync(assetsPath)) {
        return;
      }

      const jsFiles = fs
        .readdirSync(assetsPath)
        .filter((file) => file.endsWith('.js') || file.endsWith('.mjs'));

      for (const file of jsFiles) {
        const content = fs.readFileSync(path.join(assetsPath, file), 'utf8');
        expect(content).not.toMatch(/\/\/# sourceMappingURL=/);
      }
    });
  });
});
