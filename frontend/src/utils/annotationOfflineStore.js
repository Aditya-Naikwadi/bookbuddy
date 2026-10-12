import { syncAnnotationsApi } from "../api/annotationApi";

export const getQueueKey = (userId) => {
  return userId
    ? `bookbuddy_offline_annotations_queue_${userId}`
    : "bookbuddy_offline_annotations_queue_guest";
};

/**
 * Get queued offline annotations from storage for a specific user
 */
export const getOfflineQueue = (userId = null) => {
  try {
    const key = getQueueKey(userId);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Queue an annotation for offline sync scoped to a specific user
 */
export const queueOfflineAnnotation = (
  bookId,
  annotationData,
  userId = null,
) => {
  const effectiveUserId = userId || annotationData.userId || null;

  const queue = getOfflineQueue(effectiveUserId);
  const clientId =
    annotationData.clientId ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  const newItem = {
    ...annotationData,
    bookId,
    clientId,
    userId: effectiveUserId,
    queuedAt: new Date().toISOString(),
  };

  queue.push(newItem);
  try {
    const key = getQueueKey(effectiveUserId);
    localStorage.setItem(key, JSON.stringify(queue));
  } catch (err) {
    console.error("Failed to queue offline annotation:", err);
  }
  return newItem;
};

/**
 * Clear or filter synced items from offline queue for a specific user
 */
export const clearOfflineQueue = (syncedClientIds = null, userId = null) => {
  const key = getQueueKey(userId);
  if (!syncedClientIds) {
    try {
      localStorage.removeItem(key);
      localStorage.removeItem("bookbuddy_offline_annotations_queue");
    } catch {
      // ignore
    }
    return;
  }
  const queue = getOfflineQueue(userId);
  const remaining = queue.filter(
    (item) => !syncedClientIds.includes(item.clientId),
  );
  try {
    localStorage.setItem(key, JSON.stringify(remaining));
  } catch {
    // ignore
  }
};

/**
 * Flush offline queue to server strictly for the matching user
 */
export const flushOfflineQueue = async (bookId = null, userId = null) => {
  const queue = getOfflineQueue(userId);
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
      clearOfflineQueue(syncedIds, userId);
    }
    return res;
  } catch (err) {
    console.warn("Offline annotation sync flush paused:", err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Clear all offline queues for a user on logout
 */
export const clearAllOfflineQueues = (userId = null) => {
  try {
    if (userId) {
      localStorage.removeItem(getQueueKey(userId));
    }
    localStorage.removeItem("bookbuddy_offline_annotations_queue_guest");
    localStorage.removeItem("bookbuddy_offline_annotations_queue");
  } catch {
    // ignore
  }
};

// Register automatic window online listener for background queue flush
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushOfflineQueue();
  });
}
