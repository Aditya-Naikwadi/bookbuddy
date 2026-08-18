import { useState } from "react";
import { useShelf } from "../../hooks/useShelf";
import { Plus, Trash2, FolderPlus, BookOpen, Lock, Globe } from "lucide-react";

export default function Shelf() {
  const {
    shelves,
    isLoading,
    createShelf,
    deleteShelf,
    removeBookFromShelf,
    isCreating,
  } = useShelf();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [activeShelfId, setActiveShelfId] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createShelf({ name, description, isPublic });
      setName("");
      setDescription("");
      setIsPublic(false);
      setShowCreateModal(false);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create shelf.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const activeShelf =
    shelves.find((s) => s._id === activeShelfId) || shelves[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            My Bookshelves
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Organize and categorize your library reading lists.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          <FolderPlus className="w-4 h-4 mr-2" />
          Create Shelf
        </button>
      </div>

      {shelves.length === 0 ? (
        <div className="text-center p-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
            No Custom Shelves Yet
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            Create custom bookshelves like "Favorites", "Exam Prep", or "To
            Read".
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Shelf
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Shelf List Sidebar */}
          <div className="space-y-2 lg:col-span-1">
            {shelves.map((shelf) => {
              const isActive = activeShelf?._id === shelf._id;
              return (
                <div
                  key={shelf._id}
                  onClick={() => setActiveShelfId(shelf._id)}
                  className={`p-3 rounded-lg cursor-pointer transition-all flex items-center justify-between ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    {shelf.isPublic ? (
                      <Globe className="w-4 h-4 opacity-75 shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 opacity-75 shrink-0" />
                    )}
                    <span className="font-medium text-sm truncate">
                      {shelf.name}
                    </span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${isActive ? "bg-indigo-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}
                  >
                    {shelf.books?.length || 0}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Active Shelf Books */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            {activeShelf ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        {activeShelf.name}
                      </h3>
                      {activeShelf.isPublic ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Public
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                          Private
                        </span>
                      )}
                    </div>
                    {activeShelf.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {activeShelf.description}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`Delete shelf "${activeShelf.name}"?`)) {
                        deleteShelf(activeShelf._id);
                      }
                    }}
                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                    title="Delete Shelf"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {!activeShelf.books || activeShelf.books.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-sm">No books in this shelf yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeShelf.books.map((book) => (
                      <div
                        key={book._id}
                        className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40"
                      >
                        <div className="flex items-center space-x-3 truncate">
                          {book.coverImage ? (
                            <img
                              src={book.coverImage}
                              alt={book.title}
                              className="w-10 h-14 object-cover rounded shadow-sm"
                            />
                          ) : (
                            <div className="w-10 h-14 bg-slate-200 dark:bg-slate-700 rounded flex items-center justify-center">
                              <BookOpen className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div className="truncate">
                            <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                              {book.title}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {book.author}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            removeBookFromShelf({
                              shelfId: activeShelf._id,
                              bookId: book._id,
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-colors ml-2"
                          title="Remove from shelf"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Create Shelf Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Create New Shelf
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Shelf Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Favorite Fiction"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this shelf..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="isPublic"
                  className="text-sm text-slate-700 dark:text-slate-300"
                >
                  Make shelf visible to other campus students
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isCreating ? "Creating..." : "Create Shelf"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
