import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  memo,
  lazy,
  Suspense,
} from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  BookOpen,
  Sparkles,
  Search,
  FileText,
  Bookmark,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  ExternalLink,
  FlaskConical,
  Upload,
  Info,
} from "lucide-react";
import useLocalBookmarks from "../../../hooks/useLocalBookmarks";
import useAuthStore from "../../../store/authStore";
import SparklineChart from "../../../components/general/SparklineChart";
import DonutChart from "../../../components/general/DonutChart";
import { useGeneralDashboard } from "../../../hooks/useBookData";
import BookDataState from "../../../components/common/BookDataState";
import BookCoverImage from "../../../components/common/BookCoverImage";
import DashboardErrorBoundary from "../../../components/common/DashboardErrorBoundary";
import { useTranslation } from "react-i18next";
import { initWebVitalsTelemetry } from "../../../utils/webVitalsTelemetry";
import useBookAvailability from "../../../hooks/useBookAvailability";
import { useReducedMotion } from "../../../hooks/useReducedMotion";

const EMPTY_ARRAY = [];

const DigitalReaderModal = lazy(
  () => import("../../../components/general/DigitalReaderModal"),
);

const GeneralDashboardHome = () => {
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  const { bookmarks, toggleBookmark, isBookmarked } = useLocalBookmarks();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  const collegeId = user?.collegeId || null;

  // Measure Core Web Vitals on mount
  useEffect(() => {
    initWebVitalsTelemetry("GeneralDashboard");
  }, []);

  // Consolidated Data Layer Hook (Single 1 Network Round-Trip)
  const {
    data: dashboardPayload,
    isLoading,
    isError,
    error: _error,
    refetch: handleRefresh,
  } = useGeneralDashboard(collegeId);

  useBookAvailability(collegeId, handleRefresh);

  const stats = dashboardPayload?.stats || null;
  const newArrivals = dashboardPayload?.newArrivals || EMPTY_ARRAY;
  const popularBooks = dashboardPayload?.popularBooks || EMPTY_ARRAY;
  const announcements = dashboardPayload?.announcements || [];
  const libraryHours = dashboardPayload?.librarySettings || {
    openingHour: "08:00 AM",
    closingHour: "05:00 PM",
    isClosedToday: false,
  };

  const [selectedBook, setSelectedBook] = useState(null);
  const [activeDigitalBook, setActiveDigitalBook] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef(null);

  // Close search suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const modalRef = useRef(null);

  // Close book details modal on Escape key press and trap focus inside modal
  useEffect(() => {
    if (!selectedBook) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedBook(null);
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    const timer = setTimeout(() => {
      if (modalRef.current) {
        const firstFocusable = modalRef.current.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) firstFocusable.focus();
      }
    }, 50);

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedBook]);

  const scrollCarousel = useCallback((direction) => {
    if (carouselRef.current) {
      const scrollAmount = direction === "left" ? -260 : 260;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  }, []);

  // Search Bar Autocomplete Filter (Memoized to avoid array allocation on every render)
  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return [...popularBooks, ...newArrivals]
      .filter(
        (b, index, self) =>
          self.findIndex(
            (item) => (item._id || item.id) === (b._id || b.id),
          ) === index,
      )
      .filter(
        (b) =>
          b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.author?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .slice(0, 5);
  }, [searchQuery, popularBooks, newArrivals]);

  // Library hours progress calculation (Strictly 8:00 AM to 5:00 PM)
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const startHour = 8;
  const endHour = 17;
  const progressPct = Math.min(
    Math.max(((currentHour - startHour) / (endHour - startHour)) * 100, 0),
    100,
  );
  const isOpen = currentHour >= startHour && currentHour < endHour;

  return (
    <div className="flex flex-col w-full max-w-[1600px] 2xl:max-w-[1760px] mx-auto gap-2.5 sm:gap-3 font-sans pb-2 text-slate-900 dark:text-ink min-h-0">
      {/* Header Row & Scoped Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/95 dark:bg-surface/95 backdrop-blur-md p-3 px-4 rounded-2xl border border-slate-200/80 dark:border-edge/80 shadow-xs flex-shrink-0">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 rounded-xl flex-shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-ink tracking-tight leading-tight">
              {t("title", "General Patron Dashboard")}
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-muted hidden sm:block">
              {t(
                "subtitle",
                "Explore library books, e-resources, and operational statistics",
              )}
            </p>
          </div>
        </div>

        {/* Scoped Autocomplete Top Search Bar */}
        <div
          ref={searchContainerRef}
          className="relative flex-1 max-w-md mx-0 sm:mx-4"
        >
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label={t(
                "searchPlaceholder",
                "Search catalog by title, author, or ISBN...",
              )}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchQuery.trim()) {
                  navigate(
                    `/general-dashboard/search?q=${encodeURIComponent(searchQuery)}`,
                  );
                  setShowSuggestions(false);
                }
              }}
              placeholder={t(
                "searchPlaceholder",
                "Search catalog by title, author, or ISBN...",
              )}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search query"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-full mt-1.5 left-0 right-0 bg-white dark:bg-surface border border-slate-200 dark:border-edge rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-2.5 border-b border-slate-100 dark:border-edge text-[10px] font-bold text-slate-400 dark:text-muted uppercase tracking-wider bg-slate-50 dark:bg-slate-950/60">
                Matching Catalog Items
              </div>
              {filteredSuggestions.map((book) => (
                <button
                  key={book._id || book.id}
                  type="button"
                  onClick={() => {
                    setSelectedBook(book);
                    setShowSuggestions(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center justify-between gap-2 transition-colors border-b last:border-0 border-slate-100 dark:border-edge cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-ink truncate">
                      {book.title}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-muted truncate">
                      By {book.author}
                    </div>
                  </div>
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 flex-shrink-0">
                    {book.category || book.genre}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  navigate(
                    `/general-dashboard/search?q=${encodeURIComponent(searchQuery)}`,
                  );
                  setShowSuggestions(false);
                }}
                className="w-full px-3 py-2 text-center text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/70 transition-colors cursor-pointer border-t border-slate-100 dark:border-edge"
              >
                View all results for "{searchQuery}" →
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto ml-auto">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh dashboard data"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Mobile Segmented Tab Bar */}
      <div className="flex sm:hidden bg-slate-100 dark:bg-slate-900 p-1 rounded-xl gap-1 flex-shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
            activeTab === "overview"
              ? "bg-indigo-600 text-white shadow-xs"
              : "hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("notices")}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
            activeTab === "notices"
              ? "bg-indigo-600 text-white shadow-xs"
              : "hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          Notices ({announcements.length})
        </button>
        <button
          onClick={() => setActiveTab("actions")}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
            activeTab === "actions"
              ? "bg-indigo-600 text-white shadow-xs"
              : "hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          Quick Links
        </button>
      </div>

      {/* First-Visit / Guidance Banner */}
      {bookmarks.length === 0 && (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white py-2 px-3.5 rounded-xl border border-indigo-500/30 flex items-center justify-between gap-3 shadow-md flex-shrink-0 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <p className="text-xs font-medium text-slate-200 truncate">
              <span className="font-bold text-white">
                {t("welcomeTitle", "Welcome to BookBuddy")}:{" "}
              </span>
              {t(
                "welcomeSubtitle",
                "Explore physical books and open-access e-resources",
              )}
            </p>
          </div>
          <button
            onClick={() => navigate("/general-dashboard/search")}
            className="text-[11px] font-bold px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors flex-shrink-0 shadow-sm cursor-pointer whitespace-nowrap"
          >
            Explore Catalog
          </button>
        </div>
      )}

      {/* Desktop Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        {/* Left Column (Stats & Visual Breakdown) */}
        {(activeTab === "overview" || activeTab === "notices") && (
          <div className="lg:col-span-5 flex flex-col gap-3 min-h-0">
            {/* Row 1: Library Hours & Catalog Stat Cards Side-by-Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Library Hours Card */}
              <DashboardErrorBoundary widgetName="Library Hours">
                <div className="bg-white dark:bg-surface p-3.5 rounded-2xl border border-slate-200/80 dark:border-edge/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-900 dark:text-ink">
                        {t("libraryHours", "Library Hours")}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1.5 ${
                        isOpen && !libraryHours.isClosedToday
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {isOpen && !libraryHours.isClosedToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                      {isOpen && !libraryHours.isClosedToday
                        ? t("openNow", "Open Now")
                        : t("closed", "Closed")}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                    {libraryHours.openingHour} - {libraryHours.closingHour}
                  </p>
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 dark:text-muted font-medium mb-1">
                      <span>{libraryHours.openingHour}</span>
                      <span>
                        {isOpen && !libraryHours.isClosedToday
                          ? `${Math.round(progressPct)}% ${t("dayElapsed", "day elapsed")}`
                          : t("closed", "Closed")}
                      </span>
                      <span>{libraryHours.closingHour}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-full rounded-full transition-all duration-500 shadow-xs"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </DashboardErrorBoundary>

              {/* Total Books Stat + Sparkline */}
              <DashboardErrorBoundary widgetName="Catalog Metrics">
                <BookDataState
                  isLoading={isLoading}
                  isError={isError}
                  onRetry={handleRefresh}
                  collegeName={user?.collegeName}
                >
                  <div className="bg-white dark:bg-surface p-3.5 rounded-2xl border border-slate-200/80 dark:border-edge/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200 flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-500 dark:text-muted block truncate">
                        {t("totalCatalogBooks", "Total Catalog Books")}
                      </span>
                      <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-ink tracking-tight">
                        {(
                          stats?.totalCatalogBooks ||
                          stats?.totalBooks ||
                          0
                        ).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">
                        +{stats?.addedThisMonth || stats?.newArrivalsCount || 0}{" "}
                        {t("addedThisMonth", "added this month")}
                      </span>
                    </div>
                    <SparklineChart
                      data={stats?.sparklineData || stats?.monthlyTrend || null}
                      width={80}
                      height={36}
                      color="#6366F1"
                    />
                  </div>
                </BookDataState>
              </DashboardErrorBoundary>
            </div>

            {/* Row 2: New Arrivals Row Card */}
            <DashboardErrorBoundary widgetName="New Arrivals">
              <BookDataState
                isLoading={isLoading}
                isError={isError}
                onRetry={handleRefresh}
                collegeName={user?.collegeName}
              >
                <div className="bg-white dark:bg-surface p-3.5 rounded-2xl border border-slate-200/80 dark:border-edge/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-ink">
                        {t("newArrivals", "New Arrivals")} ({newArrivals.length}
                        )
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        navigate("/general-dashboard/search?sortBy=newest")
                      }
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{t("viewAll", "View all")}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {newArrivals.length === 0 ? (
                      <div className="col-span-3 text-[11px] text-slate-400 dark:text-slate-500 italic p-2.5 text-center bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        No new arrivals currently available
                      </div>
                    ) : (
                      newArrivals.slice(0, 3).map((item, i) => (
                        <button
                          key={item._id || item.id || i}
                          onClick={() => setSelectedBook(item)}
                          className="bg-slate-50/80 dark:bg-slate-900/80 p-2 rounded-xl border border-slate-200/80 dark:border-edge text-slate-900 dark:text-ink text-[10px] font-bold h-14 flex flex-col justify-between hover:border-indigo-500/50 hover:bg-white dark:hover:bg-slate-800/90 transition-all duration-150 shadow-xs text-left relative overflow-hidden group cursor-pointer hover:-translate-y-0.5"
                        >
                          <span className="line-clamp-2 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                            {item.title}
                          </span>
                          <span className="text-[9px] text-indigo-700 dark:text-indigo-300 uppercase font-bold">
                            New
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </BookDataState>
            </DashboardErrorBoundary>

            {/* Row 3: Category Breakdown Donut Chart */}
            <DashboardErrorBoundary widgetName="Category Breakdown">
              <BookDataState
                isLoading={isLoading}
                isError={isError}
                onRetry={handleRefresh}
                collegeName={user?.collegeName}
              >
                <div className="bg-white dark:bg-surface p-3.5 rounded-2xl border border-slate-200/80 dark:border-edge/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-ink">
                      {t("categoryDistribution", "Category Distribution")}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-muted font-medium">
                      {(stats?.categoryBreakdown || []).length}{" "}
                      {t("genres", "genres")}
                    </span>
                  </div>
                  <DonutChart
                    data={stats?.categoryBreakdown || []}
                    size={76}
                    strokeWidth={11}
                  />
                </div>
              </BookDataState>
            </DashboardErrorBoundary>
          </div>
        )}

        {/* Right Column (Popular Carousel & Compact Action Bar) */}
        {(activeTab === "overview" || activeTab === "actions") && (
          <div className="lg:col-span-7 flex flex-col gap-3 min-h-0">
            {/* Quick Action Button Row */}
            <div className="bg-white dark:bg-surface p-2.5 rounded-2xl border border-slate-200/80 dark:border-edge/80 shadow-xs flex-shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => navigate("/general-dashboard/search")}
                  className="flex items-center justify-center sm:justify-start gap-2 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-edge text-slate-900 dark:text-ink hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-500/50 transition-all text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Search className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                  <span>Search Catalog</span>
                </button>

                <button
                  onClick={() => navigate("/general-dashboard/e-resources")}
                  className="flex items-center justify-center sm:justify-start gap-2 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-edge text-slate-900 dark:text-ink hover:bg-white dark:hover:bg-slate-800 hover:border-emerald-500/50 transition-all text-xs font-bold shadow-xs cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>E-Resources</span>
                </button>

                <button
                  onClick={() => navigate("/general-dashboard/saved")}
                  className="flex items-center justify-center sm:justify-start gap-2 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-edge text-slate-900 dark:text-ink hover:bg-white dark:hover:bg-slate-800 hover:border-purple-500/50 transition-all text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Bookmark className="w-4 h-4 text-purple-500 dark:text-purple-400 shrink-0" />
                  <span>My Bookmarks</span>
                </button>

                {user?.role === "college-admin" ||
                user?.role === "super-admin" ? (
                  <button
                    onClick={() => navigate("/college-admin/bulk-upload")}
                    className="flex items-center justify-center sm:justify-start gap-2 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-edge text-slate-900 dark:text-ink hover:bg-white dark:hover:bg-slate-800 hover:border-amber-500/50 transition-all text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                    <span>Upload Students</span>
                  </button>
                ) : user?.role === "student" ? (
                  <button
                    onClick={() => navigate("/lab-booking")}
                    className="flex items-center justify-center sm:justify-start gap-2 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-edge text-slate-900 dark:text-ink hover:bg-white dark:hover:bg-slate-800 hover:border-sky-500/50 transition-all text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <FlaskConical className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
                    <span>Lab Booking</span>
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      navigate("/general-dashboard/search?sortBy=newest")
                    }
                    className="flex items-center justify-center sm:justify-start gap-2 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-edge text-slate-900 dark:text-ink hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-500/50 transition-all text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                    <span>Latest Arrivals</span>
                  </button>
                )}
              </div>
            </div>

            {/* Popular Books Horizontal Carousel */}
            <DashboardErrorBoundary widgetName="Popular Carousel">
              <div className="bg-white dark:bg-surface p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-edge/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200 flex-1 flex flex-col justify-between min-h-0">
                <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-ink">
                      {t("popularThisWeek", "Popular This Week")}
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-muted">
                      {t(
                        "popularSubtitle",
                        "Most checked out physical items in campus library",
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => scrollCarousel("left")}
                      aria-label="Scroll left"
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => scrollCarousel("right")}
                      aria-label="Scroll right"
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Carousel Scroll Container */}
                <BookDataState
                  isLoading={isLoading}
                  isError={isError}
                  onRetry={handleRefresh}
                  isEmpty={popularBooks.length === 0}
                  collegeName={user?.collegeName}
                >
                  <div
                    ref={carouselRef}
                    className="flex gap-3.5 overflow-x-auto pb-1 pt-1 scrollbar-none snap-x snap-mandatory scroll-smooth min-h-0 flex-1"
                  >
                    {popularBooks.map((book) => {
                      const bookmarked = isBookmarked(book._id || book.id);
                      return (
                        <motion.div
                          key={book._id || book.id}
                          whileHover={
                            prefersReducedMotion ? {} : { y: -3, scale: 1.01 }
                          }
                          transition={{ duration: 0.15 }}
                          className="w-56 sm:w-60 flex-shrink-0 bg-slate-50/90 dark:bg-slate-950/90 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-3 snap-start hover:shadow-lg hover:border-indigo-500/40 transition-all duration-200 flex flex-col justify-between group"
                        >
                          <div>
                            <div className="relative mb-2">
                              <BookCoverImage
                                src={book.coverUrl}
                                fallbackTitle={book.title}
                                fallbackCategory={book.category}
                                aspectRatio="h-24 sm:h-28"
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBookmark(book);
                                }}
                                aria-label={
                                  bookmarked
                                    ? "Remove bookmark"
                                    : "Bookmark this book"
                                }
                                className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-md transition-all cursor-pointer ${
                                  bookmarked
                                    ? "bg-amber-500 text-white shadow-amber-500/30"
                                    : "bg-slate-900/80 text-slate-300 hover:text-white border border-slate-700"
                                }`}
                              >
                                <Bookmark
                                  className={`w-3.5 h-3.5 ${bookmarked ? "fill-current" : ""}`}
                                />
                              </button>
                            </div>

                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {book.title}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {book.author}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 mt-2">
                            <span
                              className={`text-[9px] font-semibold px-2 py-0.5 rounded-md border ${
                                book.availableCopies > 0
                                  ? "bg-emerald-50 dark:bg-emerald-950/90 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80"
                                  : "bg-rose-50 dark:bg-rose-950/90 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800/80"
                              }`}
                            >
                              {book.availableCopies > 0
                                ? `${book.availableCopies} Available`
                                : "Checked Out"}
                            </span>

                            <button
                              onClick={() => setSelectedBook(book)}
                              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>Details</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </BookDataState>
              </div>
            </DashboardErrorBoundary>
          </div>
        )}
      </div>

      {/* Book Details Modal */}
      <AnimatePresence>
        {selectedBook && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-modal-title"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBook(null)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
              aria-hidden="true"
            />
            <motion.div
              ref={modalRef}
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.95, y: 15 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.95, y: 15 }
              }
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="bg-white dark:bg-surface rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-edge relative z-10 text-slate-900 dark:text-ink font-sans"
            >
              <button
                type="button"
                onClick={() => setSelectedBook(null)}
                aria-label="Close modal"
                className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800/60 px-2.5 py-1 rounded-lg inline-block">
                {selectedBook.category || selectedBook.genre}
              </span>

              <h3
                id="book-modal-title"
                className="text-base font-bold text-slate-900 dark:text-ink mt-2 mb-1"
              >
                {selectedBook.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-muted mb-3">
                By {selectedBook.author}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
                <div className="bg-slate-50 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200 dark:border-edge">
                  <span className="text-slate-500 dark:text-muted block mb-0.5 text-[10px]">
                    Availability
                  </span>
                  <span className="font-bold text-slate-900 dark:text-ink text-xs">
                    {selectedBook.availableCopies ?? 0} of{" "}
                    {selectedBook.totalCopies ?? 0} in library
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200 dark:border-edge">
                  <span className="text-slate-500 dark:text-muted block mb-0.5 text-[10px]">
                    Location
                  </span>
                  <span className="font-bold text-slate-900 dark:text-ink text-xs flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                    <span className="truncate">
                      {selectedBook.shelfLocation || "Main Stacks"}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                {(selectedBook.format === "digital" ||
                  selectedBook.isDigital ||
                  selectedBook.fileUrl ||
                  selectedBook.category?.toLowerCase().includes("epub") ||
                  selectedBook.genre?.toLowerCase().includes("epub") ||
                  selectedBook.title?.toLowerCase().includes("epub")) && (
                  <button
                    type="button"
                    onClick={() => {
                      const bookToOpen = selectedBook;
                      setSelectedBook(null);
                      setActiveDigitalBook(bookToOpen);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer whitespace-nowrap"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Read Online</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    toggleBookmark(selectedBook);
                    setSelectedBook(null);
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isBookmarked(selectedBook._id || selectedBook.id)
                      ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                      : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20"
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5 fill-current" />
                  <span>
                    {isBookmarked(selectedBook._id || selectedBook.id)
                      ? "Saved"
                      : "Bookmark Item"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const titleQuery = selectedBook.title;
                    setSelectedBook(null);
                    navigate(
                      `/general-dashboard/search?q=${encodeURIComponent(titleQuery)}`,
                    );
                  }}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-edge bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Search in Catalog
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* In-App Open Access Digital Reader Modal */}
      <Suspense fallback={null}>
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
            activeDigitalBook?.fileType || activeDigitalBook?.format || "epub"
          }
          title={activeDigitalBook?.title}
          book={activeDigitalBook}
        />
      </Suspense>
    </div>
  );
};

export default memo(GeneralDashboardHome);
