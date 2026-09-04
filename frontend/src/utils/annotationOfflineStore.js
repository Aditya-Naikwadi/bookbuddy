import { syncAnnotationsApi } from "../api/annotationApi";

const QUEUE_KEY = "bookbuddy_offline_annotations_queue";

/**
 * Get queued offline annotations from storage
 */
export const getOfflineQueue = () => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Queue an annotation for offline sync
 */
export const queueOfflineAnnotation = (bookId, annotationData) => {
  const queue = getOfflineQueue();
  const clientId =
    annotationData.clientId ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  const newItem = {
    ...annotationData,
    bookId,
    clientId,
    queuedAt: new Date().toISOString(),
  };

  queue.push(newItem);
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("Failed to queue offline annotation:", err);
  }
  return newItem;
};

/**
 * Clear or filter synced items from offline queue
 */
export const clearOfflineQueue = (syncedClientIds = null) => {
  if (!syncedClientIds) {
    localStorage.removeItem(QUEUE_KEY);
    return;
  }
  const queue = getOfflineQueue();
  const remaining = queue.filter(
    (item) => !syncedClientIds.includes(item.clientId),
  );
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
};

/**
 * Flush offline queue to server
 */
export const flushOfflineQueue = async (bookId) => {
  const queue = getOfflineQueue();
  if (!queue.length) return { syncedCount: 0 };

  const bookItems = bookId
    ? queue.filter((item) => item.bookId === bookId)
    : queue;
  if (!bookItems.length) return { syncedCount: 0 };

  try {
    const res = await syncAnnotationsApi(
      bookId || bookItems[0].bookId,
      bookItems,
    );
    if (res.success) {
      const syncedIds = bookItems.map((i) => i.clientId);
      clearOfflineQueue(syncedIds);
    }
    return res;
  } catch (err) {
    console.warn("Offline annotation sync flush paused:", err.message);
    return { success: false, error: err.message };
  }
};

// Register automatic window online listener for background queue flush
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushOfflineQueue();
  });
}
