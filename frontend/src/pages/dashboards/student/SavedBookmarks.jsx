import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Search, Tag, BookOpen, Trash2, Filter } from "lucide-react";
import apiClient from "../../../api/client";

export const SavedBookmarks = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");

  // Fetch saved bookmarks and annotations
  const {
    data: bookmarks = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["student-bookmarks"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/dashboards/student/bookmarks");
        return data.data || [];
      } catch {
        return [];
      }
    },
  });

  const availableTags = ["all", "exam-prep", "important", "quote", "research"];

  // Filter bookmarks by search text and tag chip
  const filteredBookmarks = bookmarks.filter((item) => {
    const matchesTag =
      selectedTag === "all" || (item.tags && item.tags.includes(selectedTag));
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      item.bookTitle?.toLowerCase().includes(query) ||
      item.highlightText?.toLowerCase().includes(query) ||
      item.noteText?.toLowerCase().includes(query) ||
      (item.tags && item.tags.some((t) => t.toLowerCase().includes(query)));
    return matchesTag && matchesSearch;
  });

  const handleDeleteBookmark = async (id) => {
    try {
      await apiClient.delete(`/dashboards/student/bookmarks/${id}`);
      refetch();
    } catch (err) {
      console.error("Failed to delete bookmark:", err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4">
      {/* Page Title & Search Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">
            Saved Bookmarks & Study Notes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Access all your saved text highlights, chapter bookmarks, and
            annotated study notes.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Search notes, quotes, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>
      </div>

      {/* Tag Filter Chip Row */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-b border-slate-100 dark:border-slate-800 pb-4">
        <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-2">
          <Filter size={14} /> Filter by Tag:
        </span>
        {availableTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
              selectedTag === tag
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            {tag === "all" ? "All Notes" : `#${tag}`}
          </button>
        ))}
      </div>

      {/* Content List */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 text-xs">
          Loading study notes...
        </div>
      ) : filteredBookmarks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 space-y-3">
          <Bookmark
            size={36}
            className="mx-auto text-slate-300 dark:text-slate-700"
          />
          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
            No study notes found
          </p>
          <p className="text-xs max-w-sm mx-auto">
            Select text while reading any EPUB or PDF e-resource to attach
            highlights, personal notes, and tags here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBookmarks.map((item) => {
            const colorClass =
              item.color === "green"
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-900 dark:text-emerald-200"
                : item.color === "blue"
                  ? "bg-sky-50 dark:bg-sky-950/30 border-sky-200 text-sky-900 dark:text-sky-200"
                  : item.color === "pink"
                    ? "bg-pink-50 dark:bg-pink-950/30 border-pink-200 text-pink-900 dark:text-pink-200"
                    : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-900 dark:text-amber-200";

            return (
              <div
                key={item._id || item.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Book Title & Page Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600">
                        <BookOpen size={16} />
                      </div>
                      <div>
                        <h3 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                          {item.bookTitle || "Book Title"}
                        </h3>
                        <p className="text-[10px] text-slate-400">
                          Page {item.page || 1}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteBookmark(item._id || item.id)}
                      className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                      title="Delete bookmark"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Highlighted text snippet */}
                  {item.highlightText && (
                    <div
                      className={`p-3 border-l-4 rounded-r-xl text-xs italic font-serif leading-relaxed ${colorClass}`}
                    >
                      "{item.highlightText}"
                    </div>
                  )}

                  {/* Inline Study Note */}
                  {item.noteText && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
                      <p className="font-semibold text-[10px] uppercase text-slate-400 mb-1">
                        Personal Note:
                      </p>
                      {item.noteText}
                    </div>
                  )}
                </div>

                {/* Tags Footer */}
                {item.tags && item.tags.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-1.5 border-t border-slate-100 dark:border-slate-800">
                    {item.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300"
                      >
                        <Tag size={10} /> #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SavedBookmarks;
