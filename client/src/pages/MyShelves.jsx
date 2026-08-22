import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  Plus,
  X,
  Lock,
  Globe,
  FolderHeart,
  BookOpen,
  Edit3,
  Loader2,
  Search,
} from 'lucide-react';
import {
  getReadingLists,
  createReadingList,
  updateReadingList,
  deleteReadingList,
  removeReadingListItem,
} from '../api/readingListApi';

// Helper to extract string ID from item
const getItemId = (item, index) => {
  if (!item) return `item-${index}`;
  return (
    item._id ||
    item.id ||
    (typeof item.bookId === 'object' ? item.bookId?._id : item.bookId) ||
    item.resourceId ||
    `item-${index}`
  ).toString();
};

// Sortable Item Component
function SortableItem({ item, index, onRemove }) {
  const itemId = getItemId(item, index);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const title =
    typeof item.bookId === 'object' && item.bookId?.title
      ? item.bookId.title
      : item.title || item.name || item.note || `Book #${index + 1}`;
  const author =
    typeof item.bookId === 'object' && item.bookId?.author
      ? item.bookId.author
      : item.author || 'Catalog Asset';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3.5 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs transition-shadow ${
        isDragging
          ? 'z-50 ring-2 ring-indigo-500 shadow-xl bg-indigo-50/50 dark:bg-indigo-950/50'
          : 'hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors shrink-0"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
          <BookOpen className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
            {title}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {author}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRemove(itemId)}
        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors ml-2 shrink-0"
        title="Remove item from shelf"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function MyShelves() {
  const queryClient = useQueryClient();
  const [selectedList, setSelectedList] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [newListVisibility, setNewListVisibility] = useState('private');
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // DnD Sensors setup
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch all reading lists using TanStack Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['readingLists'],
    queryFn: () => getReadingLists({ limit: 100 }),
  });

  const lists = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }, [data]);

  // Filtered lists
  const filteredLists = useMemo(() => {
    if (!searchQuery.trim()) return lists;
    const q = searchQuery.toLowerCase();
    return lists.filter((l) =>
      (l.name || l.title || '').toLowerCase().includes(q)
    );
  }, [lists, searchQuery]);

  // Create List Mutation
  const createMutation = useMutation({
    mutationFn: (payload) => createReadingList(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingLists'] });
      setIsCreateOpen(false);
      setNewListName('');
      setNewListDesc('');
      setNewListVisibility('private');
      setFeedbackMsg('Shelf created successfully!');
      setTimeout(() => setFeedbackMsg(null), 2500);
    },
  });

  // Update List Mutation (used for reorder persistence via PATCH /api/reading-lists/:id)
  const updateMutation = useMutation({
    mutationFn: ({ listId, payload }) => updateReadingList(listId, payload),
    onSuccess: (updatedData, variables) => {
      queryClient.invalidateQueries({ queryKey: ['readingLists'] });
      queryClient.invalidateQueries({ queryKey: ['readingList', variables.listId] });
      setFeedbackMsg('Order saved to server!');
      setTimeout(() => setFeedbackMsg(null), 2000);
    },
    onError: () => {
      setFeedbackMsg('Failed to persist order.');
      setTimeout(() => setFeedbackMsg(null), 3000);
    },
  });

  // Delete List Mutation
  const deleteListMutation = useMutation({
    mutationFn: (listId) => deleteReadingList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingLists'] });
      setSelectedList(null);
      setFeedbackMsg('Shelf deleted.');
      setTimeout(() => setFeedbackMsg(null), 2000);
    },
  });

  // Remove Item Mutation
  const removeItemMutation = useMutation({
    mutationFn: ({ listId, bookId }) => removeReadingListItem(listId, bookId),
    onSuccess: (updatedList, variables) => {
      queryClient.invalidateQueries({ queryKey: ['readingLists'] });
      if (selectedList && (selectedList._id || selectedList.id) === variables.listId) {
        const remainingItems = (selectedList.items || []).filter(
          (item, idx) => getItemId(item, idx) !== variables.bookId
        );
        setSelectedList({ ...selectedList, items: remainingItems });
      }
    },
  });

  // Handle Drag End and trigger server-side persistence via PATCH
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedList) return;

    const items = selectedList.items || [];
    const oldIndex = items.findIndex((item, idx) => getItemId(item, idx) === active.id);
    const newIndex = items.findIndex((item, idx) => getItemId(item, idx) === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedItems = arrayMove(items, oldIndex, newIndex);
    setSelectedList({ ...selectedList, items: reorderedItems });

    // Persist reordered array to backend via PATCH /api/reading-lists/:id
    updateMutation.mutate({
      listId: selectedList._id || selectedList.id,
      payload: { items: reorderedItems },
    });
  };

  const handleRemoveItem = (itemId) => {
    if (!selectedList) return;
    const listId = selectedList._id || selectedList.id;
    removeItemMutation.mutate({ listId, bookId: itemId });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-10 transition-colors">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
                <FolderHeart className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                My Shelves
              </h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Curate your reading lists and drag to reorder books on any shelf.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Shelf</span>
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedbackMsg && (
          <div className="p-3 text-xs font-medium text-center bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 rounded-xl border border-indigo-200 dark:border-indigo-800 animate-in fade-in duration-150">
            {feedbackMsg}
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search your shelves..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Shelves Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="ml-3 text-sm">Loading your shelves...</span>
          </div>
        ) : isError ? (
          <div className="p-6 text-sm text-rose-500 bg-rose-50 dark:bg-rose-950/30 rounded-2xl text-center border border-rose-200 dark:border-rose-900">
            Failed to load shelves.{' '}
            <button
              type="button"
              onClick={() => refetch()}
              className="underline font-semibold"
            >
              Retry
            </button>
          </div>
        ) : filteredLists.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
            <FolderHeart className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              No Shelves Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              {searchQuery
                ? 'No shelves match your search.'
                : 'Get started by creating your first reading shelf!'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create Shelf</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLists.map((list) => {
              const listId = list._id || list.id;
              const itemCount = list.items?.length || 0;

              return (
                <div
                  key={listId}
                  className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 rounded-2xl p-5 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          list.visibility === 'college'
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {list.visibility === 'college' ? (
                          <>
                            <Globe className="w-3 h-3" />
                            College Shared
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" />
                            Private Shelf
                          </>
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => deleteListMutation.mutate(listId)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-opacity"
                        title="Delete shelf"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                        {list.name || list.title}
                      </h3>
                      {list.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                          {list.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between mt-4">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {itemCount} {itemCount === 1 ? 'book' : 'books'}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedList(list)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Open & Reorder</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Open Shelf / Drag Reorder Modal */}
      {selectedList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <FolderHeart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedList.name || selectedList.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Drag items using the grip icon to reorder positions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedList(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body - Drag and Drop Sortable Container */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {!selectedList.items || selectedList.items.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  This shelf has no books yet. Use "Add to List" on any catalog item!
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={(selectedList.items || []).map((item, idx) =>
                      getItemId(item, idx)
                    )}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2.5">
                      {(selectedList.items || []).map((item, index) => (
                        <SortableItem
                          key={getItemId(item, index)}
                          item={item}
                          index={index}
                          onRemove={handleRemoveItem}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {selectedList.items?.length || 0} total items
              </span>
              <button
                type="button"
                onClick={() => setSelectedList(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Shelf Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Create New Shelf
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Shelf Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Operating Systems Core..."
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional description..."
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Visibility
                </label>
                <select
                  value={newListVisibility}
                  onChange={(e) => setNewListVisibility(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="private">Private (Only You)</option>
                  <option value="college">College Shared (Same Institution)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  createMutation.mutate({
                    name: newListName.trim(),
                    title: newListName.trim(),
                    description: newListDesc,
                    visibility: newListVisibility,
                  })
                }
                disabled={!newListName.trim() || createMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer"
              >
                {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Create Shelf</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
