import { openDB } from "idb";

const DB_NAME = "bookbuddy-progress-db";
const STORE_NAME = "reading-progress";
const DB_VERSION = 1;

let dbPromise = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "resourceId" });
        }
      },
    });
  }
  return dbPromise;
};

/**
 * Persist reading progress data locally in IndexedDB
 * @param {string} resourceId
 * @param {object|any} data
 */
export const setLocalProgress = async (resourceId, data) => {
  if (!resourceId) return null;
  const db = await getDB();
  const record =
    typeof data === "object" && data !== null
      ? { ...data, resourceId }
      : { resourceId, data };
  await db.put(STORE_NAME, record);
  return record;
};

/**
 * Retrieve cached reading progress from IndexedDB by resourceId
 * @param {string} resourceId
 * @returns {Promise<object|null>}
 */
export const getLocalProgress = async (resourceId) => {
  if (!resourceId) return null;
  const db = await getDB();
  const record = await db.get(STORE_NAME, resourceId);
  return record || null;
};
