import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  X,
  BookOpen,
  MapPin,
  CheckCircle2,
  Clock,
  BookX,
  SearchCode,
} from 'lucide-react';
import ResultCard from '../../../components/general/ResultCard';
import useLocalBookmarks from '../../../hooks/useLocalBookmarks';
import StickyControlBar from '../../../components/general/StickyControlBar';
import ActiveFilterChips from '../../../components/general/ActiveFilterChips';
import StatSummaryStrip from '../../../components/general/StatSummaryStrip';
import VirtualizedCardGrid from '../../../components/general/VirtualizedCardGrid';
import MobileFilterSheet from '../../../components/general/MobileFilterSheet';

import apiClient from '../../../api/client';

const GENRES = ['All', 'Computer Science', 'Architecture', 'Economics', 'Biology', 'Literature', 'Chemistry', 'Environmental Science'];
const AVAILABILITY_OPTIONS = ['All', 'Available', 'On Hold', 'Checked Out'];
const FORMAT_OPTIONS = ['All', 'Hardcover', 'Paperback', 'Reference'];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Sort: Relevance' },
  { value: 'title', label: 'Title (A-Z)' },
  { value: 'newest', label: 'Publication Year (Newest)' },
  { value: 'available', label: 'Most Available Copies' },
];

const GeneralSearch = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const { toggleBookmark, isBookmarked } = useLocalBookmarks();

  const [rawQuery, setRawQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedAvailability, setSelectedAvailability] = useState('All');
  const [selectedFormat, setSelectedFormat] = useState('All');
  const [sortBy, setSortBy] = useState('relevance');
  const [viewMode, setViewMode] = useState('grid');
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [catalogBooks, setCatalogBooks] = useState([]);
  const [selectedLocationBook, setSelectedLocationBook] = useState(null);

  // Fetch catalog books from backend
  useEffect(() => {
    let isMounted = true;
    const fetchCatalog = async () => {
      try {
        setLoading(true);
        const { data } = await apiClient.get('/books');
        if (isMounted && data && Array.isArray(data.data)) {
          const mapped = data.data.map((b) => ({
            id: b._id,
            title: b.title,
            author: b.author,
            genre: b.genre || 'General',
            year: b.publicationYear ? String(b.publicationYear) : '2024',
            format: b.format || 'Paperback',
            availabilityStatus: b.copiesAvailable > 0 ? 'Available' : 'Checked Out',
            availableCopies: b.copiesAvailable !== undefined ? b.copiesAvailable : 0,
            location: b.shelfLocation || 'Main Stacks',
            description: b.description || 'Catalog resource.',
          }));
          setCatalogBooks(mapped);
        }
      } catch {
        if (isMounted) setCatalogBooks([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounce search query changes (~300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(rawQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const filteredBooks = useMemo(() => {
    return catalogBooks.filter((book) => {
      const q = debouncedQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.genre.toLowerCase().includes(q);

      const matchesGenre = selectedGenre === 'All' || book.genre === selectedGenre;
      const matchesAvailability = selectedAvailability === 'All' || book.availabilityStatus === selectedAvailability;
      const matchesFormat = selectedFormat === 'All' || book.format === selectedFormat;

      return matchesQuery && matchesGenre && matchesAvailability && matchesFormat;
    }).sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'newest') return parseInt(b.year, 10) - parseInt(a.year, 10);
      if (sortBy === 'available') return b.availableCopies - a.availableCopies;
      return 0;
    });
  }, [catalogBooks, debouncedQuery, selectedGenre, selectedAvailability, selectedFormat, sortBy]);

  // Compute stat summary metrics
  const stats = useMemo(() => {
    const available = filteredBooks.filter((b) => b.availabilityStatus === 'Available').length;
    const onHold = filteredBooks.filter((b) => b.availabilityStatus === 'On Hold').length;
    const checkedOut = filteredBooks.filter((b) => b.availabilityStatus === 'Checked Out').length;

    return [
      { label: 'Total Matches', value: filteredBooks.length, icon: BookOpen, colorClass: 'text-indigo-600', bgBadgeClass: 'bg-indigo-50 text-indigo-700' },
      { label: 'Available', value: available, icon: CheckCircle2, colorClass: 'text-emerald-600', bgBadgeClass: 'bg-emerald-50 text-emerald-700' },
      { label: 'On Hold', value: onHold, icon: Clock, colorClass: 'text-amber-600', bgBadgeClass: 'bg-amber-50 text-amber-700' },
      { label: 'Checked Out', value: checkedOut, icon: BookX, colorClass: 'text-rose-600', bgBadgeClass: 'bg-rose-50 text-rose-700' },
    ];
  }, [filteredBooks]);

  const activeChips = [
    { key: 'query', label: 'Keyword', value: debouncedQuery },
    { key: 'genre', label: 'Genre', value: selectedGenre },
    { key: 'availability', label: 'Status', value: selectedAvailability },
    { key: 'format', label: 'Format', value: selectedFormat },
  ];

  const handleRemoveChip = (key) => {
    if (key === 'query') setRawQuery('');
    if (key === 'genre') setSelectedGenre('All');
    if (key === 'availability') setSelectedAvailability('All');
    if (key === 'format') setSelectedFormat('All');
  };

  const handleResetAll = () => {
    setRawQuery('');
    setDebouncedQuery('');
    setSelectedGenre('All');
    setSelectedAvailability('All');
    setSelectedFormat('All');
    setSortBy('relevance');
  };

  const filteredGenresList = GENRES.filter((g) => g.toLowerCase().includes(genreSearch.toLowerCase()));

  const filterContent = (
    <div className="space-y-5">
      {/* Genre Filter with Search within Facet */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Genre / Subject
        </label>
        <div className="relative mb-2">
          <SearchCode className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={genreSearch}
            onChange={(e) => setGenreSearch(e.target.value)}
            placeholder="Search genres..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200/80 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
          {filteredGenresList.map((genre) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                selectedGenre === genre ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{genre}</span>
              {selectedGenre === genre && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>}
            </button>
          ))}
        </div>
      </div>

      {/* Availability Filter */}
      <div className="border-t border-slate-100 pt-4">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Status & Availability
        </label>
        <div className="space-y-1">
          {AVAILABILITY_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => setSelectedAvailability(status)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                selectedAvailability === status ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{status}</span>
              {selectedAvailability === status && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>}
            </button>
          ))}
        </div>
      </div>

      {/* Format Filter */}
      <div className="border-t border-slate-100 pt-4">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Binding / Format
        </label>
        <div className="space-y-1">
          {FORMAT_OPTIONS.map((format) => (
            <button
              key={format}
              onClick={() => setSelectedFormat(format)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                selectedFormat === format ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{format}</span>
              {selectedFormat === format && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden max-w-7xl mx-auto p-3 sm:p-4 gap-3 font-sans">
      {/* Sticky Control Bar */}
      <StickyControlBar
        searchQuery={rawQuery}
        onSearchChange={setRawQuery}
        onClearSearch={() => setRawQuery('')}
        placeholder="Search catalog by title, author, or discipline..."
        sortBy={sortBy}
        onSortChange={setSortBy}
        sortOptions={SORT_OPTIONS}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenMobileFilters={() => setShowFiltersSheet(true)}
        resultCount={filteredBooks.length}
        filterSlot={
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <StatSummaryStrip items={stats} />
            <button
              onClick={() => setShowFiltersSheet(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 hover:bg-indigo-100 transition-all ml-auto"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Faceted Filters</span>
            </button>
          </div>
        }
      />

      {/* Active Filter Chips */}
      <ActiveFilterChips chips={activeChips} onRemoveChip={handleRemoveChip} onResetAll={handleResetAll} />

      {/* Virtualized Cards Grid Container */}
      <VirtualizedCardGrid
        items={filteredBooks}
        loading={loading}
        viewMode={viewMode}
        columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        emptyState={
          <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-4 max-w-md my-auto">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-12 h-12 mx-auto flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Matching Catalog Items</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              We couldn’t find any physical books matching your active search query and filter combination.
            </p>
            <button
              onClick={handleResetAll}
              className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Clear All Filters
            </button>
          </div>
        }
        renderItem={(book) => (
          <ResultCard
            key={book.id}
            book={book}
            isBookmarked={isBookmarked(book.id)}
            onToggleBookmark={toggleBookmark}
            onViewLocation={(b) => setSelectedLocationBook(b)}
          />
        )}
      />

      {/* Mobile/Desktop Faceted Filters Sheet */}
      <MobileFilterSheet
        isOpen={showFiltersSheet}
        onClose={() => setShowFiltersSheet(false)}
        title="Faceted Catalog Filters"
        onResetAll={handleResetAll}
      >
        {filterContent}
      </MobileFilterSheet>

      {/* Shelf Location Modal */}
      {selectedLocationBook && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <button
              onClick={() => setSelectedLocationBook(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedLocationBook.title}</h3>
                <p className="text-xs text-slate-500">Physical Shelf Mapping</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Shelf Code</span>
                <span className="font-bold text-indigo-900">{selectedLocationBook.location}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Copies Available</span>
                <span className="font-bold text-slate-900">{selectedLocationBook.availableCopies} Copies</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Category</span>
                <span className="font-bold text-slate-900">{selectedLocationBook.genre}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedLocationBook(null)}
              className="w-full py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20"
            >
              Close Location Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralSearch;
