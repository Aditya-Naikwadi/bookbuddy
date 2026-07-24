import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark,
  BookOpen,
  FileText,
  Trash2,
  Search,
  Sparkles,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import useLocalBookmarks from '../../../hooks/useLocalBookmarks';
import StickyControlBar from '../../../components/general/StickyControlBar';
import StatSummaryStrip from '../../../components/general/StatSummaryStrip';
import VirtualizedCardGrid from '../../../components/general/VirtualizedCardGrid';
import ActiveFilterChips from '../../../components/general/ActiveFilterChips';

const SORT_OPTIONS = [
  { value: 'recent', label: 'Sort: Recently Saved' },
  { value: 'title', label: 'Title (A-Z)' },
  { value: 'available', label: 'Available First' },
];

const GeneralSaved = () => {
  const navigate = useNavigate();
  const { bookmarks, removeBookmark, clearBookmarks } = useLocalBookmarks();

  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');

  const filteredBookmarks = useMemo(() => {
    let list = bookmarks;

    if (activeTab === 'Books') {
      list = bookmarks.filter((b) => !b.type || b.type === 'Book' || b.availableCopies !== undefined);
    } else if (activeTab === 'E-Resources') {
      list = bookmarks.filter((b) => b.type === 'EResource' || b.gutenbergId || b.accessRequirement);
    }

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter((b) => b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q) || b.genre?.toLowerCase().includes(q));
    }

    return list.sort((a, b) => {
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'available') {
        const availA = a.availableCopies !== undefined ? a.availableCopies : 1;
        const availB = b.availableCopies !== undefined ? b.availableCopies : 1;
        return availB - availA;
      }
      return 0;
    });
  }, [bookmarks, activeTab, searchQuery, sortBy]);

  const counts = useMemo(() => {
    const booksCount = bookmarks.filter((b) => !b.type || b.type === 'Book' || b.availableCopies !== undefined).length;
    const eresourcesCount = bookmarks.filter((b) => b.type === 'EResource' || b.gutenbergId || b.accessRequirement).length;
    const availableNowCount = bookmarks.filter((b) => b.availableCopies > 0 || b.accessRequirement === 'Open Access' || b.gutenbergId).length;

    return { all: bookmarks.length, books: booksCount, eresources: eresourcesCount, availableNow: availableNowCount };
  }, [bookmarks]);

  const stats = useMemo(() => {
    return [
      { label: 'Total Saved', value: counts.all, icon: Bookmark, colorClass: 'text-indigo-600', bgBadgeClass: 'bg-indigo-50 text-indigo-700' },
      { label: 'Now Available', value: counts.availableNow, icon: CheckCircle2, colorClass: 'text-emerald-600', bgBadgeClass: 'bg-emerald-100 text-emerald-800' },
    ];
  }, [counts]);

  const activeChips = [
    { key: 'query', label: 'Keyword', value: searchQuery },
    { key: 'tab', label: 'Type', value: activeTab },
  ];

  const handleRemoveChip = (key) => {
    if (key === 'query') setSearchQuery('');
    if (key === 'tab') setActiveTab('All');
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden max-w-7xl mx-auto p-3 sm:p-4 gap-3 font-sans">
      {/* Sticky Control Bar */}
      <StickyControlBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={() => setSearchQuery('')}
        placeholder="Filter saved bookmarks by keyword or title..."
        sortBy={sortBy}
        onSortChange={setSortBy}
        sortOptions={SORT_OPTIONS}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        resultCount={filteredBookmarks.length}
        filterSlot={
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Segmented Toggle Bar */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
              <button
                onClick={() => setActiveTab('All')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'All' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>All ({counts.all})</span>
              </button>

              <button
                onClick={() => setActiveTab('Books')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'Books' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Books ({counts.books})</span>
              </button>

              <button
                onClick={() => setActiveTab('E-Resources')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'E-Resources' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>E-Resources ({counts.eresources})</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <StatSummaryStrip items={stats} />
              {bookmarks.length > 0 && (
                <button
                  onClick={clearBookmarks}
                  className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80 font-bold text-xs rounded-xl transition-all flex items-center gap-1"
                  title="Clear all saved bookmarks"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear All</span>
                </button>
              )}
            </div>
          </div>
        }
      />

      {/* Active Filter Chips */}
      <ActiveFilterChips chips={activeChips} onRemoveChip={handleRemoveChip} onResetAll={() => { setSearchQuery(''); setActiveTab('All'); }} />

      {/* Virtualized Cards Grid Container */}
      <VirtualizedCardGrid
        items={filteredBookmarks}
        viewMode={viewMode}
        columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        emptyState={
          <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-4 max-w-md my-auto">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl w-14 h-14 mx-auto flex items-center justify-center">
              <Sparkles className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">No Saved Bookmarks Found</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {bookmarks.length === 0
                  ? "You haven't bookmarked any items in this session. Explore physical catalog items or public e-resources and save items for quick access."
                  : 'No saved items match your active tab or search filter.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <button
                onClick={() => navigate('/general-dashboard/search')}
                className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search Catalog</span>
              </button>

              <button
                onClick={() => navigate('/general-dashboard/e-resources')}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Public E-Resources</span>
              </button>
            </div>
          </div>
        }
        renderItem={(item) => {
          const isEResource = item.gutenbergId || item.accessRequirement || item.type === 'EResource';
          const isAvailable = item.availableCopies > 0 || item.accessRequirement === 'Open Access' || item.gutenbergId;

          return (
            <div
              key={item.id || item._id}
              className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group relative"
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                      isAvailable ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {isAvailable ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {isAvailable ? (isEResource ? 'Open Access' : `${item.availableCopies} Available`) : 'Checked Out'}
                  </span>

                  <button
                    onClick={() => removeBookmark(item.id || item._id)}
                    title="Remove bookmark"
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 mb-1">
                  <span>{isEResource ? 'Digital Resource' : 'Physical Volume'}</span>
                  {item.genre && (
                    <>
                      <span>•</span>
                      <span className="text-indigo-600 font-bold">{item.genre}</span>
                    </>
                  )}
                </div>

                <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors mb-1">
                  {item.title}
                </h3>

                {item.author && <p className="text-xs text-slate-500 mb-2">By {item.author}</p>}
                {item.description && <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">{item.description}</p>}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                <span className="text-[10px] text-slate-400 font-medium">
                  {item.location ? `Shelf: ${item.location}` : item.source ? `Source: ${item.source}` : 'Catalog Item'}
                </span>

                <button
                  onClick={() => {
                    if (item.gutenbergId) {
                      window.open(`https://www.gutenberg.org/ebooks/${item.gutenbergId}`, '_blank');
                    } else {
                      navigate(`/general-dashboard/search?q=${encodeURIComponent(item.title)}`);
                    }
                  }}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1 flex-shrink-0"
                >
                  <span>{isEResource ? 'Access Resource' : 'View in Catalog'}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
};

export default GeneralSaved;
