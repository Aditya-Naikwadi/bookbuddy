import { openDB } from 'idb';

const DB_NAME = 'bookbuddy-offline-db';
const STORE_NAME = 'offline-resources';
const DB_VERSION = 1;

let dbPromise = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

/**
 * F10.6 — Storage Quota Guard
 * Checks browser granted storage quota before initiating download.
 * Warns or blocks if projected usage exceeds 90% of quota or safe threshold.
 * @param {number} projectedBytes Estimated file size in bytes
 * @returns {Promise<{ allowed: boolean, warningMessage?: string, quota?: number, usage?: number }>}
 */
export const checkStorageQuota = async (projectedBytes = 10 * 1024 * 1024) => {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const { quota = 0, usage = 0 } = await navigator.storage.estimate();
      const remainingSpace = quota - usage;
      const projectedTotalUsage = usage + projectedBytes;

      // Safe threshold: Block if projected usage > 90% of quota or remaining space < projectedBytes
      if (remainingSpace < projectedBytes || (quota > 0 && projectedTotalUsage > quota * 0.9)) {
        const remainingMB = (remainingSpace / (1024 * 1024)).toFixed(1);
        const projectedMB = (projectedBytes / (1024 * 1024)).toFixed(1);
        return {
          allowed: false,
          warningMessage: `Storage Quota Exceeded: Your browser has only ${remainingMB} MB remaining storage available, which is insufficient for this ${projectedMB} MB download.`,
          quota,
          usage,
        };
      }

      return { allowed: true, quota, usage, remainingSpace };
    } catch (err) {
      console.warn('[Storage Quota Check Warning]', err);
    }
  }

  // Fallback if navigator.storage is unsupported
  return { allowed: true };
};

/**
 * F10.5 — Download E-Resource to IndexedDB with progress events
 * @param {string} resourceId
 * @param {function} onProgress Callback (percentage, loaded, total)
 * @returns {Promise<object>} Stored IndexedDB record
 */
export const downloadEResource = async (resourceId, onProgress = () => {}) => {
  if (!resourceId) {
    throw new Error('Resource ID is required for download.');
  }

  // 1. Fetch short-lived signed URL from backend
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/v1/eresources/${resourceId}/download-url`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const urlData = await res.json();

  if (!res.ok || !urlData.success || !urlData.downloadUrl) {
    const errorMsg = urlData.message || 'Offline download is forbidden or unavailable for this resource.';
    throw new Error(errorMsg);
  }

  const { downloadUrl, data: meta } = urlData;

  // 2. Perform storage quota pre-check (F10.6)
  const quotaCheck = await checkStorageQuota(15 * 1024 * 1024);
  if (!quotaCheck.allowed) {
    throw new Error(quotaCheck.warningMessage);
  }

  // 3. Stream download with progress tracking
  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) {
    throw new Error('Failed to download file from signed URL.');
  }

  const contentLength = fileRes.headers.get('content-length');
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

  // Second quota check if totalBytes is known from Content-Length
  if (totalBytes > 0) {
    const exactQuotaCheck = await checkStorageQuota(totalBytes);
    if (!exactQuotaCheck.allowed) {
      throw new Error(exactQuotaCheck.warningMessage);
    }
  }

  const reader = fileRes.body ? fileRes.body.getReader() : null;
  let loadedBytes = 0;
  const chunks = [];

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loadedBytes += value.byteLength;

      const percentage = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 50;
      onProgress(percentage, loadedBytes, totalBytes);
    }
  } else {
    const blobData = await fileRes.blob();
    chunks.push(new Uint8Array(await blobData.arrayBuffer()));
    loadedBytes = blobData.size;
    onProgress(100, loadedBytes, loadedBytes);
  }

  const fileBlob = new Blob(chunks, {
    type: fileRes.headers.get('content-type') || 'application/pdf',
  });

  // 4. Save to IndexedDB
  const db = await getDB();
  const record = {
    id: resourceId,
    title: meta?.title || 'Downloaded E-Resource',
    blob: fileBlob,
    downloadedAt: Date.now(),
    sizeBytes: fileBlob.size,
    mimeType: fileBlob.type,
  };

  await db.put(STORE_NAME, record);
  onProgress(100, loadedBytes, loadedBytes);

  return record;
};

/**
 * Retrieve offline resource from IndexedDB
 * @param {string} resourceId
 * @returns {Promise<object|null>} IndexedDB record with objectUrl
 */
export const getOfflineResource = async (resourceId) => {
  if (!resourceId) return null;
  const db = await getDB();
  const record = await db.get(STORE_NAME, resourceId);

  if (!record || !record.blob) return null;

  return {
    ...record,
    objectUrl: URL.createObjectURL(record.blob),
  };
};

/**
 * Check if resource is stored in IndexedDB
 * @param {string} resourceId
 * @returns {Promise<boolean>}
 */
export const isResourceDownloaded = async (resourceId) => {
  if (!resourceId) return false;
  const db = await getDB();
  const record = await db.get(STORE_NAME, resourceId);
  return Boolean(record);
};

/**
 * Delete resource from IndexedDB
 * @param {string} resourceId
 */
export const deleteOfflineResource = async (resourceId) => {
  if (!resourceId) return;
  const db = await getDB();
  await db.delete(STORE_NAME, resourceId);
};

/**
 * Retrieve all offline downloaded resources from IndexedDB
 * @returns {Promise<Array<object>>} List of offline resource records
 */
export const getAllOfflineResources = async () => {
  const db = await getDB();
  const records = await db.getAll(STORE_NAME);
  return records.map((rec) => ({
    id: rec.id,
    title: rec.title || 'Untitled Resource',
    sizeBytes: rec.sizeBytes || (rec.blob ? rec.blob.size : 0),
    downloadedAt: rec.downloadedAt || Date.now(),
    mimeType: rec.mimeType || 'application/pdf',
  }));
};
