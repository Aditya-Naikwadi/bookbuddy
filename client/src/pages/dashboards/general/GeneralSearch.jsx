import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  BookOpen,
  MapPin,
  RotateCcw,
} from 'lucide-react';
import ResultCard from '../../../components/general/ResultCard';
import useLocalBookmarks from '../../../hooks/useLocalBookmarks';

// Mock Catalog Database for Public Search
const CATALOG_BOOKS = [
  {
    id: 'b-1',
    title: 'Principles of Modern Architecture & Urban Planning',
    author: 'Elena Rostova',
    genre: 'Architecture',
    year: '2024',
    format: 'Hardcover',
    availabilityStatus: 'Available',
    availableCopies: 4,
    location: 'Floor 2, Shelf A-14',
    description: 'A comprehensive study of modern sustainable architecture.',
  },
  {
    id: 'b-2',
    title: 'Data Structures and Algorithms in Python',
    author: 'Alan Turing Jr.',
    genre: 'Computer Science',
    year: '2023',
    format: 'Paperback',
    availabilityStatus: 'Available',
    availableCopies: 2,
    location: 'Floor 3, Shelf CS-08',
    description: 'Essential algorithmic patterns and optimization techniques.',
  },
  {
    id: 'b-3',
    title: 'Global Economic Trends & Financial Markets',
    author: 'Marcus Vance',
    genre: 'Economics',
    year: '2024',
    format: 'Hardcover',
    availabilityStatus: 'Checked Out',
    availableCopies: 0,
    location: 'Floor 1, Shelf EC-02',
    description: 'Analysis of global trade patterns and fiscal policy.',
  },
  {
    id: 'b-4',
    title: 'Biochemistry & Molecular Biology Essentials',
    author: 'Sarah Lin',
    genre: 'Biology',
    year: '2023',
    format: 'Hardcover',
    availabilityStatus: 'Available',
    availableCopies: 5,
    location: 'Floor 3, Shelf BIO-12',
    description: 'Cellular mechanics, genetics, and metabolic processes.',
  },
  {
    id: 'b-5',
    title: 'History of World Literature: Antiquity to Modernity',
    author: 'Clara Oswald',
    genre: 'Literature',
    year: '2022',
    format: 'Paperback',
    availabilityStatus: 'On Hold',
    availableCopies: 1,
    location: 'Floor 2, Shelf LIT-05',
    description: 'Comparative literature across eastern and western canons.',
  },
  {
    id: 'b-6',
    title: 'Quantum Computing Principles & Mathematical Models',
    author: 'David Deutsch',
    genre: 'Computer Science',
    year: '2024',
    format: 'Hardcover',
    availabilityStatus: 'Available',
    availableCopies: 3,
    location: 'Floor 3, Shelf CS-19',
    description: 'Quantum circuits, qubits, and state vectors.',
  },
  {
    id: 'b-7',
    title: 'Environmental Science & Climate Resiliency',
    author: 'Rachel Carson III',
    genre: 'Environmental Science',
    year: '2023',
    format: 'Paperback',
    availabilityStatus: 'Available',
    availableCopies: 6,
    location: 'Floor 1, Shelf ENV-04',
    description: 'Ecological preservation strategies and climate data modeling.',
  },
  {
    id: 'b-8',
    title: 'Organic Chemistry Laboratory Handbook',
    author: 'Robert Burns Woodward',
    genre: 'Chemistry',
    year: '2021',
    format: 'Reference',
    availabilityStatus: 'Available',
    availableCopies: 2,
    location: 'Floor 3, Shelf CHEM-01',
    description: 'Synthesis protocols and spectroscopic technique guides.',
  },
];

const GENRES = ['All', 'Computer Science', 'Architecture', 'Economics', 'Biology', 'Literature', 'Chemistry', 'Environmental Science'];
const AVAILABILITY_OPTIONS = ['All', 'Available', 'On Hold', 'Checked Out'];
const FORMAT_OPTIONS = ['All', 'Hardcover', 'Paperback', 'Reference'];

