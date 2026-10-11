/**
 * Test Suite: Vulnerable Dependencies and Supply Chain Security Audit (Security Topic 21)
 *
 * Verifies that:
 * 1. Monorepo manifests and lockfiles enforce modern runtime versions (Node >= 22).
 * 2. Dependency CVE triage registry (config/audit-triage.json) permits 0 High or Critical CVEs.
 * 3. All triaged moderate advisories contain complete architectural rationale and active expiration dates.
 * 4. Production Dockerfile base images use supported, active LTS releases (node:22-alpine).
 * 5. Automated dependency vulnerability monitoring (Dependabot configuration) is active.
 * 6. Manifest dependencies adhere to safe naming standards with zero suspicious or typosquatted packages.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../../');
const backendDir = path.resolve(__dirname, '../../');
const frontendDir = path.resolve(__dirname, '../../../frontend');

describe('Security Topic 21: Update Vulnerable Dependencies & Supply Chain Audit', () => {
  describe('1. Manifest & Runtime Engine Hardening', () => {
    it('should declare Node >= 22 engines across root, backend, and frontend manifests', () => {
      const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
      const backendPkg = JSON.parse(fs.readFileSync(path.join(backendDir, 'package.json'), 'utf8'));
      const frontendPkg = JSON.parse(
        fs.readFileSync(path.join(frontendDir, 'package.json'), 'utf8')
      );

      expect(rootPkg.engines?.node).toMatch(/>=22/);
      expect(backendPkg.engines?.node).toMatch(/>=22/);
      expect(frontendPkg.engines?.node).toMatch(/>=22/);
    });

    it('should maintain locked package-lock.json files for reproducible installs', () => {
      expect(fs.existsSync(path.join(rootDir, 'package-lock.json'))).toBe(true);
      expect(fs.existsSync(path.join(frontendDir, 'package-lock.json'))).toBe(true);
    });
  });

  describe('2. CVE Triage Registry & Zero High/Critical Policy', () => {
    const triagePath = path.join(rootDir, 'config/audit-triage.json');

    it('should have an active audit triage file', () => {
      expect(fs.existsSync(triagePath)).toBe(true);
    });

    it('should strictly prohibit High or Critical severity entries in audit-triage.json', () => {
      const triage = JSON.parse(fs.readFileSync(triagePath, 'utf8'));
      const advisories = triage.triagedAdvisories || [];

      for (const entry of advisories) {
        expect(['moderate', 'low', 'info']).toContain(entry.severity.toLowerCase());
        expect(entry.severity.toLowerCase()).not.toBe('high');
        expect(entry.severity.toLowerCase()).not.toBe('critical');
      }
    });

    it('should ensure all triaged advisories have architectural rationale and non-expired review dates', () => {
      const triage = JSON.parse(fs.readFileSync(triagePath, 'utf8'));
      const advisories = triage.triagedAdvisories || [];
      const now = new Date();

      expect(advisories.length).toBeGreaterThan(0);

      for (const entry of advisories) {
        expect(entry.packageName).toBeDefined();
        expect(entry.rationale).toBeDefined();
        expect(entry.rationale.length).toBeGreaterThan(15);
        expect(entry.acceptedBy).toBeDefined();
        expect(entry.expiresAt).toBeDefined();

        const expiry = new Date(entry.expiresAt);
        expect(expiry.getTime()).toBeGreaterThan(now.getTime());
      }
    });
  });

  describe('3. Docker Base Image & Container Security', () => {
    it('should use Node 22 Alpine active LTS base images in backend Dockerfile', () => {
      const dockerfilePath = path.join(backendDir, 'Dockerfile');
      expect(fs.existsSync(dockerfilePath)).toBe(true);

      const content = fs.readFileSync(dockerfilePath, 'utf8');
      expect(content).toMatch(/FROM\s+node:22-alpine\s+AS\s+build/);
      expect(content).toMatch(/FROM\s+node:22-alpine\s+AS\s+production/);
      // Ensure obsolete node 20 or node 18 are not referenced
      expect(content).not.toMatch(/node:1[4-9]/);
      expect(content).not.toMatch(/node:20/);
    });

    it('should drop root privileges and run as non-root user in production image', () => {
      const content = fs.readFileSync(path.join(backendDir, 'Dockerfile'), 'utf8');
      expect(content).toMatch(/USER\s+node/);
    });
  });

  describe('4. Automated Vulnerability Monitoring (Dependabot)', () => {
    it('should configure Dependabot for root, backend, frontend, Docker, and GitHub Actions', () => {
      const dependabotPath = path.join(rootDir, '.github/dependabot.yml');
      expect(fs.existsSync(dependabotPath)).toBe(true);

      const content = fs.readFileSync(dependabotPath, 'utf8');
      expect(content).toContain('package-ecosystem: "npm"');
      expect(content).toContain('package-ecosystem: "docker"');
      expect(content).toContain('package-ecosystem: "github-actions"');
      expect(content).toContain('interval: "weekly"');
    });
  });

  describe('5. Dependency Package Name Sanity Check', () => {
    it('should not contain known suspicious or typosquatted dependencies', () => {
      const backendPkg = JSON.parse(fs.readFileSync(path.join(backendDir, 'package.json'), 'utf8'));
      const frontendPkg = JSON.parse(
        fs.readFileSync(path.join(frontendDir, 'package.json'), 'utf8')
      );

      const allDeps = [
        ...Object.keys(backendPkg.dependencies || {}),
        ...Object.keys(backendPkg.devDependencies || {}),
        ...Object.keys(frontendPkg.dependencies || {}),
        ...Object.keys(frontendPkg.devDependencies || {}),
      ];

      const suspiciousPatterns = [
        /cross-env-shell/,
        /mongooose/,
        /exxpress/,
        /reactt/,
        /axioos/,
        /lodashe/,
        /colors-corrupted/,
      ];

      for (const dep of allDeps) {
        for (const pattern of suspiciousPatterns) {
          expect(dep).not.toMatch(pattern);
        }
      }
    });
  });
});
