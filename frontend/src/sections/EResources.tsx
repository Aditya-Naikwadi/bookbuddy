import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Sparkles,
  Search,
  X,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { SectionLabel } from "../components/ui/SectionLabel";
import { Button } from "../components/ui/Button";
import { BookCoverImage } from "../components/common/BookCoverImage";
import { motion } from "framer-motion";
import useAuthStore from "../store/authStore";
import apiClient from "../api/client";

export interface EResourceBook {
  _id?: string;
  id: string;
  title: string;
  author: string;
  genre: string;
  format: string;
  coverImage?: string;
  moderationStatus?: string;
  fileUrl?: string;
  readUrl?: string;
}

const DEFAULT_ERESOURCE_BOOKS: EResourceBook[] = [
  {
    id: "eb-1",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    genre: "Classic Fiction",
    format: "EPUB / PDF",
    moderationStatus: "approved",
    coverImage:
      "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80",
  },
  {
    id: "eb-2",
    title: "Frankenstein; Or, The Modern Prometheus",
    author: "Mary Shelley",
    genre: "Gothic Horror",
    format: "EPUB / PDF",
    moderationStatus: "approved",
    coverImage:
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80",
  },
  {
    id: "eb-3",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    genre: "American Literature",
    format: "EPUB / PDF",
    moderationStatus: "approved",
    coverImage:
      "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&q=80",
  },
  {
    id: "eb-4",
    title: "The Adventures of Sherlock Holmes",
    author: "Arthur Conan Doyle",
    genre: "Mystery & Detective",
    format: "EPUB / PDF",
    moderationStatus: "approved",
    coverImage:
      "https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=400&q=80",
  },
  {
    id: "eb-5",
    title: "The Time Machine",
    author: "H.G. Wells",
    genre: "Science Fiction",
    format: "EPUB / PDF",
    moderationStatus: "approved",
    coverImage:
      "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&q=80",
  },
  {
    id: "eb-6",
    title: "Dracula",
    author: "Bram Stoker",
    genre: "Horror / Gothic",
    format: "EPUB / PDF",
    moderationStatus: "approved",
    coverImage:
      "https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400&q=80",
  },
  {
    id: "eb-7",
    title: "The Metamorphosis",
    author: "Franz Kafka",
    genre: "Modernist Fiction",
    format: "EPUB / PDF",
    moderationStatus: "approved",
    coverImage:
      "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&q=80",
  },
];

const GENRES = [
  "All",
  "Classic Fiction",
  "Science Fiction",
  "American Literature",
  "Mystery & Detective",
  "Gothic Horror",
];

