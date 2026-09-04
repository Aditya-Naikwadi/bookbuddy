import { useState, useEffect } from "react";
import {
  Bell,
  Filter,
  Search,
  BookOpen,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../../../api/client";
import { Button } from "../../../components/ui/Button";

// Fetch catalog with complete search & filter parameters
const fetchCatalog = async ({ queryKey }) => {
  const { query, category, format, availability, sortBy, page } = queryKey[1];
  const { data } = await apiClient.get("/dashboards/student/catalog", {
    params: {
      query,
      category,
      format,
      availability,
      sortBy,
      page,
      limit: 10,
    },
  });
  return data; // returns success: true, data: [...], pagination: { total, page, pages }
};

// Skeleton loader cards for clean visual perceived performance
const CatalogSkeleton = () => (
  <div
    className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6"
    aria-hidden="true"
  >
    {[...Array(10)].map((_, i) => (
      <div
        key={i}
        className="bg-surface/30 rounded-xl border border-edge/50 overflow-hidden flex flex-col p-4 space-y-4 animate-pulse"
      >
        <div className="h-44 bg-edge/40 rounded-lg w-full"></div>
        <div className="h-4 bg-edge/40 rounded w-3/4"></div>
        <div className="h-3 bg-edge/40 rounded w-1/2"></div>
        <div className="h-8 bg-edge/40 rounded mt-auto w-full"></div>
      </div>
    ))}
  </div>
);

const Catalog = () => {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [format, setFormat] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("title");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [queueMessage, setQueueMessage] = useState(null);

  // Debounce search query by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchInput);
      setPage(1); // Reset to first page on search
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput]);

  // Query catalog using TanStack Query
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "catalog",
      { query: debouncedQuery, category, format, availability, sortBy, page },
    ],
    queryFn: fetchCatalog,
    keepPreviousData: true,
  });

  const books = data?.data || [];
  const pagination = data?.pagination || { total: 0, page: 1, pages: 1 };

  // Dynamically compute the screen reader live region announcement to avoid synchronous setState inside useEffect
  const term = debouncedQuery ? ` matching "${debouncedQuery}"` : "";
  const ariaAnnouncement = isLoading
    ? "Loading catalog..."
    : `Found ${pagination.total} books${term}.`;

  // Place a reservation hold on a checked-out book
  const handlePlaceHold = async (bookId) => {
    try {
      const res = await apiClient.post("/dashboards/student/reservations", {
        bookId,
      });
      setQueueMessage({
        type: "success",
        text: res.data.message || "Hold placed successfully!",
      });
      refetch();
    } catch (err) {
      setQueueMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Failed to place hold. Please try again.",
      });
    }
    setTimeout(() => setQueueMessage(null), 5000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-6">
      {/* Screen Reader Live Region */}
      <div className="sr-only" role="status" aria-live="polite">
        {ariaAnnouncement}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-edge/20 pb-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-ink">
            Library Catalog
          </h1>
          <p className="text-sm text-muted">
            Discover e-books, physical assets, and learning resources.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="flex items-center gap-2"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="advanced-filters"
          >
            <Filter size={18} />
            Filters
          </Button>
          <Button
            variant="ghost"
            className="p-3"
            onClick={() => refetch()}
            aria-label="Refresh catalog"
          >
            <RefreshCw size={18} />
          </Button>
        </div>
      </div>

      {/* Inline Banner for User Feedback */}
      {queueMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 shadow-md transition-all ${
            queueMessage.type === "success"
              ? "bg-success/10 border-success/30 text-success"
              : "bg-danger/10 border-danger/30 text-danger"
          }`}
          role="alert"
        >
          <AlertCircle className="shrink-0" size={20} />
          <p className="text-sm font-semibold">{queueMessage.text}</p>
        </div>
      )}

      {/* Advanced Filters Panel */}
      <div
        id="advanced-filters"
        className={`grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 glass-panel bg-surface/20 border border-edge/30 rounded-xl transition-all duration-300 ${
          showFilters
            ? "opacity-100 max-h-[500px] visible"
            : "opacity-0 max-h-0 overflow-hidden invisible py-0 border-none"
        }`}
        aria-hidden={!showFilters}
      >
        <div>
          <label
            htmlFor="format-filter"
            className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2"
          >
            Format
          </label>
          <select
            id="format-filter"
            value={format}
            onChange={(e) => {
              setFormat(e.target.value);
              setPage(1);
            }}
            className="w-full p-2.5 bg-surface/50 border border-edge rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember"
          >
            <option value="all">All Formats</option>
            <option value="physical">Physical Books</option>
            <option value="digital">E-Books (Digital)</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="availability-filter"
            className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2"
          >
            Availability
          </label>
          <select
            id="availability-filter"
            value={availability}
            onChange={(e) => {
              setAvailability(e.target.value);
              setPage(1);
            }}
            className="w-full p-2.5 bg-surface/50 border border-edge rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember"
          >
            <option value="all">All Availability</option>
            <option value="available">Available Now</option>
            <option value="checked-out">All Checked Out</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="category-filter"
            className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2"
          >
            Subject / Category
          </label>
          <select
            id="category-filter"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="w-full p-2.5 bg-surface/50 border border-edge rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember"
          >
            <option value="all">All Categories</option>
            <option value="Science">Science</option>
            <option value="Fiction">Fiction</option>
            <option value="Technology">Technology</option>
            <option value="Arts">Arts</option>
            <option value="Biography">Biography</option>
            <option value="History">History</option>
            <option value="General">General</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="sort-filter"
            className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2"
          >
            Sort By
          </label>
          <select
            id="sort-filter"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="w-full p-2.5 bg-surface/50 border border-edge rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ember"
          >
            <option value="title">Alphabetical (Title)</option>
            {debouncedQuery && <option value="relevance">Relevance</option>}
            <option value="newest">Newest Added</option>
          </select>
        </div>
      </div>

      {/* Live Debounced Search Bar */}
      <div className="relative">
        <label htmlFor="catalog-search" className="sr-only">
          Search catalog
        </label>
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted">
          <Search size={20} />
        </div>
        <input
          id="catalog-search"
          type="search"
          placeholder="Search by title, author, category or keywords..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-surface/50 border border-edge rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-ember placeholder-muted/60 shadow-sm"
        />
      </div>

      {/* Active Filters Removable Chips */}
      {(debouncedQuery ||
        format !== "all" ||
        availability !== "all" ||
        category !== "all") && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Active Filters:</span>
          {debouncedQuery && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-ember/10 border border-ember/20 text-ink">
              Search: "{debouncedQuery}"
              <button
                onClick={() => setSearchInput("")}
                className="hover:text-ember focus:outline-none font-bold text-sm leading-none pl-1"
                aria-label="Remove search filter"
              >
                &times;
              </button>
            </span>
          )}
          {format !== "all" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-ember/10 border border-ember/20 text-ink">
              Format: {format === "digital" ? "E-Book" : "Physical"}
              <button
                onClick={() => setFormat("all")}
                className="hover:text-ember focus:outline-none font-bold text-sm leading-none pl-1"
                aria-label="Remove format filter"
              >
                &times;
              </button>
            </span>
          )}
          {availability !== "all" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-ember/10 border border-ember/20 text-ink">
              Availability:{" "}
              {availability === "available" ? "Available Now" : "Checked Out"}
              <button
                onClick={() => setAvailability("all")}
                className="hover:text-ember focus:outline-none font-bold text-sm leading-none pl-1"
                aria-label="Remove availability filter"
              >
                &times;
              </button>
            </span>
          )}
          {category !== "all" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-ember/10 border border-ember/20 text-ink">
              Subject: {category}
              <button
                onClick={() => setCategory("all")}
                className="hover:text-ember focus:outline-none font-bold text-sm leading-none pl-1"
                aria-label="Remove subject filter"
              >
                &times;
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setSearchInput("");
              setFormat("all");
              setAvailability("all");
              setCategory("all");
            }}
            className="text-xs text-ember hover:underline font-semibold focus:outline-none ml-2"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && <CatalogSkeleton />}

      {/* Error State */}
      {isError && (
        <div className="p-6 bg-danger/10 border border-danger/20 text-danger rounded-xl flex items-center gap-4">
          <AlertCircle size={24} />
          <div>
            <h3 className="font-bold">Catalog Load Failure</h3>
            <p className="text-sm">
              We are unable to load library catalog. Please check your network
              and try again.
            </p>
          </div>
        </div>
      )}

      {/* Catalog Grid */}
      {!isLoading && !isError && (
        <>
          {books.length === 0 ? (
            <div className="text-center py-16 p-6 glass-panel border border-edge/30 rounded-xl flex flex-col items-center max-w-lg mx-auto">
              <BookOpen className="text-muted/40 mb-4" size={48} />
              <h3 className="text-lg font-bold text-ink">
                No results match your search
              </h3>
              <p className="text-sm text-muted mt-2">
                Try expanding your search query, checking for spelling mistakes,
                or adjusting your filter settings.
              </p>
              <Button
                variant="ghost"
                className="mt-6"
                onClick={() => {
                  setSearchInput("");
                  setFormat("all");
                  setAvailability("all");
                  setCategory("all");
                }}
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 [content-visibility:auto] [contain-intrinsic-size:1px_300px]">
              {books.map((book) => (
                <div
                  key={book._id}
                  className="bg-surface/30 rounded-xl border border-edge/40 overflow-hidden hover:border-ember/40 transition-all flex flex-col group relative focus-within:ring-2 focus-within:ring-ember shadow-sm hover:shadow-md"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                    }
                  }}
                >
                  {/* Notify alert toggle */}
                  {book.copiesAvailable === 0 && (
                    <button
                      className="absolute top-3 left-3 z-10 bg-surface/90 hover:bg-surface border border-edge/30 p-2 rounded-full shadow-sm text-muted hover:text-ember transition-all opacity-100 focus:opacity-100"
                      title="Notify me when available"
                      aria-label={`Notify me when "${book.title}" becomes available`}
                    >
                      <Bell size={16} />
                    </button>
                  )}

                  {/* Thumbnail / Cover section */}
                  <div className="h-44 bg-surface/50 w-full relative flex items-center justify-center border-b border-edge/35 overflow-hidden">
                    {book.coverImage ? (
                      <img
                        src={book.coverImage}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300 aspect-[3/4]"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-muted/30 select-none">
                        <BookOpen size={40} />
                        <span className="text-[10px] mt-2 font-semibold">
                          NO COVER
                        </span>
                      </div>
                    )}

                    {/* Format Badge */}
                    <span className="absolute bottom-2 left-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-void/80 text-parchment backdrop-blur-sm border border-edge/20 shadow-sm">
                      {book.format === "digital" ? "E-Book" : "Physical"}
                    </span>

                    {/* Availability Status Badge */}
                    <span
                      className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${
                        book.copiesAvailable > 0
                          ? "bg-success/15 border border-success/30 text-success"
                          : "bg-danger/15 border border-danger/30 text-danger"
                      }`}
                    >
                      {book.copiesAvailable > 0
                        ? `Available (${book.copiesAvailable})`
                        : "Out of Stock"}
                    </span>
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    <span className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
                      {book.category}
                    </span>
                    <h3
                      className="font-bold text-ink line-clamp-2 leading-tight mb-1"
                      title={book.title}
                    >
                      {book.title}
                    </h3>
                    <p className="text-xs text-muted mb-4 line-clamp-1">
                      {book.author}
                    </p>

                    {/* Action buttons */}
                    {book.copiesAvailable > 0 ? (
                      <Button
                        variant="ghost"
                        className="mt-auto w-full text-xs h-9 font-semibold hover:border-ember hover:bg-ember/5"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        View Details
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        className="mt-auto w-full text-xs h-9 font-semibold"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaceHold(book._id);
                        }}
                      >
                        Join Queue
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Simple Pagination Footer */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-edge/20 pt-6 mt-4">
              <span className="text-xs text-muted">
                Showing Page <strong>{page}</strong> of{" "}
                <strong>{pagination.pages}</strong> ({pagination.total} total
                items)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  className="px-4 h-9 text-xs"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  aria-label="Previous page"
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  className="px-4 h-9 text-xs"
                  disabled={page === pagination.pages}
                  onClick={() => setPage(page + 1)}
                  aria-label="Next page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Catalog;
