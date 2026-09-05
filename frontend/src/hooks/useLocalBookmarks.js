import { useState, useEffect } from "react";
import { toast } from "../store/toastStore";

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
      toast.success("Bookmark Saved", `Saved "${item.title || "Item"}" to your collection.`);
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
