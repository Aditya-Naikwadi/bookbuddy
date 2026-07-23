import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import StatCard from '../../../components/general/StatCard';
import AnnouncementCard from '../../../components/general/AnnouncementCard';
import QuickActionCard from '../../../components/general/QuickActionCard';
import useLocalBookmarks from '../../../hooks/useLocalBookmarks';

// Mock Announcements Dataset with Priorities
const INITIAL_ANNOUNCEMENTS = [
  {
    id: 'anc-1',
    title: 'Midterm Extended Library Hours',
    content: 'The main reading hall will remain open until 11:30 PM throughout the examination week.',
    priority: 'Notice',
    timestamp: 'Today, 9:00 AM',
  },
  {
    id: 'anc-2',
    title: 'Scheduled Network Maintenance',
    content: 'Wi-Fi services in Section B will undergo scheduled maintenance on Friday between 2 PM and 4 PM.',
    priority: 'Warning',
    timestamp: 'Yesterday',
  },
  {
    id: 'anc-3',
    title: 'Urgent: Reserve Desk Relocation',
    content: 'All course reserve pick-ups have temporarily moved to Desk 2 near the North Entrance.',
    priority: 'Urgent',
    timestamp: '2 days ago',
  },
];

// Mock Featured Books Carousel Data
const POPULAR_BOOKS = [
  {
    id: 'b-1',
    title: 'Principles of Modern Architecture & Urban Planning',
    author: 'Elena Rostova',
    genre: 'Architecture',
    year: '2024',
    availableCopies: 4,
    totalCopies: 5,
    location: 'Floor 2, Shelf A-14',
    description: 'A comprehensive study of contemporary sustainable building design and urban infrastructure.',
  },
  {
    id: 'b-2',
    title: 'Data Structures and Algorithms in Python',
    author: 'Dr. Alan Turing Jr.',
    genre: 'Computer Science',
    year: '2023',
    availableCopies: 2,
    totalCopies: 6,
    location: 'Floor 3, Shelf CS-08',
    description: 'Essential algorithmic patterns, dynamic programming, and data structures for engineers.',
  },
  {
    id: 'b-3',
    title: 'Global Economic Trends & Financial Markets',
    author: 'Prof. Marcus Vance',
    genre: 'Economics',
    year: '2024',
    availableCopies: 0,
    totalCopies: 3,
    location: 'Floor 1, Shelf EC-02',
    description: 'An analysis of macroeconomic shifts, currency fluctuations, and emerging markets.',
  },
  {
    id: 'b-4',
    title: 'Biochemistry & Molecular Biology Essentials',
    author: 'Dr. Sarah Lin',
    genre: 'Biology',
    year: '2023',
    availableCopies: 5,
    totalCopies: 5,
    location: 'Floor 3, Shelf BIO-12',
    description: 'Fundamentals of enzyme kinetics, cellular pathways, and genetic transcription.',
  },
  {
    id: 'b-5',
    title: 'History of World Literature: Antiquity to Modernity',
    author: 'Clara Oswald',
    genre: 'Literature',
    year: '2022',
    availableCopies: 1,
    totalCopies: 4,
    location: 'Floor 2, Shelf LIT-05',
    description: 'A global timeline exploring literary masterpieces across civilizations.',
  },
];

