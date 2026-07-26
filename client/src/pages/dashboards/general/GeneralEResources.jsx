import { useState, useMemo, useEffect } from "react";
import {
  FileText,
  ExternalLink,
  BookOpen,
  Globe,
  Database,
  FileCheck,
  Bookmark,
  CheckCircle2,
  Lock,
} from "lucide-react";
import useLocalBookmarks from "../../../hooks/useLocalBookmarks";
import { searchEbooks } from "../../../api/eresourcesApi";
import StickyControlBar from "../../../components/general/StickyControlBar";
import StatSummaryStrip from "../../../components/general/StatSummaryStrip";
import VirtualizedCardGrid from "../../../components/general/VirtualizedCardGrid";
import ActiveFilterChips from "../../../components/general/ActiveFilterChips";
import DigitalReaderModal from "../../../components/general/DigitalReaderModal";

import apiClient from "../../../api/client";

const CATEGORIES = ["All", "E-Books", "Journals", "Databases", "Past Papers"];

const categoryIcons = {
  "E-Books": BookOpen,
  Journals: Globe,
  Databases: Database,
  "Past Papers": FileCheck,
};

const SORT_OPTIONS = [
  { value: "relevance", label: "Sort: Featured" },
  { value: "title", label: "Title (A-Z)" },
  { value: "category", label: "Category" },
];

