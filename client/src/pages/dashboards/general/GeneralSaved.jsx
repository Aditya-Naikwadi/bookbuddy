import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark,
  BookOpen,
  FileText,
  Trash2,
  Search,
  Sparkles,
} from 'lucide-react';
import BookmarkCard from '../../../components/general/BookmarkCard';
import useLocalBookmarks from '../../../hooks/useLocalBookmarks';

const GeneralSaved = () => {
  const navigate = useNavigate();
  const { bookmarks, removeBookmark, clearBookmarks } = useLocalBookmarks();
  const [activeTab, setActiveTab] = useState('All');

  const filteredBookmarks = useMemo(() => {
    if (activeTab === 'Books') {
      return bookmarks.filter((b) => !b.type || b.type === 'Book' || b.availableCopies !== undefined);
    }
    if (activeTab === 'E-Resources') {
      return bookmarks.filter((b) => b.type === 'EResource' || b.gutenbergId || b.accessRequirement);
    }
    return bookmarks;
  }, [bookmarks, activeTab]);

  const counts = useMemo(() => {
    const booksCount = bookmarks.filter((b) => !b.type || b.type === 'Book' || b.availableCopies !== undefined).length;
    const eresourcesCount = bookmarks.filter((b) => b.type === 'EResource' || b.gutenbergId || b.accessRequirement).length;
    return { all: bookmarks.length, books: booksCount, eresources: eresourcesCount };
  }, [bookmarks]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 tracking-tight">
            Saved Browser Bookmarks
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Keep track of physical books and digital e-resources saved during your session.
          </p>
        </div>

        {bookmarks.length > 0 && (
          <button
            onClick={clearBookmarks}
            className="px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80 font-semibold text-xs rounded-xl transition-all self-start sm:self-center flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All Saved</span>
          </button>
        )}
      </div>

      {/* Type Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('All')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'All'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>All Bookmarks</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-white/20">{counts.all}</span>
          </button>

          <button
            onClick={() => setActiveTab('Books')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'Books'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Physical Books</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-white/20">{counts.books}</span>
          </button>

          <button
            onClick={() => setActiveTab('E-Resources')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'E-Resources'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>E-Resources</span>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-white/20">{counts.eresources}</span>
          </button>
        </div>

        <span className="text-xs text-slate-400 font-medium">
          Saved locally in your active browser session
        </span>
      </div>

      {/* Bookmarks Grid / Empty State */}
      {filteredBookmarks.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-4 max-w-lg mx-auto my-8">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl w-14 h-14 mx-auto flex items-center justify-center">
            <Sparkles className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No Saved Bookmarks Yet</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              You haven't bookmarked any items in this session. Explore the catalog or public e-resources and click the bookmark icon to save items for quick reference.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={() => navigate('/general-dashboard/search')}
              className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
            >
              <Search className="w-4 h-4" />
              <span>Search Catalog</span>
            </button>

            <button
              onClick={() => navigate('/general-dashboard/e-resources')}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Browse E-Resources</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBookmarks.map((item) => (
            <BookmarkCard
              key={item.id || item._id}
              item={item}
              onRemove={(id) => removeBookmark(id)}
              onAction={(b) => {
                if (b.gutenbergId) {
                  window.open(`https://www.gutenberg.org/ebooks/${b.gutenbergId}`, '_blank');
                } else {
                  navigate(`/general-dashboard/search?q=${encodeURIComponent(b.title)}`);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default GeneralSaved;
