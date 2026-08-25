import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  BookX,
  SearchCode,
  MapPin,
  X,
  SlidersHorizontal,
} from "lucide-react";
import ResultCard from "../../../components/general/ResultCard";
import useLocalBookmarks from "../../../hooks/useLocalBookmarks";
import StickyControlBar from "../../../components/general/StickyControlBar";
import ActiveFilterChips from "../../../components/general/ActiveFilterChips";
import StatSummaryStrip from "../../../components/general/StatSummaryStrip";
import VirtualizedCardGrid from "../../../components/general/VirtualizedCardGrid";
import MobileFilterSheet from "../../../components/general/MobileFilterSheet";
import DigitalReaderModal from "../../../components/general/DigitalReaderModal";
import CiteThisItemModal from "../../../components/general/CiteThisItemModal";
import useAuthStore from "../../../store/authStore";
import { useBookSearch } from "../../../hooks/useBookData";
import useBookAvailability from "../../../hooks/useBookAvailability";
import BookDataState from "../../../components/common/BookDataState";

const GENRES = [
  "All",
  "Computer Science",
  "Architecture",
  "Economics",
  "Biology",
  "Literature",
  "Chemistry",
  "Environmental Science",
  "Physics",
];
const AVAILABILITY_OPTIONS = ["All", "available", "checked_out", "on_hold"];

const SORT_OPTIONS = [
  { value: "relevance", label: "Sort: Relevance" },
  { value: "title", label: "Title (A-Z)" },
  { value: "newest", label: "Publication Year (Newest)" },
  { value: "available", label: "Most Available Copies" },
];

const GeneralSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const collegeId = user?.collegeId || null;

  const { toggleBookmark, isBookmarked } = useLocalBookmarks();

  // Read filter values directly from URL search params as source of truth
  const urlQuery = searchParams.get("q") || "";
  const selectedGenre = searchParams.get("category") || "All";
  const selectedAvailability = searchParams.get("available") || "All";
  const selectedFormat = searchParams.get("format") || "All";
  const sortBy = searchParams.get("sortBy") || "relevance";

  const [rawQuery, setRawQuery] = useState(urlQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery);
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);

  // Sync rawQuery & debouncedQuery when urlQuery changes via browser navigation
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    setRawQuery(urlQuery);
    setDebouncedQuery(urlQuery);
  }

  const [viewMode, setViewMode] = useState("grid");
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [genreSearch, setGenreSearch] = useState("");
  const [selectedLocationBook, setSelectedLocationBook] = useState(null);
  const [activeDigitalBook, setActiveDigitalBook] = useState(null);
  const [citeBook, setCiteBook] = useState(null);

  // Helper to update URL search params
  const updateUrlFilters = useCallback(
    (updates) => {
      const nextParams = new URLSearchParams(searchParams);
      const nextState = {
        q: debouncedQuery,
        category: selectedGenre,
        available: selectedAvailability,
        format: selectedFormat,
        sortBy,
        ...updates,
      };

      if (nextState.q) nextParams.set("q", nextState.q);
      else nextParams.delete("q");

      if (nextState.category && nextState.category !== "All")
        nextParams.set("category", nextState.category);
      else nextParams.delete("category");

      if (nextState.available && nextState.available !== "All")
        nextParams.set("available", nextState.available);
      else nextParams.delete("available");

      if (nextState.format && nextState.format !== "All")
        nextParams.set("format", nextState.format);
      else nextParams.delete("format");

      if (nextState.sortBy && nextState.sortBy !== "relevance")
        nextParams.set("sortBy", nextState.sortBy);
      else nextParams.delete("sortBy");

      setSearchParams(nextParams, { replace: true });
    },
    [
      searchParams,
      setSearchParams,
      debouncedQuery,
      selectedGenre,
      selectedAvailability,
      selectedFormat,
      sortBy,
    ],
  );

  // Debounce input search query changes (~300ms) & push to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(rawQuery);
      if (rawQuery !== urlQuery) {
        updateUrlFilters({ q: rawQuery });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [rawQuery, urlQuery, updateUrlFilters]);

  // Unified React Query Shared Data Layer Hook
  const {
    data: searchData,
    isLoading,
    isError,
    error,
    refetch,
  } = useBookSearch(collegeId, {
    q: debouncedQuery,
    category: selectedGenre,
    format: selectedFormat,
    available: selectedAvailability,
    sortBy,
    limit: 50,
  });

  useBookAvailability(collegeId, refetch);

  const catalogBooks = useMemo(
    () => searchData?.books || [],
    [searchData?.books],
  );

  // Compute stat summary metrics
  const stats = useMemo(() => {
    const available = catalogBooks.filter(
      (b) => b.availabilityStatus === "available" || b.availableCopies > 0,
    ).length;
    const onHold = catalogBooks.filter(
      (b) => b.availabilityStatus === "on_hold",
    ).length;
    const checkedOut = catalogBooks.filter(
      (b) => b.availabilityStatus === "checked_out" || b.availableCopies === 0,
    ).length;

    return [
      {
        label: "Total Matches",
        value: catalogBooks.length,
        icon: BookOpen,
        colorClass: "text-indigo-400",
        bgBadgeClass:
          "bg-indigo-950 text-indigo-300 border border-indigo-800/80",
      },
      {
        label: "Available",
        value: available,
        icon: CheckCircle2,
        colorClass: "text-emerald-400",
        bgBadgeClass:
          "bg-emerald-950 text-emerald-300 border border-emerald-800/80",
      },
      {
        label: "On Hold",
        value: onHold,
        icon: Clock,
        colorClass: "text-amber-400",
        bgBadgeClass: "bg-amber-950 text-amber-300 border border-amber-800/80",
      },
      {
        label: "Checked Out",
        value: checkedOut,
        icon: BookX,
        colorClass: "text-rose-400",
        bgBadgeClass: "bg-rose-950 text-rose-300 border border-rose-800/80",
      },
    ];
  }, [catalogBooks]);

  const activeChips = [
    { key: "query", label: "Keyword", value: debouncedQuery },
    { key: "genre", label: "Genre", value: selectedGenre },
    { key: "availability", label: "Status", value: selectedAvailability },
    { key: "format", label: "Format", value: selectedFormat },
  ];

  const handleRemoveChip = (key) => {
    if (key === "query") {
      setRawQuery("");
      setDebouncedQuery("");
      updateUrlFilters({ q: "" });
    }
    if (key === "genre") {
      updateUrlFilters({ category: "All" });
    }
    if (key === "availability") {
      updateUrlFilters({ available: "All" });
    }
    if (key === "format") {
      updateUrlFilters({ format: "All" });
    }
  };

  const handleResetAll = () => {
    setRawQuery("");
    setDebouncedQuery("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const filteredGenresList = GENRES.filter((g) =>
    g.toLowerCase().includes(genreSearch.toLowerCase()),
  );

  const filterContent = (
    <div className="space-y-5 text-slate-100">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Genre / Subject
        </label>
        <div className="relative mb-2">
          <SearchCode className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={genreSearch}
            onChange={(e) => setGenreSearch(e.target.value)}
            placeholder="Search genres..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
          {filteredGenresList.map((genre) => (
            <button
              key={genre}
              onClick={() => updateUrlFilters({ category: genre })}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                selectedGenre === genre
                  ? "bg-indigo-950 text-indigo-300 font-bold border border-indigo-800/80"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span>{genre}</span>
              {selectedGenre === genre && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-800 pt-4">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Status & Availability
        </label>
        <div className="space-y-1">
          {AVAILABILITY_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => updateUrlFilters({ available: status })}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                selectedAvailability === status
                  ? "bg-indigo-950 text-indigo-300 font-bold border border-indigo-800/80"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span className="capitalize">{status.replace("_", " ")}</span>
              {selectedAvailability === status && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-full max-w-7xl mx-auto p-3 sm:p-4 gap-4 font-sans pb-10 text-slate-100">
      <StickyControlBar
        searchQuery={rawQuery}
        onSearchChange={setRawQuery}
        onClearSearch={() => {
          setRawQuery("");
          setDebouncedQuery("");
          updateUrlFilters({ q: "" });
        }}
        placeholder="Search catalog by title, author, or discipline..."
        sortBy={sortBy}
        onSortChange={(val) => updateUrlFilters({ sortBy: val })}
        sortOptions={SORT_OPTIONS}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenMobileFilters={() => setShowFiltersSheet(true)}
        _resultCount={catalogBooks.length}
        filterSlot={
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <StatSummaryStrip items={stats} />
            <button
              onClick={() => setShowFiltersSheet(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/80 text-indigo-300 font-bold text-xs rounded-xl border border-indigo-800/80 hover:bg-indigo-900 transition-all ml-auto"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Faceted Filters</span>
            </button>
          </div>
        }
      />

      <ActiveFilterChips
        chips={activeChips}
        onRemoveChip={handleRemoveChip}
        onResetAll={handleResetAll}
      />

      <BookDataState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        isEmpty={catalogBooks.length === 0}
        emptyState={
          <div className="bg-slate-900 p-8 sm:p-12 rounded-3xl border border-slate-800 shadow-2xl text-center space-y-4 max-w-md mx-auto my-auto text-slate-100">
            <div className="p-3 bg-indigo-950 text-indigo-400 border border-indigo-800/60 rounded-2xl w-12 h-12 mx-auto flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">
              No Matching Catalog Items
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              We couldn’t find any physical books matching your active search
              query and filter combination.
            </p>
            <button
              onClick={handleResetAll}
              className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-500 transition-colors shadow-md"
            >
              Clear All Filters
            </button>
          </div>
        }
      >
        <VirtualizedCardGrid
          items={catalogBooks}
          loading={isLoading}
          viewMode={viewMode}
          columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          renderItem={(book) => (
            <ResultCard
              key={book._id || book.id}
              book={{
                ...book,
                id: book._id || book.id,
                genre: book.category || book.genre,
                availableCopies: book.availableCopies,
                location: book.shelfLocation || "Main Stacks",
              }}
              isBookmarked={isBookmarked(book._id || book.id)}
              onToggleBookmark={toggleBookmark}
              onViewLocation={(b) => setSelectedLocationBook(b)}
              onReadOnline={(b) => setActiveDigitalBook(b)}
              onCite={(b) => setCiteBook(b)}
            />
          )}
        />
      </BookDataState>

      <MobileFilterSheet
        isOpen={showFiltersSheet}
        onClose={() => setShowFiltersSheet(false)}
        title="Faceted Catalog Filters"
        onResetAll={handleResetAll}
      >
        {filterContent}
      </MobileFilterSheet>

      <DigitalReaderModal
        isOpen={Boolean(activeDigitalBook)}
        onClose={() => setActiveDigitalBook(null)}
        fileUrl={
          activeDigitalBook?.fileUrl ||
          activeDigitalBook?.digitalUrl ||
          activeDigitalBook?.pdfUrl ||
          activeDigitalBook?.url
        }
        fileType={
          activeDigitalBook?.fileType || activeDigitalBook?.format || "pdf"
        }
        title={activeDigitalBook?.title}
        book={activeDigitalBook}
      />

      <CiteThisItemModal
        isOpen={Boolean(citeBook)}
        onClose={() => setCiteBook(null)}
        item={citeBook}
      />

      {selectedLocationBook && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-800 relative animate-in fade-in zoom-in-95 duration-200 space-y-4 text-slate-100">
            <button
              onClick={() => setSelectedLocationBook(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-950 text-indigo-400 border border-indigo-800/60 rounded-2xl">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  {selectedLocationBook.title}
                </h3>
                <p className="text-xs text-slate-400">Physical Shelf Mapping</p>
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400 font-medium">Shelf Code</span>
                <span className="font-bold text-indigo-300">
                  {selectedLocationBook.shelfLocation ||
                    selectedLocationBook.location ||
                    "Main Stacks"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400 font-medium">
                  Copies Available
                </span>
                <span className="font-bold text-slate-100">
                  {selectedLocationBook.availableCopies} Copies
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedLocationBook(null)}
              className="w-full py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20"
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
