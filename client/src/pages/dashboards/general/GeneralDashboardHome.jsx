import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../api/client';
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
  Megaphone,
  X,
  MapPin,
  CheckCircle2,
  ExternalLink,
  Layers,
  FlaskConical,
  Upload,
} from 'lucide-react';
import useLocalBookmarks from '../../../hooks/useLocalBookmarks';
import useAuthStore from '../../../store/authStore';
import SparklineChart from '../../../components/general/SparklineChart';
import DonutChart from '../../../components/general/DonutChart';
import AnnouncementTicker from '../../../components/general/AnnouncementTicker';

const GeneralDashboardHome = () => {
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  const { toggleBookmark, isBookmarked } = useLocalBookmarks();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [announcements, setAnnouncements] = useState([]);
  const [popularBooks, setPopularBooks] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [catalogStats, setCatalogStats] = useState({ totalCatalogBooks: 0, addedThisMonth: 0 });
  const [libraryHours, setLibraryHours] = useState({ openingHour: '08:00 AM', closingHour: '10:00 PM', isClosedToday: false });
  const [selectedBook, setSelectedBook] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // Mobile tab bar state

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/dashboards/general/home-data');
      if (data?.success && data?.data) {
        const payload = data.data;
        setAnnouncements(payload.announcements || []);
        setPopularBooks(payload.popularBooks || []);
        setNewArrivals(payload.newArrivals || []);
        setCategoryData(payload.categoryBreakdown || []);
        if (payload.stats) setCatalogStats(payload.stats);
        if (payload.librarySettings) setLibraryHours(payload.librarySettings);
        setLastUpdated(new Date());
      }
    } catch {
      // Clean fallback handling when backend is empty
      setAnnouncements([]);
      setPopularBooks([]);
      setNewArrivals([]);
      setCategoryData([]);
      setCatalogStats({ totalCatalogBooks: 0, addedThisMonth: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const handleDismissAnnouncement = (id) => {
    setAnnouncements((prev) => prev.filter((a) => (a.id || a._id) !== id));
  };

  const scrollCarousel = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Calculate day progress percentage for Library Hours (8 AM to 10 PM = 14 hours window)
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const startHour = 8;
  const endHour = 22;
  const progressPct = Math.min(Math.max(((currentHour - startHour) / (endHour - startHour)) * 100, 0), 100);
  const isOpen = currentHour >= startHour && currentHour < endHour;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden max-w-7xl mx-auto p-3 sm:p-4 gap-3 font-sans">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3 bg-white p-3.5 px-5 rounded-2xl border border-slate-200/80 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl flex-shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight">
              General Public Portal
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">
              Single-screen portal for catalog exploration, e-resources, and campus updates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh dashboard data"
            className="p-2 rounded-xl border border-slate-200/80 bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile Segmented Tab Bar (Visible on small screens) */}
      <div className="flex sm:hidden bg-slate-100 p-1 rounded-xl gap-1 flex-shrink-0 text-xs font-semibold text-slate-600">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
            activeTab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-slate-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('notices')}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
            activeTab === 'notices' ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-slate-900'
          }`}
        >
          Notices ({announcements.length})
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
            activeTab === 'actions' ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-slate-900'
          }`}
        >
          Quick Links
        </button>
      </div>

      {/* Announcements Ticker (Full Width) */}
      {(activeTab === 'overview' || activeTab === 'notices') && (
        <div className="flex-shrink-0">
          <AnnouncementTicker announcements={announcements} onDismiss={handleDismissAnnouncement} />
        </div>
      )}

      {/* Desktop Main Grid (Full viewport fit) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Left Column (Stats & Visual Breakdown) */}
        {(activeTab === 'overview' || activeTab === 'notices') && (
          <div className="md:col-span-4 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
            {/* Library Hours Card */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-900">Library Hours Today</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isOpen && !libraryHours.isClosedToday ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {isOpen && !libraryHours.isClosedToday ? 'Open Now' : 'Closed'}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-700">{libraryHours.openingHour} - {libraryHours.closingHour}</p>
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-400 font-medium mb-1">
                  <span>{libraryHours.openingHour}</span>
                  <span>{isOpen && !libraryHours.isClosedToday ? `${Math.round(progressPct)}% Day Elapsed` : 'Closed'}</span>
                  <span>{libraryHours.closingHour}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            </div>

            {/* Total Books Stat + Sparkline */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 block">Total Catalog Books</span>
                <span className="text-2xl font-bold text-slate-900">{catalogStats.totalCatalogBooks?.toLocaleString()}</span>
                <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">+{catalogStats.addedThisMonth} added this month</span>
              </div>
              <SparklineChart width={100} height={40} color="#4F46E5" />
            </div>

            {/* New Arrivals Row Card */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-900">New Arrivals ({newArrivals.length})</span>
                </div>
                <button
                  onClick={() => navigate('/general-dashboard/search?filter=new')}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                >
                  <span>View All</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {newArrivals.map((item, i) => (
                  <button
                    key={item.id || item._id || i}
                    onClick={() => navigate('/general-dashboard/search')}
                    className={`${item.color || 'bg-indigo-600'} p-2 rounded-xl text-white text-[10px] font-bold h-16 flex flex-col justify-between hover:opacity-90 transition-opacity shadow-sm text-left`}
                  >
                    <span className="line-clamp-2 leading-tight">{item.title}</span>
                    <span className="text-[9px] text-white/80 uppercase font-semibold">New</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Category Breakdown Donut Chart */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">Category Distribution</span>
                <span className="text-[10px] text-slate-400 font-medium">{categoryData.length} Genres</span>
              </div>
              <DonutChart data={categoryData} size={84} strokeWidth={12} />
            </div>
          </div>
        )}

        {/* Right Column (Popular Carousel & Compact Action Bar) */}
        {(activeTab === 'overview' || activeTab === 'actions') && (
          <div className="md:col-span-8 flex flex-col gap-3 min-h-0 overflow-hidden">
            {/* Quick Action Button Row */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex-shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => navigate('/general-dashboard/search')}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-100 text-indigo-900 hover:bg-indigo-100 transition-all text-xs font-bold shadow-sm"
                >
                  <Search className="w-4 h-4 text-indigo-600" />
                  <span>Search Catalog</span>
                </button>

                <button
                  onClick={() => navigate('/general-dashboard/e-resources')}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-100 text-emerald-900 hover:bg-emerald-100 transition-all text-xs font-bold shadow-sm"
                >
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>E-Resources</span>
                </button>

                <button
                  onClick={() => navigate('/general-dashboard/saved')}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-50/80 border border-purple-100 text-purple-900 hover:bg-purple-100 transition-all text-xs font-bold shadow-sm"
                >
                  <Bookmark className="w-4 h-4 text-purple-600" />
                  <span>My Bookmarks</span>
                </button>

                {user?.role === 'college-admin' || user?.role === 'super-admin' ? (
                  <button
                    onClick={() => navigate(`/college/${user.collegeId}/students/bulk-upload`)}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/80 border border-amber-100 text-amber-900 hover:bg-amber-100 transition-all text-xs font-bold shadow-sm"
                  >
                    <Upload className="w-4 h-4 text-amber-600" />
                    <span>Upload Students</span>
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('/lab')}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-sky-50/80 border border-sky-100 text-sky-900 hover:bg-sky-100 transition-all text-xs font-bold shadow-sm"
                  >
                    <FlaskConical className="w-4 h-4 text-sky-600" />
                    <span>Lab Booking</span>
                  </button>
                )}
              </div>
            </div>

            {/* Popular Books Horizontal Carousel */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex-1 flex flex-col justify-between min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Popular This Week</h2>
                  <p className="text-[11px] text-slate-500">Most requested physical volumes in central collection</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => scrollCarousel('left')}
                    className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => scrollCarousel('right')}
                    className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Carousel Scroll Container */}
              <div
                ref={carouselRef}
                className="flex gap-4 overflow-x-auto pb-2 pt-1 scrollbar-none snap-x snap-mandatory scroll-smooth min-h-0 flex-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {popularBooks.map((book) => {
                  const bookmarked = isBookmarked(book.id || book._id);
                  return (
                    <div
                      key={book.id || book._id}
                      className="w-64 flex-shrink-0 bg-slate-50/80 rounded-2xl border border-slate-200/80 p-3.5 snap-start hover:shadow-md hover:border-indigo-200 transition-all duration-200 flex flex-col justify-between group"
                    >
                      <div>
                        <div
                          className={`h-28 bg-gradient-to-br ${book.coverColor} rounded-xl mb-2.5 p-3 flex flex-col justify-between relative overflow-hidden`}
                        >
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-200 bg-slate-900/80 px-2 py-0.5 rounded-md self-start border border-white/10">
                            {book.genre}
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmark(book);
                            }}
                            className={`absolute top-2.5 right-2.5 p-1 rounded-lg backdrop-blur-md transition-all ${
                              bookmarked ? 'bg-amber-500 text-white' : 'bg-slate-900/60 text-slate-300 hover:text-white'
                            }`}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-current' : ''}`} />
                          </button>

                          <h4 className="text-xs font-bold text-white line-clamp-2">{book.title}</h4>
                        </div>

                        <h3 className="font-bold text-slate-900 text-xs line-clamp-1 group-hover:text-indigo-600 transition-colors">
                          {book.title}
                        </h3>
                        <p className="text-[11px] text-slate-500">{book.author}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 mt-2">
                        <span
                          className={`text-[9px] font-semibold px-2 py-0.5 rounded-md border ${
                            book.availableCopies > 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {book.availableCopies > 0 ? `${book.availableCopies} Available` : 'Checked Out'}
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
            </div>
          </div>
        )}
      </div>

      {/* Book Details Modal */}
      {selectedBook && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedBook(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              {selectedBook.genre}
            </span>

            <h3 className="text-base font-bold text-slate-900 mt-2 mb-1">{selectedBook.title}</h3>
            <p className="text-xs text-slate-500 mb-3">By {selectedBook.author} ({selectedBook.year})</p>

            <p className="text-xs text-slate-600 leading-relaxed mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
              {selectedBook.description}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                <span className="text-slate-400 block mb-0.5 text-[10px]">Availability</span>
                <span className="font-bold text-slate-900 text-xs">
                  {selectedBook.availableCopies} of {selectedBook.totalCopies} in library
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                <span className="text-slate-400 block mb-0.5 text-[10px]">Location</span>
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span className="truncate">{selectedBook.location}</span>
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
                  isBookmarked(selectedBook.id)
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 fill-current" />
                <span>{isBookmarked(selectedBook.id) ? 'Saved' : 'Bookmark Item'}</span>
              </button>

              <button
                onClick={() => {
                  setSelectedBook(null);
                  navigate('/general-dashboard/search');
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
