import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  checkStorageQuota,
  isResourceDownloaded,
  getOfflineResource,
  deleteOfflineResource,
} from '../lib/downloadManager';

describe('F10.5 & F10.6 — downloadManager & Storage Quota Guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('F10.6 — Storage Quota Guard', () => {
    it('Acceptance Criteria: blocks download and returns warning if projected usage exceeds quota', async () => {
      // Mock navigator.storage.estimate to simulate near-full quota (95% used)
      vi.stubGlobal('navigator', {
        storage: {
          estimate: async () => ({
            quota: 100 * 1024 * 1024, // 100 MB quota
            usage: 95 * 1024 * 1024, // 95 MB used
          }),
        },
      });

      const result = await checkStorageQuota(10 * 1024 * 1024); // Requesting 10 MB

      // ACCEPTANCE CRITERIA: Returns allowed: false with warning message before download starts
      expect(result.allowed).toBe(false);
      expect(result.warningMessage).toContain('Storage Quota Exceeded');
    });

    it('allows download when ample storage space is available', async () => {
      vi.stubGlobal('navigator', {
        storage: {
          estimate: async () => ({
            quota: 1000 * 1024 * 1024, // 1 GB quota
            usage: 10 * 1024 * 1024, // 10 MB used
          }),
        },
      });

      const result = await checkStorageQuota(10 * 1024 * 1024);
      expect(result.allowed).toBe(true);
    });
  });

  describe('F10.5 — IndexedDB Offline Storage Helper API', () => {
    it('returns false for uncached resourceId', async () => {
      const isDL = await isResourceDownloaded('non-existent-res-id');
      expect(isDL).toBe(false);
    });

    it('returns null when getting offline resource that does not exist', async () => {
      const rec = await getOfflineResource('non-existent-res-id');
      expect(rec).toBeNull();
    });
  });
});
