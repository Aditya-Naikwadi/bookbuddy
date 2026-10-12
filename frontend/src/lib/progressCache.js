import { openDB } from "idb";

const DB_NAME = "bookbuddy-progress-db";
const STORE_NAME = "reading-progress";
const DB_VERSION = 2;

let dbPromise = null;

export const resetDbPromise = () => {
  dbPromise = null;
};

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion) {
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      },
    });
  }
  return dbPromise;
};

const computeKey = (resourceId, userId) => {
  return `${userId || "default_user"}_${resourceId}`;
};

/**
 * Persist reading progress data locally in IndexedDB scoped by user
 * @param {string} resourceId
 * @param {object|any} data
 * @param {string|null} [userId=null]
 */
export const setLocalProgress = async (
  resourceId,
  data,
  maybeUserId = null,
) => {
  if (!resourceId) return null;
  const db = await getDB();
  const userId =
    maybeUserId || (typeof data === "object" && data?.userId) || "default_user";
  const id = computeKey(resourceId, userId);
  const record =
    typeof data === "object" && data !== null
      ? { ...data, id, resourceId, userId }
      : { id, resourceId, data, userId };
  await db.put(STORE_NAME, record);
  return record;
};

/**
 * Retrieve cached reading progress from IndexedDB by resourceId and userId
 * @param {string} resourceId
 * @param {string|null} [userId=null]
 * @returns {Promise<object|null>}
 */
export const getLocalProgress = async (resourceId, userId = null) => {
  if (!resourceId) return null;
  const db = await getDB();
  const id = computeKey(resourceId, userId);
  const record = await db.get(STORE_NAME, id);
  return record || null;
};

/**
 * Clear cached reading progress for a user or entirely
 * @param {string|null} [userId=null]
 */
export const clearLocalProgress = async (userId = null) => {
  try {
    const db = await getDB();
    if (!userId) {
      await db.clear(STORE_NAME);
      return;
    }
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    let cursor = await store.openCursor();
    const prefix = `${userId}_`;
    while (cursor) {
      if (cursor.key && String(cursor.key).startsWith(prefix)) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch {
    // ignore
  }
};