export const EResources = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuthStore();
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Search & Filter state
  const [activeGenre, setActiveGenre] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Data fetching state
  const [resources, setResources] = useState<EResourceBook[]>(
    DEFAULT_ERESOURCE_BOOKS,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drag interaction tracking
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch real approved e-resources from public endpoint
  const fetchPublicEResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/eresources/public", {
        params: {
          search: debouncedSearch.trim() || undefined,
          genre: activeGenre !== "All" ? activeGenre : undefined,
          limit: 12,
        },
        timeout: 8000,
      });

      if (res.data?.success && Array.isArray(res.data?.data)) {
        // STRICT REQUIREMENT 11: Only approved/published items appear
        const approvedOnly = res.data.data.filter(
          (item: any) =>
            !item.moderationStatus ||
            ["approved", "published"].includes(item.moderationStatus),
        );

        if (approvedOnly.length > 0) {
          const mapped = approvedOnly.map((item: any) => ({
            _id: item._id,
            id: item._id || item.id,
            title: item.title,
            author: item.author,
            genre: item.category || item.genre || "Public Domain",
            format: (item.format || item.type || "EPUB / PDF").toUpperCase(),
            moderationStatus: item.moderationStatus || "approved",
            coverImage: item.coverImage,
            fileUrl: item.fileUrl,
            readUrl: item.readUrl,
          }));
          setResources(mapped);
        } else if (!debouncedSearch && activeGenre === "All") {
          setResources(DEFAULT_ERESOURCE_BOOKS);
        } else {
          setResources([]);
        }
      } else {
        setResources(DEFAULT_ERESOURCE_BOOKS);
      }
    } catch (err: any) {
      if (err?.response?.status === 503) {
        setError(
          err?.response?.data?.message ||
            "BookBuddy is currently undergoing scheduled platform maintenance. Please check back shortly.",
        );
        setResources([]);
        return;
      }
      if (debouncedSearch || activeGenre !== "All") {
        const filtered = DEFAULT_ERESOURCE_BOOKS.filter((b) => {
          const matchGenre =
            activeGenre === "All" ||
            b.genre.toLowerCase() === activeGenre.toLowerCase();
          const matchSearch =
            !debouncedSearch ||
            b.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            b.author.toLowerCase().includes(debouncedSearch.toLowerCase());
          return matchGenre && matchSearch;
        });
        setResources(filtered);
      } else {
        setResources(DEFAULT_ERESOURCE_BOOKS);
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, activeGenre]);

  useEffect(() => {
    fetchPublicEResources();
  }, [fetchPublicEResources]);

  const scrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = 320;
      carouselRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Keyboard navigation on carousel container
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollCarousel("left");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollCarousel("right");
    }
  };

  // Mouse drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!carouselRef.current) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - carouselRef.current.offsetLeft;
    scrollLeftRef.current = carouselRef.current.scrollLeft;
    carouselRef.current.style.cursor = "grabbing";
    carouselRef.current.style.userSelect = "none";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(walk) > 4) {
      hasMovedRef.current = true;
    }
    carouselRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    if (!carouselRef.current) return;
    isDraggingRef.current = false;
    carouselRef.current.style.cursor = "grab";
    carouselRef.current.style.removeProperty("user-select");
  };

  // Wheel horizontal scroll helper
  const handleWheel = (e: React.WheelEvent) => {
    if (
      carouselRef.current &&
      Math.abs(e.deltaY) > Math.abs(e.deltaX) &&
      Math.abs(e.deltaY) > 8
    ) {
      carouselRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleBrowseLibrary = () => {
    const catalogSection =
      document.getElementById("catalog-search") ||
      document.getElementById("library") ||
      document.querySelector('[data-section="catalog-search"]');
    if (catalogSection) {
      catalogSection.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/auth/login");
    }
  };

  const handleBookClick = (book: EResourceBook) => {
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
          `/general-dashboard/e-resources?readId=${encodeURIComponent(targetId)}`,
        );
      } else if (role === "super-admin") {
        navigate("/admin-portal");
      } else {
        navigate(`/student/reader/${encodeURIComponent(targetId)}`);
      }
    } else {
      // (P0) Clicking any book while logged out redirects to Login and preserves destination
      navigate("/auth/login", {
        state: {
          from: "e-resources",
          bookId: targetId,
          bookTitle: book.title,
          book,
          isEResource: true,
          returnUrl: `/student/reader/${encodeURIComponent(targetId)}`,
        },
      });
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setActiveGenre("All");
  };

  // Bounded list (limit=12)
  const displayResources = resources.slice(0, 12);

  return (
    <section
      id="e-resources"
      data-section="e-resources"
      className="bg-deep py-24 md:py-32 xl:py-40 border-y border-edge relative"
      ref={containerRef}
      aria-label="E-Resources"
    >
      {/* Anchor alias for #e-books support */}
      <div id="e-books" className="absolute -top-24 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24">
        {/* Top Feature Hero */}
        <div className="flex flex-col md:flex-row items-center gap-12 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="w-full md:w-1/2"
          >
            <SectionLabel>{t("landing.eresourcesSection.label", "70,000+ FREE BOOKS")}</SectionLabel>
            <h2 className="font-serif text-2xl sm:text-4xl md:text-5xl text-ink mb-6 hover:brightness-110 transition-all duration-300 cursor-default select-text">
              {t("landing.eresourcesTitle", "Read anything. Anywhere.")}
            </h2>
            <p className="text-muted leading-relaxed text-sm sm:text-base md:text-lg mb-8 select-text">
              {t("landing.eresourcesSubtitle", "Powered by Project Gutenberg's public-domain catalog, filtered, searched, and read entirely inside BookBuddy — with your reading progress always saved.")}
            </p>
            <ul className="space-y-4 mb-8 text-ink font-medium">
              <li className="flex items-center gap-3 hover:translate-x-1.5 hover:text-white transition-all duration-200 cursor-default select-text">
                <span className="text-success text-xl">✓</span> {t("landing.eresourcesSection.readOnline", "Full in-app PDF & EPUB reader")}
              </li>
              <li className="flex items-center gap-3 hover:translate-x-1.5 hover:text-white transition-all duration-200 cursor-default select-text">
                <span className="text-success text-xl">✓</span> {t("landing.eresourcesSection.offlineReady", "Pick up where you left off")}
              </li>
              <li className="flex items-center gap-3 hover:translate-x-1.5 hover:text-white transition-all duration-200 cursor-default select-text">
                <span className="text-success text-xl">✓</span> {t("app.downloadForOffline", "Download for offline reading")}
              </li>
              <li className="flex items-center gap-3 hover:translate-x-1.5 hover:text-white transition-all duration-200 cursor-default select-text">
                <span className="text-success text-xl">✓</span> {t("landing.catalogSearch.inputPlaceholder", "Search by language, genre, author")}
              </li>
            </ul>
            {/* Requirement 1: "Browse the Library" CTA redirects to the Library / Catalog Search section */}
            <Button
              variant="secondary"
              size="lg"
              onClick={handleBrowseLibrary}
              aria-label={t("landing.browseLibrary", "Browse the Library →")}
            >
              {t("landing.browseLibrary", "Browse the Library →")}
            </Button>
          </motion.div>

          {/* 3D Book Graphic */}
          <div className="w-full md:w-1/2 h-[500px] relative flex items-center justify-center perspective-1000 group cursor-pointer">
            <div
              className={`relative w-full max-w-sm aspect-[3/4] transition-all duration-1000 ease-out transform-style-3d group-hover:scale-105 group-hover:rotate-y-[-5deg] ${inView ? "rotate-y-[-15deg]" : "rotate-y-0 translate-y-12 opacity-0"}`}
            >
              {/* Book 3 (Back) */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-800 to-indigo-950 rounded-r-2xl rounded-l-md shadow-2xl border border-indigo-900 border-l-4 border-l-indigo-900/50 transform translate-x-12 translate-y-6 -z-20 rotate-6" />

              {/* Book 2 (Middle) */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 rounded-r-2xl rounded-l-md shadow-2xl border border-slate-800 border-l-4 border-l-slate-800/50 transform translate-x-6 translate-y-3 -z-10 rotate-3" />

              {/* Book 1 (Front) */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#1E202E] to-[#0A0D15] rounded-r-3xl rounded-l-md shadow-[20px_20px_60px_rgba(0,0,0,0.8),-5px_0_20px_rgba(255,255,255,0.05)] border border-white/5 flex flex-col z-0 overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/60 via-white/10 to-transparent z-10 pointer-events-none" />
                <div className="absolute inset-y-0 left-8 w-px bg-white/10 z-10" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none" />

                <div className="flex flex-col h-full p-10 pl-14 relative z-20">
                  <div className="w-12 h-1 bg-gradient-to-r from-ember to-ember-glow mb-12 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                  <div className="text-sm font-bold tracking-widest text-indigo-300 uppercase mb-4">
                    Science Fiction
                  </div>
                  <h3 className="font-serif text-5xl text-white leading-tight mb-auto drop-shadow-md">
                    The Time
                    <br />
                    Machine
                  </h3>
                  <div className="flex items-center gap-3 mt-8">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border border-white/20 shadow-inner" />
                    <span className="text-sm text-indigo-100 font-medium tracking-wide">
                      H.G. Wells
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* E-Resources Carousel Section */}
        <div className="mt-20 pt-16 border-t border-edge/60">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1 block">
                {t("landing.eresourcesSection.freeBadge", "FREE IN-APP READING")}
              </span>
              <h3 className="font-serif text-2xl md:text-3xl lg:text-4xl text-ink font-semibold">
                {t("landing.eresourcesSection.heading", "Popular E-Resources & Classics")}
              </h3>
              <p className="text-muted text-sm md:text-base mt-2 max-w-2xl">
                {t("landing.eresourcesSection.subheading", "Free, unrestricted access to timeless books and literature. Click any title to sign in and start reading.")}
              </p>
            </div>

            {/* Carousel Navigation Arrows */}
            <div className="flex items-center gap-3 self-start md:self-end">
              <button
                onClick={() => scrollCarousel("left")}
                aria-label={t("landing.eresourcesSection.scrollLeft", "Scroll e-resources left")}
                className="w-11 h-11 rounded-xl bg-surface border border-edge hover:border-ember/40 hover:bg-surface/80 flex items-center justify-center text-ink transition-all duration-200 active:scale-95 shadow-sm cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => scrollCarousel("right")}
                aria-label={t("landing.eresourcesSection.scrollRight", "Scroll e-resources right")}
                className="w-11 h-11 rounded-xl bg-surface border border-edge hover:border-ember/40 hover:bg-surface/80 flex items-center justify-center text-ink transition-all duration-200 active:scale-95 shadow-sm cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Box & Genre Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("landing.eresourcesSection.inputPlaceholder", "Search e-books, classics, or authors...")}
                aria-label={t("landing.eresourcesSection.searchEResourcesAria", "Search e-resources")}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface/70 border border-edge hover:border-indigo-400/40 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-ink text-sm outline-none transition-all placeholder:text-muted/70"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  aria-label={t("landing.catalogSearch.clearSearch", "Clear search")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded-full transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Genre Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => setActiveGenre(g)}
                className={`text-xs font-semibold px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 border cursor-pointer ${
                  activeGenre === g
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-surface/60 text-muted border-edge hover:border-white/20 hover:text-ink"
                }`}
              >
                {g === "All" ? t("landing.all", "All") : g}
              </button>
            ))}
          </div>

          {/* Loading Skeleton Row */}
          {loading && (
            <div
              data-testid="eresources-skeleton"
              className="flex gap-6 overflow-hidden py-2"
              aria-label={t("landing.catalogSearch.loadingAria", "Loading e-resources")}
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
              data-testid="eresources-error"
              className="p-8 rounded-2xl bg-surface/50 border border-amber-500/20 text-center flex flex-col items-center justify-center my-6"
            >
              <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
              <h3 className="text-lg font-serif font-bold text-ink mb-1">
                {error.toLowerCase().includes("maintenance")
                  ? t("common.maintenance", "Platform Maintenance")
                  : t("landing.eresourcesSection.errorTitle", "Unable to load e-resources")}
              </h3>
              <p className="text-sm text-muted max-w-md mb-4">{error}</p>
              <button
                onClick={() => fetchPublicEResources()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t("landing.tryAgain", "Try Again")}
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && displayResources.length === 0 && (
            <div
              data-testid="eresources-empty"
              className="p-12 rounded-2xl bg-surface/40 border border-edge text-center flex flex-col items-center justify-center my-6"
            >
              <BookOpen className="w-12 h-12 text-muted mb-3 opacity-60" />
              <h3 className="text-lg font-serif font-bold text-ink mb-1">
                {t("landing.eresourcesSection.emptyTitle", "No E-Resources Found")}
              </h3>
              <p className="text-sm text-muted max-w-md mb-4">
                {debouncedSearch
                  ? `No digital resources match "${debouncedSearch}". Try checking your spelling or clear active filters.`
                  : t("landing.catalogSearch.emptyNotice", "There are currently no items available in this category.")}
              </p>
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-edge hover:border-indigo-400 text-ink text-xs font-semibold transition-all cursor-pointer"
              >
                {t("landing.eresourcesSection.resetFilters", "Reset Filters")}
              </button>
            </div>
          )}

          {/* Horizontal Scrolling Track */}
          {!loading && !error && displayResources.length > 0 && (
            <div
              ref={carouselRef}
              data-testid="eresources-carousel"
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
              aria-label={t("landing.eresourcesTitle", "E-Resources Books Carousel")}
            >
              {displayResources.map((book) => (
                <div
                  key={book._id || book.id}
                  data-testid="eresources-book-card"
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
                  className="flex-shrink-0 w-64 md:w-72 bg-surface/70 hover:bg-surface border border-edge hover:border-indigo-400/40 rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl group snap-start flex flex-col justify-between h-[490px]"
                >
                  {/* Book Cover */}
                  <div className="relative mb-3.5 overflow-hidden rounded-xl bg-void h-60 w-full shadow-md flex-shrink-0">
                    <BookCoverImage
                      src={book.coverImage}
                      alt={book.title}
                      aspectRatio="h-full"
                      fallbackTitle={book.title}
                      fallbackCategory={book.genre}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Hover Sign-in Callout */}
                    <div className="absolute inset-0 bg-void/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4 text-center backdrop-blur-xs">
                      <span className="text-xs font-bold text-white bg-indigo-600 px-3.5 py-1.5 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                        {t("landing.eresourcesSection.readOnline", "Sign In to Read →")}
                      </span>
                    </div>

                    {/* Format Badge */}
                    <div className="absolute top-2.5 right-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-indigo-300 backdrop-blur-md border border-indigo-500/20 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        {book.format}
                      </span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-col flex-grow justify-between min-h-0">
                    <div>
                      <span className="text-[11px] font-bold tracking-wider text-indigo-400 uppercase mb-1 block truncate">
                        {book.genre}
                      </span>
                      <h3
                        className="font-serif text-base md:text-lg font-semibold text-ink line-clamp-2 leading-snug group-hover:text-indigo-300 transition-colors min-h-[2.8rem]"
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
                      <span className="flex items-center gap-1 text-emerald-400 flex-shrink-0">
                        <BookOpen className="w-3.5 h-3.5" />
                        {t("landing.eresourcesSection.freeBadge", "Free E-Book")}
                      </span>
                      <span className="font-medium text-indigo-400 group-hover:underline flex-shrink-0">
                        {t("landing.eresourcesSection.readOnline", "Read Now →")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default EResources;
