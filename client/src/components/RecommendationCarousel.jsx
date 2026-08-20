import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Star,
  BookOpen,
  TrendingUp,
  Flame,
  Info,
} from 'lucide-react';

export const RecommendationCarousel = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/v1/recommendations', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const data = await res.json();

        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setRecommendations(data.data);
          setIsFallback(false);
        } else {
          // Cold-Start Fallback: Fetch trending/popular books in college
          fetchColdStartFallback();
        }
      } catch (err) {
        console.error('Error fetching user recommendations:', err);
        fetchColdStartFallback();
      } finally {
        setLoading(false);
      }
    };

    const fetchColdStartFallback = async () => {
      try {
        const res = await fetch('/api/v1/books?limit=10', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const data = await res.json();

        const fallbackItems = (data.data || data.books || []).map((book) => ({
          bookId: book,
          score: 5,
          reason: 'Trending in your college',
        }));

        setRecommendations(fallbackItems);
        setIsFallback(true);
      } catch (fallbackErr) {
        console.error('Error fetching cold-start fallback books:', fallbackErr);
      }
    };

    fetchRecommendations();
  }, []);

  const handleScroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 my-6 animate-pulse">
        <div className="h-6 w-48 bg-slate-800 rounded-xl mb-4"></div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="min-w-[220px] h-[300px] bg-slate-800/60 rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 my-6 shadow-xl relative overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
            {isFallback ? (
              <>
                <Flame className="w-4 h-4 text-amber-400" /> College Catalog Highlights
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-indigo-400" /> Tailored For You
              </>
            )}
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            {isFallback ? 'Trending in Your College' : 'Recommended For You'}
          </h2>
        </div>

        {/* Carousel Scroll Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleScroll('left')}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60 shadow-md"
            aria-label="Scroll Left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleScroll('right')}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60 shadow-md"
            aria-label="Scroll Right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Carousel Track */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-none scroll-smooth pb-2 pt-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {recommendations.map((item, index) => {
          const book = item.bookId || {};
          const title = book.title || 'Catalog Book';
          const author = book.author || 'Unknown Author';
          const category = book.category || 'General';
          const avgRating = book.avgRating || 4.5;
          const reason = item.reason || 'Recommended title';

          return (
            <div
              key={book._id || index}
              className="min-w-[220px] max-w-[220px] bg-slate-950/80 rounded-2xl border border-slate-800 hover:border-indigo-500/50 p-4 flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1 shadow-lg group"
            >
              <div>
                {/* Book Cover Placeholder / Image */}
                <div className="w-full h-36 bg-gradient-to-br from-indigo-900/60 to-purple-900/60 rounded-xl mb-3 flex flex-col items-center justify-center border border-indigo-500/20 relative overflow-hidden group-hover:scale-[1.02] transition-transform">
                  {book.coverImage ? (
                    <img
                      src={book.coverImage}
                      alt={title}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <BookOpen className="w-10 h-10 text-indigo-300/60" />
                  )}

                  {/* Rating Badge */}
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-slate-950/80 backdrop-blur-md border border-amber-500/40 text-amber-300 font-bold text-[10px] flex items-center gap-1 shadow-md">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {avgRating}
                  </div>
                </div>

                {/* Category Pill */}
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                  {category}
                </span>

                <h4 className="font-bold text-sm text-white mt-1.5 line-clamp-1 group-hover:text-indigo-300 transition-colors">
                  {title}
                </h4>
                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{author}</p>
              </div>

              {/* Human-Readable Reason Badge */}
              <div className="mt-4 pt-2.5 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5 text-[11px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2.5 py-1.5">
                  <Info className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                  <span className="line-clamp-1 font-medium">{reason}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecommendationCarousel;
