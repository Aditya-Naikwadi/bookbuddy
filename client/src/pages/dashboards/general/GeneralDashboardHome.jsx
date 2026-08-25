import { useState, useRef, useEffect } from "react";
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
  const newArrivals = dashboardPayload?.newArrivals || [];
  const popularBooks = dashboardPayload?.popularBooks || [];
  const announcements = dashboardPayload?.announcements || [];
  const libraryHours = dashboardPayload?.librarySettings || {
    openingHour: "08:00 AM",
    closingHour: "10:00 PM",
    isClosedToday: false,
  };

  const [selectedBook, setSelectedBook] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const scrollCarousel = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = direction === "left" ? -260 : 260;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // Search Bar Autocomplete Filter
  const filteredSuggestions = searchQuery.trim()
    ? [...popularBooks, ...newArrivals]
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
        .slice(0, 5)
    : [];

  // Library hours progress calculation
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const startHour = 8;
  const endHour = 22;
  const progressPct = Math.min(
    Math.max(((currentHour - startHour) / (endHour - startHour)) * 100, 0),
    100,
  );
  const isOpen = currentHour >= startHour && currentHour < endHour;

  return (
    <div className="flex flex-col min-h-full max-w-7xl mx-auto p-3 sm:p-4 gap-4 font-sans pb-10 text-slate-900 dark:text-ink">
      {/* Header Row & Scoped Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-start gap-4 md:gap-5 bg-white dark:bg-surface p-4 px-5 rounded-2xl border border-slate-200 dark:border-edge shadow-xl flex-shrink-0">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 rounded-xl flex-shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-ink tracking-tight leading-tight">
              {t("title", "General Patron Dashboard")}
            </h1>
            <p className="text-xs text-slate-500 dark:text-muted hidden sm:block">
              {t(
                "subtitle",
                "Explore library books, e-resources, and operational statistics",
              )}
            </p>
          </div>
        </div>

        {/* Scoped Autocomplete Top Search Bar */}
        <div className="relative flex-1 max-w-md">
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
                onClick={() => setSearchQuery("")}
                aria-label="Clear search query"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                  onClick={() => {
                    setSelectedBook(book);
                    setShowSuggestions(false);
                  }}
                  className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center justify-between gap-2 transition-colors border-b last:border-0 border-slate-100 dark:border-edge"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-ink truncate">
                      {book.title}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-muted truncate">
                      By {book.author}
                    </div>
                  </div>
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 flex-shrink-0">
                    {book.category || book.genre}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 self-end md:self-auto ml-auto">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh dashboard data"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all disabled:opacity-50"
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
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-3.5 px-4 rounded-2xl border border-indigo-500/30 flex items-center justify-between gap-3 shadow-xl flex-shrink-0 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <p className="text-xs font-medium text-slate-200">
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
            className="text-[11px] font-bold px-3 py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors flex-shrink-0 shadow-md"
          >
            Explore Catalog
          </button>
        </div>
      )}

      {/* Desktop Main Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Left Column (Stats & Visual Breakdown) */}
        {(activeTab === "overview" || activeTab === "notices") && (
          <div className="md:col-span-4 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
            {/* Library Hours Card */}
            <DashboardErrorBoundary widgetName="Library Hours">
              <div className="bg-white dark:bg-surface p-4 rounded-2xl border border-slate-200 dark:border-edge shadow-xl flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-ink">
                      {t("libraryHours", "Library Hours")}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isOpen && !libraryHours.isClosedToday
                        ? "bg-emerald-50 dark:bg-emerald-950/90 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80"
                        : "bg-rose-50 dark:bg-rose-950/90 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800/80"
                    }`}
                  >
                    {isOpen && !libraryHours.isClosedToday
                      ? t("openNow", "Open Now")
                      : t("closed", "Closed")}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
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
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500 shadow-sm"
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
              >
                <div className="bg-white dark:bg-surface p-4 rounded-2xl border border-slate-200 dark:border-edge shadow-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-500 dark:text-muted block">
                      {t("totalCatalogBooks", "Total Catalog Books")}
                    </span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-ink">
                      {(
                        stats?.totalCatalogBooks ||
                        stats?.totalBooks ||
                        0
                      ).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                      +{stats?.addedThisMonth || stats?.newArrivalsCount || 0}{" "}
                      {t("addedThisMonth", "added this month")}
                    </span>
                  </div>
                  <SparklineChart width={100} height={40} color="#6366F1" />
                </div>
              </BookDataState>
            </DashboardErrorBoundary>

            {/* New Arrivals Row Card */}
            <DashboardErrorBoundary widgetName="New Arrivals">
              <BookDataState
                isLoading={isLoading}
                isError={isError}
                onRetry={handleRefresh}
              >
                <div className="bg-white dark:bg-surface p-4 rounded-2xl border border-slate-200 dark:border-edge shadow-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-ink">
                        {t("newArrivals", "New Arrivals")} ({newArrivals.length}
                        )
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        navigate("/general-dashboard/search?filter=new")
                      }
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>{t("viewAll", "View all")}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {newArrivals.slice(0, 3).map((item, i) => (
                      <button
                        key={item._id || item.id || i}
                        onClick={() => setSelectedBook(item)}
                        className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-[10px] font-bold h-16 flex flex-col justify-between hover:border-indigo-500/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all shadow-sm text-left relative overflow-hidden group cursor-pointer"
                      >
                        <span className="line-clamp-2 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                          {item.title}
                        </span>
                        <span className="text-[9px] text-indigo-600 dark:text-indigo-400 uppercase font-bold">
                          New
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </BookDataState>
            </DashboardErrorBoundary>

            {/* Category Breakdown Donut Chart */}
            <DashboardErrorBoundary widgetName="Category Breakdown">
              <BookDataState
                isLoading={isLoading}
                isError={isError}
                onRetry={handleRefresh}
              >
                <div className="bg-white dark:bg-surface p-4 rounded-2xl border border-slate-200 dark:border-edge shadow-xl flex-1 flex flex-col justify-between">
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
                    size={84}
                    strokeWidth={12}
                  />
                </div>
              </BookDataState>
            </DashboardErrorBoundary>
          </div>
        )}

        {/* Right Column (Popular Carousel & Compact Action Bar) */}
        {(activeTab === "overview" || activeTab === "actions") && (
          <div className="md:col-span-8 flex flex-col gap-3 min-h-0 overflow-hidden">
            {/* Quick Action Button Row */}
            <div className="bg-white dark:bg-surface p-3 rounded-2xl border border-slate-200 dark:border-edge shadow-xl flex-shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => navigate("/general-dashboard/search")}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-indigo-500/50 transition-all text-xs font-bold shadow-md cursor-pointer"
                >
                  <Search className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <span>Search Catalog</span>
                </button>

                <button
                  onClick={() => navigate("/general-dashboard/e-resources")}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-emerald-500/50 transition-all text-xs font-bold shadow-md cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span>E-Resources</span>
                </button>

                <button
                  onClick={() => navigate("/general-dashboard/saved")}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-purple-500/50 transition-all text-xs font-bold shadow-md cursor-pointer"
                >
                  <Bookmark className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                  <span>My Bookmarks</span>
                </button>

                {user?.role === "college-admin" ||
                user?.role === "super-admin" ? (
                  <button
                    onClick={() =>
                      navigate(
                        `/college/${user.collegeId}/students/bulk-upload`,
                      )
                    }
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-amber-500/50 transition-all text-xs font-bold shadow-md cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    <span>Upload Students</span>
                  </button>
                ) : (
                  <button
                    onClick={() => navigate("/lab")}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-sky-500/50 transition-all text-xs font-bold shadow-md cursor-pointer"
                  >
                    <FlaskConical className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                    <span>Lab Booking</span>
                  </button>
                )}
              </div>
            </div>

            {/* Popular Books Horizontal Carousel */}
            <DashboardErrorBoundary widgetName="Popular Carousel">
              <div className="bg-white dark:bg-surface p-4 rounded-2xl border border-slate-200 dark:border-edge shadow-xl flex-1 flex flex-col justify-between min-h-0 overflow-hidden">
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
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
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => scrollCarousel("right")}
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
                >
                  <div
                    ref={carouselRef}
                    className="flex gap-4 overflow-x-auto pb-2 pt-1 scrollbar-none snap-x snap-mandatory scroll-smooth min-h-0 flex-1"
                  >
                    {popularBooks.map((book) => {
                      const bookmarked = isBookmarked(book._id || book.id);
                      return (
                        <motion.div
                          key={book._id || book.id}
                          whileHover={
                            prefersReducedMotion ? {} : { y: -4, scale: 1.02 }
                          }
                          transition={{ duration: 0.15 }}
                          className="w-64 flex-shrink-0 bg-slate-50 dark:bg-slate-950/90 rounded-2xl border border-slate-200 dark:border-slate-800/90 p-3.5 snap-start hover:shadow-2xl hover:border-indigo-500/50 transition-all duration-200 flex flex-col justify-between group"
                        >
                          <div>
                            <div className="relative mb-2.5">
                              <BookCoverImage
                                src={book.coverUrl}
                                fallbackTitle={book.title}
                                fallbackCategory={book.category}
                                aspectRatio="h-28"
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBookmark(book);
                                }}
                                className={`absolute top-2.5 right-2.5 p-1.5 rounded-lg backdrop-blur-md transition-all cursor-pointer ${
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
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBook(null)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
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
              className="bg-white dark:bg-surface rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-edge relative z-10 text-slate-900 dark:text-slate-100 font-sans"
            >
              <button
                onClick={() => setSelectedBook(null)}
                className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800/60 px-2.5 py-1 rounded-lg inline-block">
                {selectedBook.category || selectedBook.genre}
              </span>

              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-2 mb-1">
                {selectedBook.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                By {selectedBook.author}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 block mb-0.5 text-[10px]">
                    Availability
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    {selectedBook.availableCopies} of {selectedBook.totalCopies}{" "}
                    in library
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 block mb-0.5 text-[10px]">
                    Location
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                    <span className="truncate">
                      {selectedBook.shelfLocation || "Main Stacks"}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
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
                  onClick={() => {
                    setSelectedBook(null);
                    navigate("/general-dashboard/search");
                  }}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Catalog Search
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GeneralDashboardHome;
