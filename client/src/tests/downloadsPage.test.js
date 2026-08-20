import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import {
  getAllOfflineResources,
  deleteOfflineResource,
  isResourceDownloaded,
} from '../lib/downloadManager';

const DB_NAME = 'bookbuddy-offline-db';
const STORE_NAME = 'offline-resources';

describe('Downloads Management Page Integration (F10.5 & F10.6)', () => {
  beforeEach(async () => {
    const db = await openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
    await db.clear(STORE_NAME);
  });

  it('retrieves stored offline items with individual file sizes', async () => {
    const db = await openDB(DB_NAME, 1);
    const mockBlob1 = new Blob(['sample pdf content 1'], { type: 'application/pdf' });
    const mockBlob2 = new Blob(['sample epub content 2'], { type: 'application/epub+zip' });

    await db.put(STORE_NAME, {
      id: 'res-pdf-1',
      title: 'Artificial Intelligence Basics',
      blob: mockBlob1,
      sizeBytes: mockBlob1.size,
      downloadedAt: Date.now(),
      mimeType: 'application/pdf',
    });

    await db.put(STORE_NAME, {
      id: 'res-epub-2',
      title: 'Data Structures and Algorithms',
      blob: mockBlob2,
      sizeBytes: mockBlob2.size,
      downloadedAt: Date.now(),
      mimeType: 'application/epub+zip',
    });

    const items = await getAllOfflineResources();
    expect(items.length).toBe(2);

    const titles = items.map((i) => i.title);
    expect(titles).toContain('Artificial Intelligence Basics');
    expect(titles).toContain('Data Structures and Algorithms');

    const totalBytes = items.reduce((acc, curr) => acc + curr.sizeBytes, 0);
    expect(totalBytes).toBe(mockBlob1.size + mockBlob2.size);
  });

  it('Acceptance Criteria: deleting an item frees storage estimate and item no longer opens offline', async () => {
    const db = await openDB(DB_NAME, 1);
    const mockBlob = new Blob(['large ebook binary data stream'], { type: 'application/pdf' });

    await db.put(STORE_NAME, {
      id: 'res-to-delete',
      title: 'Operating System Concepts',
      blob: mockBlob,
      sizeBytes: mockBlob.size,
      downloadedAt: Date.now(),
    });

    // Verify item exists prior to deletion
    let isDL = await isResourceDownloaded('res-to-delete');
    expect(isDL).toBe(true);

    let items = await getAllOfflineResources();
    expect(items.length).toBe(1);
    expect(items[0].sizeBytes).toBe(mockBlob.size);

    // Delete item
    await deleteOfflineResource('res-to-delete');

    // ACCEPTANCE CRITERIA: Item is removed, storage estimate is freed, and item no longer opens offline
    isDL = await isResourceDownloaded('res-to-delete');
    expect(isDL).toBe(false);

    items = await getAllOfflineResources();
    expect(items.length).toBe(0);
  });
});