const GeneralSearch = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialFilter = searchParams.get('filter');

  const { toggleBookmark, isBookmarked } = useLocalBookmarks();

  const [query, setQuery] = useState(initialQuery);
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedAvailability, setSelectedAvailability] = useState(initialFilter === 'new' ? 'All' : 'All');
  const [selectedFormat, setSelectedFormat] = useState('All');
  const [sortBy, setSortBy] = useState('relevance');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLocationBook, setSelectedLocationBook] = useState(null);

  // Trigger loading effect on search filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selectedGenre, selectedAvailability, selectedFormat, sortBy]);

  const filteredBooks = useMemo(() => {
    return CATALOG_BOOKS.filter((book) => {
      // Search Query Matching
      const q = query.toLowerCase().trim();
      const matchesQuery =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.genre.toLowerCase().includes(q);

      // Genre Filter
      const matchesGenre = selectedGenre === 'All' || book.genre === selectedGenre;

      // Availability Filter
      const matchesAvailability =
        selectedAvailability === 'All' || book.availabilityStatus === selectedAvailability;

      // Format Filter
      const matchesFormat = selectedFormat === 'All' || book.format === selectedFormat;

      return matchesQuery && matchesGenre && matchesAvailability && matchesFormat;
    }).sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'newest') return parseInt(b.year, 10) - parseInt(a.year, 10);
      if (sortBy === 'available') return b.availableCopies - a.availableCopies;
      return 0; // relevance default
    });
  }, [query, selectedGenre, selectedAvailability, selectedFormat, sortBy]);

  const handleResetFilters = () => {
    setQuery('');
    setSelectedGenre('All');
    setSelectedAvailability('All');
    setSelectedFormat('All');
    setSortBy('relevance');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 tracking-tight">
            Advanced Catalog Search
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Search physical book collections, filter by genre and availability, and pinpoint shelf locations.
          </p>
        </div>

        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="md:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200"
        >
          <Filter className="w-4 h-4" />
          <span>Filters & Refinements</span>
        </button>
      </div>

      {/* Main Content Layout: Faceted Filter Sidebar + Results */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Faceted Filter Sidebar */}
        <aside
          className={`w-full md:w-64 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6 flex-shrink-0 ${
            showMobileFilters ? 'block' : 'hidden md:block'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <span>Faceted Filters</span>
            </div>
            <button
              onClick={handleResetFilters}
              title="Reset all filters"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          {/* Genre Filter */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Genre / Subject
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                    selectedGenre === genre
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
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
                    selectedAvailability === status
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{status}</span>
                  {selectedAvailability === status && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                  )}
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
                    selectedFormat === format
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{format}</span>
                  {selectedFormat === format && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Results Area */}
        <main className="flex-1 w-full space-y-6">
          {/* Search Controls & Sorting */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 absolute left-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search catalog by title, author, or discipline..."
                className="w-full pl-11 pr-10 py-3 text-sm bg-slate-50 border border-slate-200/80 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all shadow-inner"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2 text-slate-600">
                <span className="font-bold text-slate-900">{filteredBooks.length}</span>
                <span>items found</span>
                {(selectedGenre !== 'All' || selectedAvailability !== 'All' || selectedFormat !== 'All' || query) && (
                  <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-md">
                    Filtered
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 font-medium">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
                >
                  <option value="relevance">Relevance</option>
                  <option value="title">Title (A - Z)</option>
                  <option value="newest">Publication Year (Newest)</option>
                  <option value="available">Most Copies Available</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Grid / Loading / Empty State */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <ResultCard loading />
              <ResultCard loading />
              <ResultCard loading />
              <ResultCard loading />
              <ResultCard loading />
              <ResultCard loading />
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-sm text-center space-y-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-12 h-12 mx-auto flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No Matching Catalog Items</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                We couldn’t find any physical books matching your active query and filter combination. Try clearing your filters or broadening your search keywords.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBooks.map((book) => (
                <ResultCard
                  key={book.id}
                  book={book}
                  isBookmarked={isBookmarked(book.id)}
                  onToggleBookmark={toggleBookmark}
                  onViewLocation={(b) => setSelectedLocationBook(b)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Shelf Location Modal */}
      {selectedLocationBook && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200 space-y-5">
            <button
              onClick={() => setSelectedLocationBook(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedLocationBook.title}</h3>
                <p className="text-xs text-slate-500">Physical Shelf Mapping</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
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

            <p className="text-[11px] text-slate-500 italic bg-amber-50/60 p-3 rounded-xl border border-amber-200/60">
              Note: As a public visitor, present the shelf location code to the circulation desk for on-site reading access.
            </p>

            <button
              onClick={() => setSelectedLocationBook(null)}
              className="w-full py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors"
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
