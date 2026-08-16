import { Sparkles, BookOpen, Layers, Flame, Compass, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import recommendationApi from "../../../api/recommendationApi";

const Recommendations = () => {
  const {
    data: recsResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["myRecommendations"],
    queryFn: () => recommendationApi.getMyRecommendations(),
  });

  const books = recsResponse?.data || [];
  const signal = recsResponse?.signal || {
    type: "popular_fallback",
    reason: "Popular & Trending Reads on Campus",
  };

  const getSignalBadge = (type) => {
    switch (type) {
      case "borrow_history":
        return {
          icon: <BookOpen size={14} className="text-emerald-400" />,
          label: "Based on Borrowing History",
          color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
        };
      case "major_alignment":
        return {
          icon: <Layers size={14} className="text-indigo-400" />,
          label: "Major & Academic Track Alignment",
          color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-300",
        };
      default:
        return {
          icon: <Flame size={14} className="text-amber-400" />,
          label: "Cold-Start Campus Trending",
          color: "bg-amber-500/10 border-amber-500/20 text-amber-300",
        };
    }
  };

  const badgeInfo = getSignalBadge(signal.type);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-edge/30 pb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg shadow-amber-500/5 shrink-0">
            <Sparkles size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border flex items-center gap-1.5 ${badgeInfo.color}`}>
                {badgeInfo.icon}
                {badgeInfo.label}
              </span>
            </div>
            <h1 className="text-3xl font-serif font-bold text-ink">
              Recommended For You
            </h1>
            <p className="text-sm text-muted mt-1">
              Personalized book recommendations generated dynamically by campus activity signals.
            </p>
          </div>
        </div>
      </div>

      {/* Main Signal Banner & Reasoning */}
      {!isLoading && !isError && books.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Compass size={20} className="text-indigo-400 shrink-0" />
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Primary Recommendation Reason
              </div>
              <div className="text-sm font-bold text-white mt-0.5">
                {signal.reason}
              </div>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 hidden sm:inline-block">
            {books.length} Item{books.length === 1 ? "" : "s"} Matched
          </span>
        </div>
      )}

      {/* Recommendation Results Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
          <p className="text-sm font-medium">Computing personalized campus recommendations...</p>
        </div>
      ) : isError ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm">
          Failed to load recommendations: {error?.message || "Server error"}
        </div>
      ) : books.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-edge/40 rounded-3xl bg-surface/50 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md">
            <h3 className="text-lg font-bold text-ink">No Catalog Recommendations Yet</h3>
            <p className="text-sm text-muted mt-1">
              Start borrowing books or browsing e-resources to generate tailored campus recommendations!
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {books.map((book) => (
            <div
              key={book._id}
              className="group bg-surface border border-edge/40 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:border-amber-500/40 transition-all flex flex-col"
            >
              {/* Thumbnail / Cover Container */}
              <div className="h-56 bg-slate-900 relative overflow-hidden flex items-center justify-center p-4">
                {book.coverImage ? (
                  <img
                    src={book.coverImage}
                    alt={book.title}
                    className="max-h-full max-w-full object-contain rounded-lg shadow-md group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-gradient-to-br from-slate-800 to-indigo-950 flex flex-col items-center justify-center text-center p-4 border border-slate-700/50">
                    <BookOpen size={36} className="text-indigo-400 mb-2 opacity-60" />
                    <span className="text-xs font-bold text-slate-300 line-clamp-2">
                      {book.title}
                    </span>
                  </div>
                )}

                <div className="absolute top-3 left-3">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-amber-300 border border-amber-500/30">
                    {book.category || "General"}
                  </span>
                </div>
              </div>

              {/* Book Info */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="font-bold text-ink text-sm line-clamp-2 group-hover:text-amber-400 transition-colors">
                    {book.title}
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    {book.author || "Unknown Author"}
                  </p>
                </div>

                <div className="pt-3 border-t border-edge/20 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Published: {book.publishedYear || "N/A"}</span>
                  <span className="text-emerald-400 font-bold">
                    {book.availableCopies > 0 ? "Available" : "Checked Out"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Recommendations;