const GeneralEResources = () => {
  const { toggleBookmark, isBookmarked } = useLocalBookmarks();

  const [activeCategory, setActiveCategory] = useState("All");
  const [rawSearch, setRawSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [viewMode, setViewMode] = useState("grid");
  const [loading, setLoading] = useState(false);
  const [dbResources, setDbResources] = useState([]);
  const [apiEbooks, setApiEbooks] = useState([]);
  const [activeDigitalResource, setActiveDigitalResource] = useState(null);

  // Fetch e-resources from MongoDB API
  useEffect(() => {
    let isMounted = true;
    const fetchDbResources = async () => {
      try {
        const { data } = await apiClient.get("/eresources");
        if (isMounted && data && Array.isArray(data.data)) {
          const mapped = data.data.map((r) => ({
            id: r._id,
            title: r.title,
            category: r.category || "E-Books",
            format: r.fileFormat || "PDF",
            accessRequirement: r.accessRequirement || "Open Access",
            description: r.description || "Digital academic resource.",
            source: r.source || "Institution Library",
          }));
          setDbResources(mapped);
        }
      } catch {
        if (isMounted) setDbResources([]);
      }
    };

    fetchDbResources();
    return () => {
      isMounted = false;
    };
  }, []);

  // Debounce search query changes (~300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(rawSearch);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [rawSearch]);

  // Fetch Gutenberg public ebooks if backend DB has no resources
  useEffect(() => {
    let isMounted = true;
    const fetchApiResources = async () => {
      try {
        const data = await searchEbooks({
          search: searchQuery || "science",
          page: 1,
        });
        if (isMounted && data && Array.isArray(data.books)) {
          const mapped = data.books.slice(0, 6).map((b) => ({
            id: `gt-${b.id}`,
            title: b.title,
            category: "E-Books",
            format: "EPUB / HTML",
            accessRequirement: "Open Access",
            description: `Author: ${b.authors?.map((a) => a.name).join(", ") || "Public Domain"}. Language: ${b.languages?.join(", ").toUpperCase() || "EN"}.`,
            source: "Project Gutenberg",
            gutenbergId: b.id,
          }));
          setApiEbooks(mapped);
        }
      } catch {
        // Silently handle offline Gutenberg API
      }
    };

    fetchApiResources();
    return () => {
      isMounted = false;
    };
  }, [searchQuery]);

  const allList = useMemo(
    () => [...dbResources, ...apiEbooks],
    [dbResources, apiEbooks],
  );

  const combinedResources = useMemo(() => {
    return allList
      .filter((item) => {
        const matchesCategory =
          activeCategory === "All" || item.category === activeCategory;
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.source.toLowerCase().includes(q);
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "category") return a.category.localeCompare(b.category);
        return 0;
      });
  }, [allList, activeCategory, searchQuery, sortBy]);

  // Category counts for StatSummaryStrip
  const categoryStats = useMemo(() => {
    const ebooks = allList.filter((i) => i.category === "E-Books").length;
    const journals = allList.filter((i) => i.category === "Journals").length;
    const databases = allList.filter((i) => i.category === "Databases").length;
    const pastPapers = allList.filter(
      (i) => i.category === "Past Papers",
    ).length;

    return [
      {
        label: "E-Books",
        value: ebooks,
        icon: BookOpen,
        colorClass: "text-indigo-600",
        bgBadgeClass: "bg-indigo-50 text-indigo-700",
      },
      {
        label: "Journals",
        value: journals,
        icon: Globe,
        colorClass: "text-emerald-600",
        bgBadgeClass: "bg-emerald-50 text-emerald-700",
      },
      {
        label: "Databases",
        value: databases,
        icon: Database,
        colorClass: "text-purple-600",
        bgBadgeClass: "bg-purple-50 text-purple-700",
      },
      {
        label: "Past Papers",
        value: pastPapers,
        icon: FileCheck,
        colorClass: "text-amber-600",
        bgBadgeClass: "bg-amber-50 text-amber-700",
      },
    ];
  }, [allList]);

  const activeChips = [
    { key: "query", label: "Keyword", value: searchQuery },
    { key: "category", label: "Category", value: activeCategory },
  ];

  const handleRemoveChip = (key) => {
    if (key === "query") setRawSearch("");
    if (key === "category") setActiveCategory("All");
  };

  const handleResetAll = () => {
    setRawSearch("");
    setSearchQuery("");
    setActiveCategory("All");
    setSortBy("relevance");
  };

  return (
    <div className="flex flex-col min-h-full max-w-7xl mx-auto p-3 sm:p-4 gap-4 font-sans pb-10">
      {/* Sticky Control Bar */}
      <StickyControlBar
        searchQuery={rawSearch}
        onSearchChange={setRawSearch}
        onClearSearch={() => setRawSearch("")}
        placeholder="Search e-resources by keyword, title, or academic source..."
        sortBy={sortBy}
        onSortChange={setSortBy}
        sortOptions={SORT_OPTIONS}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        resultCount={combinedResources.length}
        filterSlot={
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {CATEGORIES.map((cat) => {
                const Icon = categoryIcons[cat] || FileText;
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                        : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80"
                    }`}
                  >
                    {cat !== "All" && <Icon className="w-3.5 h-3.5" />}
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>

            <StatSummaryStrip items={categoryStats} />
          </div>
        }
      />

      {/* Active Filter Chips */}
      <ActiveFilterChips
        chips={activeChips}
        onRemoveChip={handleRemoveChip}
        onResetAll={handleResetAll}
      />

      {/* Virtualized Cards Grid Container */}
      <VirtualizedCardGrid
        items={combinedResources}
        loading={loading}
        viewMode={viewMode}
        columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        emptyState={
          <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200/80 shadow-sm text-center space-y-4 max-w-md my-auto">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl w-12 h-12 mx-auto flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              No E-Resources Found
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              No public e-resources match your active category and keyword
              filter. Try resetting filters.
            </p>
            <button
              onClick={handleResetAll}
              className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Reset Filters
            </button>
          </div>
        }
        renderItem={(item) => {
          const Icon = categoryIcons[item.category] || FileText;
          const bookmarked = isBookmarked(item.id);
          const isOpenAccess = item.accessRequirement === "Open Access";

          return (
            <div
              key={item.id}
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                        isOpenAccess
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {isOpenAccess ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Lock className="w-3 h-3" />
                      )}
                      {item.accessRequirement}
                    </span>

                    <button
                      onClick={() => toggleBookmark(item)}
                      title={
                        bookmarked ? "Remove bookmark" : "Bookmark resource"
                      }
                      className={`p-1.5 rounded-xl border transition-all ${
                        bookmarked
                          ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                          : "bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-700"
                      }`}
                    >
                      <Bookmark
                        className={`w-3.5 h-3.5 ${bookmarked ? "fill-current" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400 mb-1">
                  <span>{item.category}</span>
                  <span>•</span>
                  <span className="text-indigo-600 font-bold">
                    {item.format}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors mb-1.5">
                  {item.title}
                </h3>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-3">
                  {item.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                <span className="text-[10px] text-slate-400 font-medium truncate">
                  Source: {item.source}
                </span>

                <button
                  onClick={() => {
                    const url =
                      item.fileUrl ||
                      (item.gutenbergId
                        ? `https://www.gutenberg.org/files/${item.gutenbergId}/${item.gutenbergId}-h/${item.gutenbergId}-h.htm`
                        : null);
                    if (url) {
                      setActiveDigitalResource({
                        title: item.title,
                        fileUrl: url,
                        fileType: item.format || "pdf",
                      });
                    } else if (item.gutenbergId) {
                      window.open(
                        `https://www.gutenberg.org/ebooks/${item.gutenbergId}`,
                        "_blank",
                      );
                    } else {
                      setActiveDigitalResource({
                        title: item.title,
                        fileUrl:
                          "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                        fileType: "pdf",
                      });
                    }
                  }}
                  className="px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1 flex-shrink-0 shadow-xs"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Preview In-App</span>
                </button>
              </div>
            </div>
          );
        }}
      />

      <DigitalReaderModal
        isOpen={Boolean(activeDigitalResource)}
        onClose={() => setActiveDigitalResource(null)}
        fileUrl={activeDigitalResource?.fileUrl}
        fileType={activeDigitalResource?.fileType || "pdf"}
        title={activeDigitalResource?.title}
      />
    </div>
  );
};

export default GeneralEResources;