const GeneralDashboardHome = () => {
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  const { toggleBookmark, isBookmarked } = useLocalBookmarks();

  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [announcements, setAnnouncements] = useState(INITIAL_ANNOUNCEMENTS);
  const [selectedBook, setSelectedBook] = useState(null);

  // Simulated initial data fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setLoading(false);
    }, 500);
  };

  const handleDismissAnnouncement = (id) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  };

  const scrollCarousel = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-8 pb-12 max-w-7xl mx-auto">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 tracking-tight">
            General Public Portal
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse the public catalog, explore e-resources, check library availability, and save items.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center flex-shrink-0">
          <span className="text-xs text-slate-400 font-medium">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh dashboard data"
            className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Library Hours Today"
          value="8:00 AM - 10:00 PM"
          icon={Clock}
          subtitle="Main Campus Central Reading Hall"
          badge={{ text: 'Open Now', type: 'success' }}
          loading={loading}
        />

        <StatCard
          title="Total Catalog Books"
          value="15,420"
          icon={BookOpen}
          subtitle="Across 12 Academic Categories"
          trend="+140 this month"
          loading={loading}
        />

        <StatCard
          title="New Arrivals"
          value="128 Titles"
          icon={Sparkles}
          subtitle="Click to browse recent acquisitions"
          badge={{ text: 'Updated Weekly', type: 'info' }}
          loading={loading}
          clickable
          onClick={() => navigate('/general-dashboard/search?filter=new')}
        />
      </div>

      {/* Quick Actions Row */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Quick Actions</h2>
          <span className="text-xs text-slate-500">Fast access for public visitors</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <QuickActionCard
            title="Search the Catalog"
            description="Perform faceted searches across physical books, author entries, and locations."
            icon={Search}
            to="/general-dashboard/search"
            badge="Advanced Search"
            color="indigo"
          />

          <QuickActionCard
            title="Browse E-Resources"
            description="Explore open-access journals, digital archives, and Gutenberg public e-books."
            icon={FileText}
            to="/general-dashboard/e-resources"
            badge="Open Access"
            color="emerald"
          />

          <QuickActionCard
            title="View My Bookmarks"
            description="Access your saved books and resources saved locally in your browser."
            icon={Bookmark}
            to="/general-dashboard/saved"
            badge="Saved Items"
            color="purple"
          />
        </div>
      </div>

      {/* Announcements Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Campus Notices & Announcements</h2>
              <p className="text-xs text-slate-500">Live operational updates and library policy notices</p>
            </div>
          </div>
          {announcements.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
              {announcements.length} Active
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            <AnnouncementCard loading />
            <AnnouncementCard loading />
          </div>
        ) : announcements.length === 0 ? (
          <div className="py-10 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No Current Notices</h3>
            <p className="text-xs text-slate-500 mt-1">There are no active campus announcements at this time.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
            {announcements.map((item) => (
              <AnnouncementCard key={item.id} announcement={item} onDismiss={handleDismissAnnouncement} />
            ))}
          </div>
        )}
      </div>

      {/* Horizontal Carousel — Popular & Recommended Books */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Popular This Week</h2>
            <p className="text-xs text-slate-500">Most requested physical volumes in the central collection</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollCarousel('left')}
              className="p-2 rounded-xl border border-slate-200/80 hover:bg-slate-50 text-slate-600 transition-colors"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scrollCarousel('right')}
              className="p-2 rounded-xl border border-slate-200/80 hover:bg-slate-50 text-slate-600 transition-colors"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel Container */}
        <div
          ref={carouselRef}
          className="flex gap-5 overflow-x-auto pb-4 pt-2 scrollbar-none snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {POPULAR_BOOKS.map((book) => {
            const bookmarked = isBookmarked(book.id);
            return (
              <div
                key={book.id}
                className="w-72 flex-shrink-0 bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 snap-start hover:shadow-md hover:border-indigo-200 transition-all duration-200 flex flex-col justify-between group"
              >
                <div>
                  <div className="h-36 bg-gradient-to-br from-indigo-950 via-slate-800 to-slate-900 rounded-xl mb-3 p-3 flex flex-col justify-between relative overflow-hidden">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded-md self-start border border-white/10">
                      {book.genre}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(book);
                      }}
                      className={`absolute top-3 right-3 p-1.5 rounded-lg backdrop-blur-md transition-all ${
                        bookmarked ? 'bg-amber-500 text-white' : 'bg-slate-900/60 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-current' : ''}`} />
                    </button>

                    <h4 className="text-xs font-bold text-white line-clamp-2">{book.title}</h4>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-indigo-600 transition-colors">
                    {book.title}
                  </h3>
                  <p className="text-xs text-slate-500 mb-2">{book.author}</p>
                </div>

                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2 mt-2">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                      book.availableCopies > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {book.availableCopies > 0 ? `${book.availableCopies} Available` : 'Checked Out'}
                  </span>

                  <button
                    onClick={() => setSelectedBook(book)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
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

      {/* Book Details Modal */}
      {selectedBook && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedBook(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              {selectedBook.genre}
            </span>

            <h3 className="text-xl font-bold text-slate-900 mt-3 mb-1">{selectedBook.title}</h3>
            <p className="text-xs text-slate-500 mb-4">By {selectedBook.author} ({selectedBook.year})</p>

            <p className="text-xs text-slate-600 leading-relaxed mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              {selectedBook.description}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <span className="text-slate-400 block mb-0.5">Availability</span>
                <span className="font-bold text-slate-900">
                  {selectedBook.availableCopies} of {selectedBook.totalCopies} copies in library
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <span className="text-slate-400 block mb-0.5">Physical Location</span>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                  {selectedBook.location}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  toggleBookmark(selectedBook);
                  setSelectedBook(null);
                }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  isBookmarked(selectedBook.id)
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20'
                }`}
              >
                <Bookmark className="w-4 h-4 fill-current" />
                <span>{isBookmarked(selectedBook.id) ? 'Remove Bookmark' : 'Save to Bookmarks'}</span>
              </button>

              <button
                onClick={() => {
                  setSelectedBook(null);
                  navigate('/general-dashboard/search');
                }}
                className="py-3 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
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
