import { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  ExternalLink,
  Search,
  BookOpen,
  Globe,
  Database,
  FileCheck,
  Bookmark,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import useLocalBookmarks from '../../../hooks/useLocalBookmarks';
import { searchEbooks } from '../../../api/eresourcesApi';

const PUBLIC_ERESOURCEN_DATA = [
  {
    id: 'er-1',
    title: 'History of Local Architecture & Campus Planning',
    category: 'E-Books',
    format: 'PDF',
    accessRequirement: 'Open Access',
    description: 'Historical archive documenting the evolution of regional building techniques and campus blueprints.',
    source: 'Gutenberg Archive',
    downloads: '1.2k',
  },
  {
    id: 'er-2',
    title: 'Journal of Sustainable Energy & Environmental Engineering',
    category: 'Journals',
    format: 'Web Article',
    accessRequirement: 'Open Access',
    description: 'Peer-reviewed open access papers covering solar photovoltaic efficiency and microgrid dynamics.',
    source: 'DOAJ Open Index',
    downloads: '3.4k',
  },
  {
    id: 'er-3',
    title: 'Computer Science Past Examination Papers (2018 - 2024)',
    category: 'Past Papers',
    format: 'PDF',
    accessRequirement: 'Login Required',
    description: 'Curated collection of previous semester examination problems, mark schemes, and solution guides.',
    source: 'Academic Repository',
    downloads: '850',
  },
  {
    id: 'er-4',
    title: 'Global Economic Data & Financial Indicator Database',
    category: 'Databases',
    format: 'Interactive Data',
    accessRequirement: 'Open Access',
    description: 'Open public dataset tracking inflation indicators, exchange rate statistics, and trade metrics.',
    source: 'World Open Data',
    downloads: '5.1k',
  },
  {
    id: 'er-5',
    title: 'Classical Literature & World Philosophy Reader',
    category: 'E-Books',
    format: 'EPUB',
    accessRequirement: 'Open Access',
    description: 'Public domain collection featuring translated works of ancient Greek and Asian philosophical treatises.',
    source: 'Project Gutenberg',
    downloads: '2.8k',
  },
];

const CATEGORIES = ['All', 'E-Books', 'Journals', 'Databases', 'Past Papers'];

const categoryIcons = {
  'E-Books': BookOpen,
  Journals: Globe,
  Databases: Database,
  'Past Papers': FileCheck,
};

const GeneralEResources = () => {
  const { toggleBookmark, isBookmarked } = useLocalBookmarks();

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiEbooks, setApiEbooks] = useState([]);

  // Fetch Gutenberg public ebooks if backend API is connected
  useEffect(() => {
    let isMounted = true;
    const fetchApiResources = async () => {
      try {
        setLoading(true);
        const data = await searchEbooks({ search: searchQuery || 'science', page: 1 });
        if (isMounted && data && Array.isArray(data.books)) {
          const mapped = data.books.slice(0, 6).map((b) => ({
            id: `gt-${b.id}`,
            title: b.title,
            category: 'E-Books',
            format: 'EPUB / HTML',
            accessRequirement: 'Open Access',
            description: `Author: ${b.authors?.map((a) => a.name).join(', ') || 'Public Domain'}. Language: ${b.languages?.join(', ').toUpperCase() || 'EN'}.`,
            source: 'Project Gutenberg',
            gutenbergId: b.id,
          }));
          setApiEbooks(mapped);
        }
      } catch {
        // Silently fallback to built-in mock resources if Gutenberg API is offline
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchApiResources();
    return () => {
      isMounted = false;
    };
  }, [searchQuery]);

  const combinedResources = useMemo(() => {
    const list = [...PUBLIC_ERESOURCEN_DATA, ...apiEbooks];
    return list.filter((item) => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery, apiEbooks]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 tracking-tight">
            Public E-Resources & Digital Archives
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Access open-access journals, public domain e-books, open datasets, and academic repositories.
          </p>
        </div>

        <span className="text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl self-start sm:self-center flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" />
          Open Access Enabled
        </span>
      </div>

      {/* Search Bar + Filter Tabs */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search e-resources by keyword, title, or academic source..."
            className="w-full pl-11 pr-4 py-3 text-sm bg-slate-50 border border-slate-200/80 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all"
          />
        </div>

        {/* Category Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const Icon = categoryIcons[cat] || FileText;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {cat !== 'All' && <Icon className="w-3.5 h-3.5" />}
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of E-Resources */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm animate-pulse space-y-3">
              <div className="flex justify-between">
                <div className="w-10 h-10 bg-slate-200 rounded-xl"></div>
                <div className="w-20 h-5 bg-slate-200 rounded-md"></div>
              </div>
              <div className="h-5 w-3/4 bg-slate-200 rounded-md"></div>
              <div className="h-3 w-full bg-slate-200 rounded-md"></div>
              <div className="h-3 w-1/2 bg-slate-200 rounded-md"></div>
            </div>
          ))}
        </div>
      ) : combinedResources.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No E-Resources Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No public e-resources match your active category and keyword filter. Try choosing "All" or adjusting your search term.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {combinedResources.map((item) => {
            const Icon = categoryIcons[item.category] || FileText;
            const bookmarked = isBookmarked(item.id);
            const isOpenAccess = item.accessRequirement === 'Open Access';

            return (
              <div
                key={item.id}
                className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group relative"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <Icon className="w-6 h-6" />
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                          isOpenAccess
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {isOpenAccess ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {item.accessRequirement}
                      </span>

                      <button
                        onClick={() => toggleBookmark(item)}
                        title={bookmarked ? 'Remove bookmark' : 'Bookmark resource'}
                        className={`p-2 rounded-xl border transition-all ${
                          bookmarked
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-700'
                        }`}
                      >
                        <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 mb-1">
                    <span>{item.category}</span>
                    <span>•</span>
                    <span className="text-indigo-600">{item.format}</span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors mb-2">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-4">{item.description}</p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                  <span className="text-[11px] text-slate-400 font-medium">Source: {item.source}</span>

                  <button
                    onClick={() => {
                      if (item.gutenbergId) {
                        window.open(`https://www.gutenberg.org/ebooks/${item.gutenbergId}`, '_blank');
                      } else {
                        alert(`Opening public access document: ${item.title}`);
                      }
                    }}
                    className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <span>Read Publicly</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GeneralEResources;
