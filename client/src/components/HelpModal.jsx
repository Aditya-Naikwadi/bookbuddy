import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Search,
  BookOpen,
  X,
  PlayCircle,
  ChevronRight,
  Sparkles,
  FileText,
  Tag,
} from 'lucide-react';
import { HELP_ARTICLES } from '../content/help/articles';
import { ONBOARDING_TOUR_STEPS } from '../onboarding/tourSteps';

export const HelpModal = ({ isOpen, onClose, onStartTour }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [activeTab, setActiveTab] = useState('articles'); // 'articles' | 'tour'

  if (!isOpen) return null;

  const filteredArticles = HELP_ARTICLES.filter((article) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    return (
      article.title.toLowerCase().includes(q) ||
      article.summary.toLowerCase().includes(q) ||
      article.category.toLowerCase().includes(q) ||
      article.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const handleReplayTour = () => {
    onClose();
    if (typeof onStartTour === 'function') {
      onStartTour();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Help & Knowledge Center
              </h2>
              <p className="text-xs text-slate-400">Search guides or replay the platform tour</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar (Search + Replay Tour Button - F9.4) */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help articles by keyword, title, or topic..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          {/* F9.4 — Replay tour entry point button */}
          <button
            onClick={handleReplayTour}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-md flex items-center gap-2 shrink-0 w-full sm:w-auto justify-center"
          >
            <PlayCircle className="w-4 h-4" />
            <span>Replay Onboarding Tour</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {selectedArticle ? (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedArticle(null)}
                className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-semibold mb-2"
              >
                ← Back to All Help Articles
              </button>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold">
                <Tag className="w-3 h-3" /> {selectedArticle.category}
              </div>

              <h1 className="text-2xl font-bold text-white">{selectedArticle.title}</h1>
              <p className="text-xs text-slate-400 font-medium italic">{selectedArticle.summary}</p>

              <div className="prose prose-invert max-w-none text-slate-300 text-xs leading-relaxed whitespace-pre-line border-t border-slate-800 pt-4">
                {selectedArticle.content}
              </div>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-white mb-1">No Matching Help Articles</h3>
              <p className="text-xs text-slate-400">
                No articles match your search term "{searchQuery}".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredArticles.map((article) => (
                <div
                  key={article.id}
                  onClick={() => setSelectedArticle(article)}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-indigo-500/50 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                        {article.category}
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors flex items-center justify-between">
                      <span>{article.title}</span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
                    </h4>

                    <p className="text-slate-400 text-xs mt-1.5 line-clamp-2">
                      {article.summary}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-3 pt-2 border-t border-slate-800/60">
                    {article.tags.slice(0, 3).map((tag, idx) => (
                      <span key={idx} className="text-[10px] text-slate-500 font-mono">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
