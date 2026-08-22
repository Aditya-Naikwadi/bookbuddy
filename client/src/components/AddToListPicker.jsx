import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookmarkPlus,
  Check,
  Plus,
  X,
  Lock,
  Globe,
  Loader2,
  FolderPlus,
  Search,
} from 'lucide-react';
import {
  getReadingLists,
  createReadingList,
  addReadingListItem,
} from '../api/readingListApi';

/**
 * AddToListPicker Component
 * Reusable modal/popover component triggered from any book card or detail page.
 *
 * @param {Object} props
 * @param {string} [props.bookId] - Target book ID
 * @param {Object|string} [props.book] - Book object or ID fallback
 * @param {React.ReactNode} [props.trigger] - Custom trigger element
 * @param {string} [props.className] - Additional wrapper styling
 */
export default function AddToListPicker({ bookId, book, trigger, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [newListVisibility, setNewListVisibility] = useState('private');
  const [activeAddingId, setActiveAddingId] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const queryClient = useQueryClient();

  // Determine normalized target book ID
  const targetBookId = useMemo(() => {
    if (typeof book === 'object' && book !== null) {
      return (book._id || book.id || '').toString();
    }
    if (bookId) {
      return bookId.toString();
    }
    if (typeof book === 'string') {
      return book;
    }
    return '';
  }, [bookId, book]);

  // Fetch user's reading lists using TanStack Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['readingLists'],
    queryFn: getReadingLists,
    enabled: isOpen,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const lists = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }, [data]);

  // Filtered lists based on search term
  const filteredLists = useMemo(() => {
    if (!searchTerm.trim()) return lists;
    const lower = searchTerm.toLowerCase();
    return lists.filter((l) =>
      (l.name || l.title || '').toLowerCase().includes(lower)
    );
  }, [lists, searchTerm]);

  // Mutation: Add item to existing list
  const addMutation = useMutation({
    mutationFn: async ({ listId }) => {
      setActiveAddingId(listId);
      return addReadingListItem(listId, { bookId: targetBookId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['readingLists'] });
      queryClient.invalidateQueries({ queryKey: ['readingList', variables.listId] });
      setFeedbackMsg('Added to list!');
      setTimeout(() => setFeedbackMsg(null), 2500);
      setActiveAddingId(null);
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Failed to add to list';
      setFeedbackMsg(`Error: ${msg}`);
      setTimeout(() => setFeedbackMsg(null), 3000);
      setActiveAddingId(null);
    },
  });

  // Mutation: Create new list and immediately add book to it
  const createAndAddMutation = useMutation({
    mutationFn: async () => {
      const listName = newListName.trim();
      if (!listName) throw new Error('List name is required');

      const newList = await createReadingList({
        name: listName,
        title: listName,
        description: newListDesc,
        visibility: newListVisibility,
      });

      const listId = newList._id || newList.id;
      if (listId && targetBookId) {
        await addReadingListItem(listId, { bookId: targetBookId });
      }
      return newList;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingLists'] });
      setFeedbackMsg('Created list & added book!');
      setNewListName('');
      setNewListDesc('');
      setShowCreateForm(false);
      setTimeout(() => {
        setFeedbackMsg(null);
        setIsOpen(false);
      }, 1500);
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create list';
      setFeedbackMsg(`Error: ${msg}`);
      setTimeout(() => setFeedbackMsg(null), 3000);
    },
  });

  const isBookInList = (list) => {
    if (!list.items || !Array.isArray(list.items)) return false;
    return list.items.some((item) => {
      const bId = item.bookId?._id || item.bookId || item.resourceId?._id || item.resourceId || '';
      return bId.toString() === targetBookId;
    });
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowCreateForm(false);
    setSearchTerm('');
    setFeedbackMsg(null);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger element */}
      {trigger ? (
        <div onClick={handleOpen} className="cursor-pointer">
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-xs transition-all cursor-pointer"
          title="Add to reading list"
        >
          <BookmarkPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Add to List</span>
        </button>
      )}

      {/* Modal / Popover Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BookmarkPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Add to Reading List
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Feedback Banner */}
            {feedbackMsg && (
              <div
                className={`px-4 py-2 text-xs font-medium text-center ${
                  feedbackMsg.startsWith('Error')
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-b border-rose-100 dark:border-rose-900'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-b border-emerald-100 dark:border-emerald-900'
                }`}
              >
                {feedbackMsg}
              </div>
            )}

            {/* Body Content */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search your shelves..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Reading Lists List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="ml-2 text-xs">Loading lists...</span>
                </div>
              ) : isError ? (
                <div className="p-3 text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/30 rounded-xl text-center">
                  Failed to load lists.{' '}
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="underline font-semibold"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredLists.length === 0 ? (
                <div className="py-6 text-center text-slate-500 dark:text-slate-400 text-xs">
                  {searchTerm ? 'No matching lists found.' : 'You have no reading lists yet.'}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {filteredLists.map((list) => {
                    const listId = list._id || list.id;
                    const alreadyInList = isBookInList(list);
                    const isAdding = activeAddingId === listId;

                    return (
                      <button
                        key={listId}
                        type="button"
                        onClick={() =>
                          !alreadyInList && !isAdding && addMutation.mutate({ listId })
                        }
                        disabled={alreadyInList || isAdding}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                          alreadyInList
                            ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80 cursor-default'
                            : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                            {list.visibility === 'college' ? (
                              <Globe className="w-4 h-4" />
                            ) : (
                              <Lock className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {list.name || list.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {list.items?.length || 0} items •{' '}
                              <span className="capitalize">{list.visibility || 'private'}</span>
                            </p>
                          </div>
                        </div>

                        <div className="ml-2 shrink-0">
                          {isAdding ? (
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                          ) : alreadyInList ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 rounded-full">
                              <Check className="w-3 h-3" />
                              Added
                            </span>
                          ) : (
                            <div className="p-1 rounded-md text-slate-400 group-hover:text-indigo-600">
                              <Plus className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Collapsible Inline Create New List Option */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                {!showCreateForm ? (
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 rounded-xl transition-colors cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>Create New List</span>
                  </button>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">
                        Create New Shelf
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCreateForm(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="List name (e.g. Exam Preparation)..."
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />

                    <input
                      type="text"
                      placeholder="Description (optional)..."
                      value={newListDesc}
                      onChange={(e) => setNewListDesc(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                          Visibility:
                        </label>
                        <select
                          value={newListVisibility}
                          onChange={(e) => setNewListVisibility(e.target.value)}
                          className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 focus:outline-none"
                        >
                          <option value="private">Private</option>
                          <option value="college">College Shared</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => createAndAddMutation.mutate()}
                        disabled={!newListName.trim() || createAndAddMutation.isPending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        {createAndAddMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>Create & Add</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
