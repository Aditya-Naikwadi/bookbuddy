import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import {
  FileText,
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
const DigitalReaderModal = lazy(
  () => import("../../../components/general/DigitalReaderModal"),
);

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

  const allList = useMemo(() => {
    return [...dbResources, ...apiEbooks];
  }, [dbResources, apiEbooks]);

  const combinedResources = useMemo(() => {
    return allList
      .filter((item) => {
        if (!item) return false;
        const matchesCategory =
          activeCategory === "All" || item.category === activeCategory;
        const q = (searchQuery || "").toLowerCase().trim();
        const titleStr = (item.title || "").toLowerCase();
        const descStr = (item.description || "").toLowerCase();
        const srcStr = (item.source || "").toLowerCase();

        const matchesSearch =
          !q ||
          titleStr.includes(q) ||
          descStr.includes(q) ||
          srcStr.includes(q);
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        const titleA = a?.title || "";
        const titleB = b?.title || "";
        const catA = a?.category || "";
        const catB = b?.category || "";
        if (sortBy === "title") return titleA.localeCompare(titleB);
        if (sortBy === "category") return catA.localeCompare(catB);
        return 0;
      });
  }, [allList, activeCategory, searchQuery, sortBy]);

  // Category counts for StatSummaryStrip
  const categoryStats = useMemo(() => {
    const safeList = Array.isArray(allList) ? allList.filter(Boolean) : [];
    const ebooks = safeList.filter((i) => i.category === "E-Books").length;
    const journals = safeList.filter((i) => i.category === "Journals").length;
    const databases = safeList.filter((i) => i.category === "Databases").length;
    const pastPapers = safeList.filter(
      (i) => i.category === "Past Papers",
    ).length;

    return [
      {
        label: "E-Books",
        value: ebooks,
        icon: BookOpen,
        colorClass: "text-indigo-400",
        bgBadgeClass:
          "bg-indigo-950 text-indigo-300 border border-indigo-800/80",
      },
      {
        label: "Journals",
        value: journals,
        icon: Globe,
        colorClass: "text-emerald-400",
        bgBadgeClass:
          "bg-emerald-950 text-emerald-300 border border-emerald-800/80",
      },
      {
        label: "Databases",
        value: databases,
        icon: Database,
        colorClass: "text-purple-400",
        bgBadgeClass:
          "bg-purple-950 text-purple-300 border border-purple-800/80",
      },
      {
        label: "Past Papers",
        value: pastPapers,
        icon: FileCheck,
        colorClass: "text-amber-400",
        bgBadgeClass: "bg-amber-950 text-amber-300 border border-amber-800/80",
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
    <div className="flex flex-col min-h-full max-w-7xl mx-auto p-3 sm:p-4 gap-4 font-sans pb-10 text-slate-100">
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
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                        : "bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800"
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
          <div className="bg-slate-900 p-8 sm:p-12 rounded-3xl border border-slate-800 shadow-2xl text-center space-y-4 max-w-md my-auto text-slate-100">
            <div className="p-3 bg-indigo-950 text-indigo-400 border border-indigo-800/60 rounded-2xl w-12 h-12 mx-auto flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">
              No E-Resources Found
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No public e-resources match your active category and keyword
              filter. Try resetting filters.
            </p>
            <button
              onClick={handleResetAll}
              className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-500 transition-colors shadow-md"
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
              className="bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl hover:border-indigo-500/50 hover:shadow-2xl transition-all duration-200 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 bg-indigo-950/80 text-indigo-400 border border-indigo-800/60 rounded-2xl">
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                        isOpenAccess
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/80"
                          : "bg-amber-950/80 text-amber-300 border-amber-800/80"
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
                          ? "bg-amber-500 text-white border-amber-500 shadow-amber-500/30"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800"
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
                  <span className="text-indigo-400 font-bold">
                    {item.format}
                  </span>
                </div>

                <h3 className="font-bold text-slate-100 text-sm leading-snug line-clamp-2 group-hover:text-indigo-400 transition-colors mb-1.5">
                  {item.title}
                </h3>

                <p className="text-xs text-slate-300 leading-relaxed line-clamp-3 mb-3">
                  {item.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 mt-auto">
                <span className="text-[10px] text-slate-400 font-medium truncate">
                  Source: {item.source}
                </span>

                <button
                  onClick={() => {
                    const url =
                      item.fileUrl ||
                      item.readUrl ||
                      item.epubUrl ||
                      item.downloadUrl ||
                      item.pdfUrl ||
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
                  className="px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-500 font-bold text-xs rounded-xl transition-all flex items-center gap-1 flex-shrink-0 shadow-md shadow-indigo-600/20"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Preview In-App</span>
                </button>
              </div>
            </div>
          );
        }}
      />

      <Suspense fallback={null}>
        <DigitalReaderModal
          isOpen={Boolean(activeDigitalResource)}
          onClose={() => setActiveDigitalResource(null)}
          fileUrl={activeDigitalResource?.fileUrl}
          fileType={activeDigitalResource?.fileType || "pdf"}
          title={activeDigitalResource?.title}
          resource={activeDigitalResource}
        />
      </Suspense>
    </div>
  );
};

export default GeneralEResources;
