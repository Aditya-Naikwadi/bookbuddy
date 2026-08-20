import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../../../components/LanguageSwitcher";
import { getTranslation } from "../../../i18n/dashboard";
import { initWebVitalsTelemetry } from "../../../utils/webVitalsTelemetry";

const GeneralDashboardHome = () => {
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  const { bookmarks, toggleBookmark, isBookmarked } = useLocalBookmarks();
  const { user } = useAuthStore();
  const { t } = useTranslation();

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
    <div className="flex flex-col min-h-full max-w-7xl mx-auto p-3 sm:p-4 gap-4 font-sans pb-10">
      {/* Header Row & Scoped Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-start gap-4 md:gap-5 bg-white p-3.5 px-5 rounded-2xl border border-slate-200/80 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl flex-shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight">
              {t("title")}
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* Scoped Autocomplete Top Search Bar */}
        <div className="relative flex-1 max-w-md">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              aria-label={t("searchPlaceholder", "Search catalog by title, author, or ISBN...")}
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
              placeholder={t("searchPlaceholder")}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Clear search query"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-full mt-1.5 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-2 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Matching Catalog Items
              </div>
              {filteredSuggestions.map((book) => (
                <button
                  key={book._id || book.id}
                  onClick={() => {
                    setSelectedBook(book);
                    setShowSuggestions(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-indigo-50/80 flex items-center justify-between gap-2 transition-colors border-b last:border-0 border-slate-100"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {book.title}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      By {book.author}
                    </div>
                  </div>
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 flex-shrink-0">
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
            className="p-2 rounded-xl border border-slate-200/80 bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Mobile Segmented Tab Bar */}
      <div className="flex sm:hidden bg-slate-100 p-1 rounded-xl gap-1 flex-shrink-0 text-xs font-semibold text-slate-600">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
            activeTab === "overview"
              ? "bg-white text-indigo-600 shadow-sm"
              : "hover:text-slate-900"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("notices")}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
            activeTab === "notices"
              ? "bg-white text-indigo-600 shadow-sm"
              : "hover:text-slate-900"
          }`}
        >
          Notices ({announcements.length})
        </button>
        <button
          onClick={() => setActiveTab("actions")}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
            activeTab === "actions"
              ? "bg-white text-indigo-600 shadow-sm"
              : "hover:text-slate-900"
          }`}
        >
          Quick Links
        </button>
      </div>

      {/* First-Visit / Empty State Welcome Guidance Banner */}
      {bookmarks.length === 0 && (
        <div className="bg-indigo-900 text-white p-3 px-4 rounded-2xl flex items-center justify-between gap-3 shadow-md flex-shrink-0 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-indigo-300 flex-shrink-0" />
            <p className="text-xs font-medium">
              <span className="font-bold text-white">
                {t("welcomeTitle")}:{" "}
              </span>
              {t("welcomeSubtitle")}
            </p>
          </div>
          <button
            onClick={() => navigate("/general-dashboard/search")}
            className="text-[11px] font-bold px-3 py-1 bg-white text-indigo-900 rounded-xl hover:bg-indigo-50 transition-colors flex-shrink-0"
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
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">
                      {t("libraryHours")}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isOpen && !libraryHours.isClosedToday
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {isOpen && !libraryHours.isClosedToday
                      ? t("openNow")
                      : t("closed")}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  {libraryHours.openingHour} - {libraryHours.closingHour}
                </p>
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium mb-1">
                    <span>{libraryHours.openingHour}</span>
                    <span>
                      {isOpen && !libraryHours.isClosedToday
                        ? `${Math.round(progressPct)}% ${t("dayElapsed")}`
                        : t("closed")}
                    </span>
                    <span>{libraryHours.closingHour}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
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
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-500 block">
                      {t("totalCatalogBooks")}
                    </span>
                    <span className="text-2xl font-bold text-slate-900">
                      {(
                        stats?.totalCatalogBooks ||
                        stats?.totalBooks ||
                        0
                      ).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                      +{stats?.addedThisMonth || stats?.newArrivalsCount || 0}{" "}
                      {t("addedThisMonth")}
                    </span>
                  </div>
                  <SparklineChart width={100} height={40} color="#4F46E5" />
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
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-slate-900">
                        {t("newArrivals")} ({newArrivals.length})
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        navigate("/general-dashboard/search?filter=new")
                      }
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                    >
                      <span>{t("viewAll")}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {newArrivals.slice(0, 3).map((item, i) => (
                      <button
                        key={item._id || item.id || i}
                        onClick={() => setSelectedBook(item)}
                        className="bg-indigo-600 p-2 rounded-xl text-white text-[10px] font-bold h-16 flex flex-col justify-between hover:opacity-90 transition-opacity shadow-sm text-left relative overflow-hidden group"
                      >
                        <span className="line-clamp-2 leading-tight drop-shadow-xs">
                          {item.title}
                        </span>
                        <span className="text-[9px] text-indigo-200 uppercase font-semibold">
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
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex-1 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900">
                      {t("categoryDistribution")}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {(stats?.categoryBreakdown || []).length} {t("genres")}
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
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex-shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => navigate("/general-dashboard/search")}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-100 text-indigo-900 hover:bg-indigo-100 transition-all text-xs font-bold shadow-xs"
                >
                  <Search className="w-4 h-4 text-indigo-600" />
                  <span>Search Catalog</span>
                </button>

                <button
                  onClick={() => navigate("/general-dashboard/e-resources")}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-100 text-emerald-900 hover:bg-emerald-100 transition-all text-xs font-bold shadow-xs"
                >
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>E-Resources</span>
                </button>

                <button
                  onClick={() => navigate("/general-dashboard/saved")}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-50/80 border border-purple-100 text-purple-900 hover:bg-purple-100 transition-all text-xs font-bold shadow-xs"
                >
                  <Bookmark className="w-4 h-4 text-purple-600" />
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
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/80 border border-amber-100 text-amber-900 hover:bg-amber-100 transition-all text-xs font-bold shadow-xs"
                  >
                    <Upload className="w-4 h-4 text-amber-600" />
                    <span>Upload Students</span>
                  </button>
                ) : (
                  <button
                    onClick={() => navigate("/lab")}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-sky-50/80 border border-sky-100 text-sky-900 hover:bg-sky-100 transition-all text-xs font-bold shadow-xs"
                  >
                    <FlaskConical className="w-4 h-4 text-sky-600" />
                    <span>Lab Booking</span>
                  </button>
                )}
              </div>
            </div>

            {/* Popular Books Horizontal Carousel */}
            <DashboardErrorBoundary widgetName="Popular Carousel">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex-1 flex flex-col justify-between min-h-0 overflow-hidden">
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      {t("popularThisWeek")}
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      {t("popularSubtitle")}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => scrollCarousel("left")}
                      className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => scrollCarousel("right")}
                      className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
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
                        <div
                          key={book._id || book.id}
                          className="w-64 flex-shrink-0 bg-slate-50/80 rounded-2xl border border-slate-200/80 p-3.5 snap-start hover:shadow-md hover:border-indigo-200 transition-all duration-200 flex flex-col justify-between group"
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
                                className={`absolute top-2.5 right-2.5 p-1 rounded-lg backdrop-blur-md transition-all ${
                                  bookmarked
                                    ? "bg-amber-500 text-white"
                                    : "bg-slate-900/60 text-slate-300 hover:text-white"
                                }`}
                              >
                                <Bookmark
                                  className={`w-3.5 h-3.5 ${bookmarked ? "fill-current" : ""}`}
                                />
                              </button>
                            </div>

                            <h3 className="font-bold text-slate-900 text-xs line-clamp-1 group-hover:text-indigo-600 transition-colors">
                              {book.title}
                            </h3>
                            <p className="text-[11px] text-slate-500">
                              {book.author}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 mt-2">
                            <span
                              className={`text-[9px] font-semibold px-2 py-0.5 rounded-md border ${
                                book.availableCopies > 0
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}
                            >
                              {book.availableCopies > 0
                                ? `${book.availableCopies} Available`
                                : "Checked Out"}
                            </span>

                            <button
                              onClick={() => setSelectedBook(book)}
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                            >
                              <span>Details</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
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
      {selectedBook && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedBook(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              {selectedBook.category || selectedBook.genre}
            </span>

            <h3 className="text-base font-bold text-slate-900 mt-2 mb-1">
              {selectedBook.title}
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              By {selectedBook.author}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                <span className="text-slate-400 block mb-0.5 text-[10px]">
                  Availability
                </span>
                <span className="font-bold text-slate-900 text-xs">
                  {selectedBook.availableCopies} of {selectedBook.totalCopies}{" "}
                  in library
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                <span className="text-slate-400 block mb-0.5 text-[10px]">
                  Location
                </span>
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
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
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  isBookmarked(selectedBook._id || selectedBook.id)
                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
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
                className="py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Catalog Search
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralDashboardHome;
