import React, { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  CheckCircle2,
  Search,
  X,
  AlertCircle,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import { SectionLabel } from "../components/ui/SectionLabel";
import { BookCoverImage } from "../components/common/BookCoverImage";
import useAuthStore from "../store/authStore";
import apiClient from "../api/client";

export interface CatalogBook {
  _id?: string;
  id: string;
  title: string;
  author: string;
  category: string;
  shelfLocation?: string;
  shelf?: string;
  copiesAvailable?: number;
  copiesTotal?: number;
  availability?: string;
  coverImage?: string;
  format?: string;
}

const DEFAULT_CATALOG_BOOKS: CatalogBook[] = [
  {
    id: "cat-1",
    title: "Clean Code: A Handbook of Agile Software Craftsmanship",
    author: "Robert C. Martin",
    category: "Computer Science",
    shelf: "Shelf CS-204",
    availability: "Available",
    coverImage:
      "https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=400&q=80",
  },
  {
    id: "cat-2",
    title: "Introduction to Algorithms, 4th Edition",
    author: "Thomas H. Cormen et al.",
    category: "Algorithms",
    shelf: "Shelf AL-101",
    availability: "Available",
    coverImage:
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80",
  },
  {
    id: "cat-3",
    title: "Designing Data-Intensive Applications",
    author: "Martin Kleppmann",
    category: "System Design",
    shelf: "Shelf SD-305",
    availability: "Available",
    coverImage:
      "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&q=80",
  },
  {
    id: "cat-4",
    title: "Artificial Intelligence: A Modern Approach",
    author: "Stuart Russell & Peter Norvig",
    category: "AI & ML",
    shelf: "Shelf AI-402",
    availability: "3 Copies Left",
    coverImage:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&q=80",
  },
  {
    id: "cat-5",
    title: "Operating System Concepts",
    author: "Abraham Silberschatz",
    category: "Systems",
    shelf: "Shelf OS-110",
    availability: "Available",
    coverImage:
      "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&q=80",
  },
  {
    id: "cat-6",
    title: "Structure and Interpretation of Computer Programs",
    author: "Harold Abelson & Gerald Jay Sussman",
    category: "Programming",
    shelf: "Shelf CS-118",
    availability: "Available",
    coverImage:
      "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80",
  },
  {
    id: "cat-7",
    title: "Computer Networking: A Top-Down Approach",
    author: "James Kurose & Keith Ross",
    category: "Networking",
    shelf: "Shelf NW-220",
    availability: "Available",
    coverImage:
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&q=80",
  },
];

const CATEGORIES = [
  "All",
  "Computer Science",
  "Algorithms",
  "System Design",
  "AI & ML",
  "Systems",
  "Programming",
  "Networking",
];

export const CatalogSearch: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Search & Filter state
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Data fetching state
  const [books, setBooks] = useState<CatalogBook[]>(DEFAULT_CATALOG_BOOKS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mouse drag & interaction tracking
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch real books from public endpoint
  const fetchPublicBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/books/public", {
        params: {
          search: debouncedSearch.trim() || undefined,
          category: activeCategory !== "All" ? activeCategory : undefined,
          limit: 12,
        },
        timeout: 8000,
      });

      if (res.data?.success && Array.isArray(res.data?.data)) {
        if (res.data.data.length > 0) {
          const mapped = res.data.data.map((item: any) => ({
            _id: item._id,
            id: item._id || item.id,
            title: item.title,
            author: item.author,
            category: item.category || "General",
            shelf: item.shelfLocation || "Main Stacks",
            availability:
              item.copiesAvailable !== undefined
                ? item.copiesAvailable > 0
                  ? `${item.copiesAvailable} Available`
                  : "Checked Out"
                : "Available",
            copiesAvailable: item.copiesAvailable,
            copiesTotal: item.copiesTotal,
            coverImage: item.coverImage,
            format: item.format,
          }));
          setBooks(mapped);
        } else if (!debouncedSearch && activeCategory === "All") {
          // Fresh/unseeded backend fallback
          setBooks(DEFAULT_CATALOG_BOOKS);
        } else {
          setBooks([]);
        }
      } else {
        setBooks(DEFAULT_CATALOG_BOOKS);
      }
    } catch (err: any) {
      if (err?.response?.status === 503) {
        setError(
          err?.response?.data?.message ||
            "BookBuddy is currently undergoing scheduled platform maintenance. Please check back shortly.",
        );
        setBooks([]);
        return;
      }
      // In isolated client tests or offline dev, if API is unavailable, fallback gracefully or report error
      if (debouncedSearch || activeCategory !== "All") {
        const filtered = DEFAULT_CATALOG_BOOKS.filter((b) => {
          const matchCat =
            activeCategory === "All" ||
            b.category.toLowerCase() === activeCategory.toLowerCase();
          const matchSearch =
            !debouncedSearch ||
            b.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            b.author.toLowerCase().includes(debouncedSearch.toLowerCase());
          return matchCat && matchSearch;
        });
        setBooks(filtered);
      } else {
        setBooks(DEFAULT_CATALOG_BOOKS);
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, activeCategory]);

  useEffect(() => {
    fetchPublicBooks();
  }, [fetchPublicBooks]);

  // Horizontal scroll buttons
  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 340;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Keyboard navigation on carousel container
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scroll("left");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scroll("right");
    }
  };

  // Mouse drag events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.cursor = "grabbing";
    scrollRef.current.style.userSelect = "none";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(walk) > 4) {
      hasMovedRef.current = true;
    }
    scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    if (!scrollRef.current) return;
    isDraggingRef.current = false;
    scrollRef.current.style.cursor = "grab";
    scrollRef.current.style.removeProperty("user-select");
  };

  // Wheel horizontal scroll helper
  const handleWheel = (e: React.WheelEvent) => {
    if (
      scrollRef.current &&
      Math.abs(e.deltaY) > Math.abs(e.deltaX) &&
      Math.abs(e.deltaY) > 8
    ) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  // Click card handler with drag check and deep link preservation
  const handleBookClick = (book: CatalogBook) => {
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }

    const targetId = book._id || book.id;

    if (isAuthenticated && user) {
      const role = user.role;
      if (role === "college-admin") {
        navigate("/college-admin");
      } else if (role === "general") {
        navigate(
          `/general-dashboard/search?bookId=${encodeURIComponent(targetId)}`,
        );
      } else if (role === "super-admin") {
        navigate("/admin-portal");
      } else {
        navigate(`/student/catalog?bookId=${encodeURIComponent(targetId)}`);
      }
    } else {
      // (P0) Clicking any book while logged out redirects to Login and preserves destination
      navigate("/auth/login", {
        state: {
          from: "catalog-search",
          bookId: targetId,
          bookTitle: book.title,
          book,
          returnUrl: `/student/catalog?bookId=${encodeURIComponent(targetId)}`,
        },
      });
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setActiveCategory("All");
  };

  // Bounded list (limit=12)
  const displayBooks = books.slice(0, 12);

  return (
    <section
      id="catalog-search"
      data-section="catalog-search"
      className="bg-void py-24 md:py-32 border-b border-edge relative overflow-hidden"
      aria-label="Catalog Search"
    >
      {/* Background glow decoration */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-indigo-500/5 via-ember/5 to-transparent rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24">
        {/* Section Header & Navigation Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <SectionLabel>CAMPUS COLLECTION</SectionLabel>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-ink mt-2 mb-4 hover:brightness-110 transition-all duration-300 cursor-default select-text">
              Catalog Search
            </h2>
            <p className="text-muted text-sm sm:text-base md:text-lg max-w-2xl leading-relaxed select-text">
              Explore 15,000+ course reserves and physical volumes across campus
              library branches. Sign in to reserve physical copies, track loans,
              or join waitlists.
            </p>
          </div>

          {/* Carousel Arrows */}
          <div className="flex items-center gap-3 self-start md:self-end">
            <button
              onClick={() => scroll("left")}
              aria-label="Scroll catalog left"
              className="w-11 h-11 rounded-xl bg-surface border border-edge hover:border-ember/40 hover:bg-surface/80 flex items-center justify-center text-ink transition-all duration-200 active:scale-95 shadow-sm cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll("right")}
              aria-label="Scroll catalog right"
              className="w-11 h-11 rounded-xl bg-surface border border-edge hover:border-ember/40 hover:bg-surface/80 flex items-center justify-center text-ink transition-all duration-200 active:scale-95 shadow-sm cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Box & Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, author, or keyword..."
              aria-label="Search catalog"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface/70 border border-edge hover:border-ember/40 focus:border-ember focus:ring-1 focus:ring-ember text-ink text-sm outline-none transition-all placeholder:text-muted/70"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded-full transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs font-semibold px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 border cursor-pointer ${
                activeCategory === cat
                  ? "bg-ember text-white border-ember shadow-sm"
                  : "bg-surface/60 text-muted border-edge hover:border-white/20 hover:text-ink"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Loading Skeleton Row */}
        {loading && (
          <div
            data-testid="catalog-skeleton"
            className="flex gap-6 overflow-hidden py-2"
            aria-label="Loading catalog items"
          >
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="flex-shrink-0 w-64 md:w-72 bg-surface/40 border border-edge/60 rounded-2xl p-4 flex flex-col justify-between h-[490px] animate-pulse"
              >
                <div>
                  <div className="w-full h-60 bg-edge/40 rounded-xl mb-3.5" />
                  <div className="w-16 h-3 bg-edge/40 rounded mb-2" />
                  <div className="w-3/4 h-5 bg-edge/50 rounded mb-2" />
                  <div className="w-1/2 h-3.5 bg-edge/30 rounded" />
                </div>
                <div className="pt-3 border-t border-edge/30 flex justify-between">
                  <div className="w-20 h-3 bg-edge/30 rounded" />
                  <div className="w-12 h-3 bg-edge/30 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State with Retry Button */}
        {!loading && error && (
          <div
            data-testid="catalog-error"
            className="p-8 rounded-2xl bg-surface/50 border border-amber-500/20 text-center flex flex-col items-center justify-center my-6"
          >
            <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
            <h3 className="text-lg font-serif font-bold text-ink mb-1">
              {error.toLowerCase().includes("maintenance")
                ? "Platform Maintenance"
                : "Unable to load campus collection"}
            </h3>
            <p className="text-sm text-muted max-w-md mb-4">{error}</p>
            <button
              onClick={() => fetchPublicBooks()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-ember hover:bg-ember/90 text-white text-xs font-semibold shadow transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && displayBooks.length === 0 && (
          <div
            data-testid="catalog-empty"
            className="p-12 rounded-2xl bg-surface/40 border border-edge text-center flex flex-col items-center justify-center my-6"
          >
            <BookOpen className="w-12 h-12 text-muted mb-3 opacity-60" />
            <h3 className="text-lg font-serif font-bold text-ink mb-1">
              No Catalog Items Found
            </h3>
            <p className="text-sm text-muted max-w-md mb-4">
              {debouncedSearch
                ? `No books match "${debouncedSearch}". Try checking your spelling or clear active filters.`
                : "There are currently no items available in this category."}
            </p>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-edge hover:border-ember text-ink text-xs font-semibold transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Horizontal Scrolling Book Carousel */}
        {!loading && !error && displayBooks.length > 0 && (
          <div
            ref={scrollRef}
            data-testid="catalog-carousel"
            onKeyDown={handleKeyDown}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onWheel={handleWheel}
            style={{ WebkitOverflowScrolling: "touch" }}
            className="flex gap-6 overflow-x-auto scrollbar-none snap-x snap-mandatory py-6 px-1 -mx-1 scroll-smooth focus:outline-none cursor-grab active:cursor-grabbing select-none touch-pan-x"
            tabIndex={0}
            role="region"
            aria-label="Catalog Books Carousel"
          >
            {displayBooks.map((book) => (
              <div
                key={book._id || book.id}
                data-testid="catalog-book-card"
                role="button"
                tabIndex={0}
                aria-label={`${book.title} by ${book.author}`}
                onClick={() => handleBookClick(book)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleBookClick(book);
                  }
                }}
                className="flex-shrink-0 w-64 md:w-72 bg-surface/70 hover:bg-surface border border-edge hover:border-ember/40 rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl group snap-start flex flex-col justify-between h-[490px]"
              >
                {/* Cover Image Container */}
                <div className="relative mb-3.5 overflow-hidden rounded-xl bg-deep h-60 w-full shadow-md flex-shrink-0">
                  <BookCoverImage
                    src={book.coverImage}
                    alt={book.title}
                    aspectRatio="h-full"
                    fallbackTitle={book.title}
                    fallbackCategory={book.category}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Subtle Hover Action Pill */}
                  <div className="absolute inset-0 bg-void/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4 text-center backdrop-blur-xs">
                    <span className="text-xs font-bold text-white bg-ember px-3.5 py-1.5 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      Sign In to Reserve →
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-emerald-300 backdrop-blur-md border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {book.availability || "Available"}
                    </span>
                  </div>
                </div>

                {/* Book Metadata */}
                <div className="flex flex-col flex-grow justify-between min-h-0">
                  <div>
                    <span className="text-[11px] font-bold tracking-wider text-ember uppercase mb-1 block truncate">
                      {book.category}
                    </span>
                    <h3
                      className="font-serif text-base md:text-lg font-semibold text-ink line-clamp-2 leading-snug group-hover:text-ember transition-colors min-h-[2.8rem]"
                      title={book.title}
                    >
                      {book.title}
                    </h3>
                    <p
                      className="text-sm text-muted mt-1 truncate"
                      title={book.author}
                    >
                      {book.author}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-edge flex items-center justify-between text-xs text-muted">
                    <span className="flex items-center gap-1 truncate max-w-[65%]">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <span className="truncate">
                        {book.shelf || "Main Stacks"}
                      </span>
                    </span>
                    <span className="font-medium text-ember hover:underline flex-shrink-0">
                      Details →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default CatalogSearch;
