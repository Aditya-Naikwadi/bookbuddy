import { useState } from "react";
import {
  ListPlus,
  Bookmark,
  Share2,
  Lock,
  Globe,
  Trash2,
  Edit2,
  BookOpen,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import readingListApi from "../../../api/readingListApi";
import useAuthStore from "../../../store/authStore";

const ReadingLists = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedList, setSelectedList] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newVisibility, setNewVisibility] = useState("private");
  const [copiedId, setCopiedId] = useState(null);

  // Fetch lists from real backend
  const {
    data: listsResponse,
    isLoading: isLoadingLists,
    isError: isListsError,
    error: listsError,
  } = useQuery({
    queryKey: ["readingLists"],
    queryFn: () => readingListApi.getReadingLists({ limit: 50 }),
  });

  // Fetch bookmarks from real backend
  const { data: bookmarksResponse } = useQuery({
    queryKey: ["myBookmarks"],
    queryFn: () => readingListApi.getMyBookmarks(),
  });

  const lists = listsResponse?.data || [];
  const bookmarks = bookmarksResponse?.data || [];

  // Create list mutation
  const createMutation = useMutation({
    mutationFn: (payload) => readingListApi.createReadingList(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["readingLists"] });
      setIsCreateModalOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewVisibility("private");
    },
  });

  // Toggle visibility mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) =>
      readingListApi.updateReadingList(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["readingLists"] });
      if (selectedList) {
        setSelectedList(null);
      }
    },
  });

  // Delete list mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => readingListApi.deleteReadingList(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["readingLists"] });
      setSelectedList(null);
    },
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createMutation.mutate({
      title: newTitle.trim(),
      description: newDescription.trim(),
      visibility: newVisibility,
    });
  };

  const handleCopyShareLink = (listId) => {
    const url = `${window.location.origin}/student-dashboard/reading-lists?id=${listId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(listId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-edge/30 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
              Campus Collections
            </span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-ink">
            Curated Reading Lists
          </h1>
          <p className="text-sm text-muted mt-1">
            Discover and manage academic reading collections curated by students and faculty.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <ListPlus size={18} />
          <span>Create New List</span>
        </button>
      </div>

      {/* Main Content */}
      {isLoadingLists ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
          <p className="text-sm font-medium">Loading reading lists from catalog...</p>
        </div>
      ) : isListsError ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm">
          Failed to load reading lists: {listsError?.message || "Server connection error"}
        </div>
      ) : lists.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-edge/40 rounded-3xl bg-surface/50 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md">
            <h3 className="text-lg font-bold text-ink">No Reading Lists Found</h3>
            <p className="text-sm text-muted mt-1">
              You don&apos;t have any reading lists yet, and no public campus lists have been published. Create your first list to get started!
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-all shadow-md"
          >
            + Create First Reading List
          </button>
        </div>
      ) : (
        /* Reading Lists Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lists.map((list) => {
            const isOwner =
              list.ownerId?._id === user?.id || list.ownerId === user?.id;
            return (
              <div
                key={list._id}
                className="group relative bg-surface border border-edge/40 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:border-indigo-500/40 transition-all flex flex-col"
              >
                {/* Header Gradient Banner */}
                <div className="h-32 bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 p-5 flex flex-col justify-between relative overflow-hidden">
                  <div className="flex items-center justify-between z-10">
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border flex items-center gap-1.5 backdrop-blur-md ${
                        list.visibility === "public"
                          ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                          : "bg-amber-500/20 border-amber-500/30 text-amber-300"
                      }`}
                    >
                      {list.visibility === "public" ? (
                        <>
                          <Globe size={12} /> Public (Campus)
                        </>
                      ) : (
                        <>
                          <Lock size={12} /> Private (Only Me)
                        </>
                      )}
                    </span>

                    {isOwner && (
                      <button
                        onClick={() =>
                          deleteMutation.mutate(list._id)
                        }
                        title="Delete list"
                        className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg bg-black/30 backdrop-blur-md transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="z-10">
                    <h3 className="font-bold text-white text-lg line-clamp-1 group-hover:text-indigo-300 transition-colors">
                      {list.title}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      By {list.ownerId?.name || "Campus Contributor"}
                    </p>
                  </div>

                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
                </div>

                {/* Body & Meta */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <p className="text-xs text-muted line-clamp-2 min-h-[2rem]">
                    {list.description || "No description provided for this collection."}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-edge/20 text-xs">
                    <span className="text-slate-400 font-mono font-medium">
                      {list.items?.length || 0} Resource{list.items?.length === 1 ? "" : "s"}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyShareLink(list._id)}
                        title="Share list"
                        className="p-1.5 rounded-lg border border-edge/30 hover:bg-slate-800 text-slate-300 transition-colors flex items-center gap-1 text-[11px]"
                      >
                        {copiedId === list._id ? (
                          <>
                            <Check size={12} className="text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Share2 size={12} /> Share
                          </>
                        )}
                      </button>

                      {isOwner && (
                        <button
                          onClick={() =>
                            updateMutation.mutate({
                              id: list._id,
                              payload: {
                                visibility:
                                  list.visibility === "public"
                                    ? "private"
                                    : "public",
                              },
                            })
                          }
                          title="Toggle visibility"
                          className="px-2 py-1 rounded-lg border border-edge/30 hover:bg-slate-800 text-slate-300 transition-colors text-[11px] flex items-center gap-1"
                        >
                          <Edit2 size={11} />
                          {list.visibility === "public" ? "Make Private" : "Make Public"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bookmarks Section (Real Backend Persisted) */}
      <div className="mt-12 pt-8 border-t border-edge/30">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Bookmark size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">My Saved Bookmarks</h2>
            <p className="text-xs text-muted">
              Your personal reading location markers across e-resources ({bookmarks.length} saved).
            </p>
          </div>
        </div>

        {bookmarks.length === 0 ? (
          <div className="p-6 rounded-2xl bg-surface/40 border border-edge/20 text-center text-xs text-muted">
            No bookmarks created yet. Open any EPUB or PDF e-resource in the reader to drop persistent bookmarks.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bookmarks.map((b) => (
              <div
                key={b._id}
                className="p-4 rounded-xl bg-surface border border-edge/30 text-xs space-y-2"
              >
                <div className="font-semibold text-ink line-clamp-1">
                  {b.eresourceId?.title || "Digital E-Resource"}
                </div>
                <div className="text-slate-400 font-mono text-[11px]">
                  Ref: {b.locationRef}
                </div>
                {b.note && <div className="text-slate-300 italic">&ldquo;{b.note}&rdquo;</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Reading List Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <ListPlus className="text-indigo-400" size={20} />
                Create Campus Reading List
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Collection Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms Core Reads"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Briefly describe the target subject or course module..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Visibility Scope
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewVisibility("private")}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                      newVisibility === "private"
                        ? "bg-indigo-500/10 border-indigo-500 text-indigo-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <Lock size={16} />
                    <div>
                      <div className="text-xs font-bold text-white">Private</div>
                      <div className="text-[10px] text-slate-400">Only visible to me</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewVisibility("public")}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                      newVisibility === "public"
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <Globe size={16} />
                    <div>
                      <div className="text-xs font-bold text-white">Public</div>
                      <div className="text-[10px] text-slate-400">Visible to campus</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !newTitle.trim()}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingLists;
