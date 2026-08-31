import { useState, useMemo } from "react";
import {
  Bookmark,
  Highlighter,
  FileText,
  Search,
  X,
  Trash2,
  Download,
  ExternalLink,
  Filter,
} from "lucide-react";
import { exportAnnotationsApi } from "../../services/annotationService";

const COLOR_MAP = {
  yellow: {
    bg: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    badge: "bg-yellow-400",
  },
  green: {
    bg: "bg-green-500/20 text-green-300 border-green-500/30",
    badge: "bg-green-400",
  },
  blue: {
    bg: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    badge: "bg-sky-400",
  },
  pink: {
    bg: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    badge: "bg-pink-400",
  },
  purple: {
    bg: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    badge: "bg-purple-400",
  },
};

const AnnotationSidebar = ({
  isOpen,
  onClose,
  annotations = [],
  bookId,
  _fileType = "pdf",
  onJumpToLocation,
  onDeleteAnnotation,
}) => {
  const [activeTab, setActiveTab] = useState("highlights"); // 'bookmarks' | 'highlights' | 'notes'
  const [searchQuery, setSearchQuery] = useState("");
  const [colorFilter, setColorFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);

  const filteredAnnotations = useMemo(() => {
    return annotations.filter((item) => {
      // Tab filter
      if (activeTab === "bookmarks" && item.type !== "bookmark") return false;
      if (activeTab === "highlights" && item.type !== "highlight") return false;
      if (activeTab === "notes" && item.type !== "note" && !item.noteText)
        return false;

      // Color filter for highlights
      if (
        activeTab === "highlights" &&
        colorFilter !== "all" &&
        item.color !== colorFilter
      ) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchHighlight = item.highlightText?.toLowerCase().includes(q);
        const matchNote = item.noteText?.toLowerCase().includes(q);
        const matchLabel = item.label?.toLowerCase().includes(q);
        return matchHighlight || matchNote || matchLabel;
      }

      return true;
    });
  }, [annotations, activeTab, colorFilter, searchQuery]);

  const handleExport = async () => {
    if (!bookId) return;
    try {
      setIsExporting(true);
      const res = await exportAnnotationsApi(bookId);
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `annotations_${bookId}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error("Export annotations failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 h-full flex flex-col z-20 shadow-2xl relative">
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <Highlighter className="w-4 h-4 text-indigo-400" />
          <span>Annotations & Notes</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400">
            {annotations.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExport}
            disabled={isExporting || annotations.length === 0}
            title="Export annotations (JSON)"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 gap-1">
        <button
          onClick={() => setActiveTab("highlights")}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === "highlights"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Highlighter className="w-3.5 h-3.5" />
          <span>Highlights</span>
        </button>

        <button
          onClick={() => setActiveTab("bookmarks")}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === "bookmarks"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Bookmarks</span>
        </button>

        <button
          onClick={() => setActiveTab("notes")}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === "notes"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Notes</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-2.5 border-b border-slate-800/80 bg-slate-950/20 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search annotations..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500"
          />
        </div>

        {activeTab === "highlights" && (
          <div className="relative">
            <select
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Colors</option>
              <option value="yellow">Yellow</option>
              <option value="green">Green</option>
              <option value="blue">Blue</option>
              <option value="pink">Pink</option>
              <option value="purple">Purple</option>
            </select>
          </div>
        )}
      </div>

      {/* Annotation List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredAnnotations.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
              <Filter className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-400 font-medium">
              No annotations found
            </p>
            <p className="text-[11px] text-slate-500">
              {activeTab === "highlights"
                ? "Select text in the reader to create a highlight."
                : activeTab === "bookmarks"
                  ? 'Click "Bookmark Location" in the header bar.'
                  : "Attach a study note to your highlights."}
            </p>
          </div>
        ) : (
          filteredAnnotations.map((item) => {
            const colorConfig =
              COLOR_MAP[item.color || "yellow"] || COLOR_MAP.yellow;
            const locationLabel = item.page
              ? `Page ${item.page}`
              : item.cfiRange
                ? `CFI: ${item.cfiRange.substring(0, 16)}...`
                : "Bookmarked Location";

            return (
              <div
                key={item._id || item.id || item.clientId}
                className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 space-y-2 hover:border-slate-700 transition-colors group relative"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                  <div className="flex items-center gap-1.5">
                    {item.type === "highlight" && (
                      <span
                        className={`w-2 h-2 rounded-full ${colorConfig.badge}`}
                      />
                    )}
                    {item.type === "bookmark" && (
                      <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>{locationLabel}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onJumpToLocation(item)}
                      title="Jump to location"
                      className="px-2 py-0.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Jump</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => onDeleteAnnotation(item._id || item.id)}
                      title="Delete"
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Highlight Snippet */}
                {item.highlightText && (
                  <p className="text-xs text-slate-200 font-serif italic line-clamp-3 pl-2 border-l-2 border-slate-700">
                    "{item.highlightText}"
                  </p>
                )}

                {/* Bookmark Label */}
                {item.type === "bookmark" && (
                  <p className="text-xs font-semibold text-slate-200">
                    {item.label || item.text || "Untitled Bookmark"}
                  </p>
                )}

                {/* Attached Note */}
                {item.noteText && (
                  <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-2 text-xs text-slate-300 leading-relaxed font-sans">
                    <span className="text-[10px] font-bold text-indigo-400 block mb-0.5">
                      Note:
                    </span>
                    {item.noteText}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AnnotationSidebar;
