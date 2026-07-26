import { useState, useEffect } from "react";

const LOCAL_STORAGE_KEY = "bookbuddy_public_bookmarks";

export const useLocalBookmarks = () => {
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bookmarks));
    } catch (err) {
      console.warn("Failed to save bookmarks to localStorage:", err);
    }
  }, [bookmarks]);

  const addBookmark = (item) => {
    setBookmarks((prev) => {
      if (prev.some((b) => b.id === item.id || b._id === item._id)) return prev;
      return [...prev, { ...item, savedAt: new Date().toISOString() }];
    });
  };

  const removeBookmark = (id) => {
    setBookmarks((prev) => prev.filter((b) => (b.id || b._id) !== id));
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
