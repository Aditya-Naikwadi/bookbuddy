import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "../store/toastStore";
import useAuthStore from "../store/authStore";

export const getBookmarkStorageKey = (userId) => {
  return userId ? `bookbuddy_bookmarks_${userId}` : "bookbuddy_bookmarks_guest";
};

export const clearLocalBookmarks = (userId) => {
  try {
    const key = getBookmarkStorageKey(userId);
    localStorage.removeItem(key);
    // Also remove legacy un-namespaced key if present
    localStorage.removeItem("bookbuddy_public_bookmarks");
  } catch {
    // ignore local storage errors
  }
};

export const useLocalBookmarks = () => {
  const { user } = useAuthStore();
  const userId = user?.id || user?._id || null;
  const storageKey = useMemo(() => getBookmarkStorageKey(userId), [userId]);

  const loadBookmarksFromStorage = useCallback(() => {
    try {
      const saved =
        localStorage.getItem(storageKey) ||
        localStorage.getItem("bookbuddy_public_bookmarks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, [storageKey]);

  const [prevStorageKey, setPrevStorageKey] = useState(storageKey);
  const [bookmarks, setBookmarks] = useState(loadBookmarksFromStorage);

  // Synchronize state when user or storageKey changes without cascading effect renders
  if (prevStorageKey !== storageKey) {
    setPrevStorageKey(storageKey);
    setBookmarks(loadBookmarksFromStorage());
  }

  // Persist bookmarks whenever state updates
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(bookmarks));
    } catch (err) {
      console.warn("Failed to save bookmarks to localStorage:", err);
    }
  }, [bookmarks, storageKey]);

  const addBookmark = (item) => {
    setBookmarks((prev) => {
      if (prev.some((b) => b.id === item.id || b._id === item._id)) return prev;
      toast.success(
        "Bookmark Saved",
        `Saved "${item.title || "Item"}" to your collection.`,
      );
      return [...prev, { ...item, savedAt: new Date().toISOString() }];
    });
  };

  const removeBookmark = (id) => {
    setBookmarks((prev) => prev.filter((b) => (b.id || b._id) !== id));
    toast.info("Bookmark Removed", "Item removed from saved collection.");
  };

  const toggleBookmark = (item) => {
    const itemId = item.id || item._id;
    if (isBookmarked(itemId)) {
      removeBookmark(itemId);
    } else {
      addBookmark(item);
    }
  };

  const isBookmarked = (id) => {
    return bookmarks.some((b) => (b.id || b._id) === id);
  };

  const clearBookmarks = () => {
    setBookmarks([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    toast.info("Collection Cleared", "All saved items removed.");
  };

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    isBookmarked,
    clearBookmarks,
  };
};

export default useLocalBookmarks;
