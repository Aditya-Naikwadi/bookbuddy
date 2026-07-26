import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Bookmark,
  Check,
} from "lucide-react";
import apiClient from "../../../api/client";
import useAuthStore from "../../../store/authStore";
import { getContentUrl } from "../../../api/eresourcesApi";
import { useEpubLoader } from "../../../hooks/useEpubLoader";
import { useReaderPosition } from "../../../hooks/useReaderPosition";
import { ReaderToolbar } from "../../../components/student/ebook-reader/ReaderToolbar";
import { TableOfContents } from "../../../components/student/ebook-reader/TableOfContents";
import { ReaderThemeControls } from "../../../components/student/ebook-reader/ReaderThemeControls";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  typeof window !== "undefined"
    ? `${window.location.origin}/pdf.worker.min.mjs`
    : "/pdf.worker.min.mjs";

const EbookReader = () => {
  const { resourceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userId = user?.id || user?._id || "guest";

  const viewerRef = useRef(null);
  const readerContainerRef = useRef(null);
  const pdfCanvasRef = useRef(null);

  // States
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // PDF Engine state
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfOutline, setPdfOutline] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  // Text selection & Annotation State
  const [selectedText, setSelectedText] = useState("");
  const [annotationModalOpen, setAnnotationModalOpen] = useState(false);
  const [highlightColor, setHighlightColor] = useState("yellow"); // yellow | green | blue | pink
  const [noteText, setNoteText] = useState("");
  const [annotationTag, setAnnotationTag] = useState("exam-prep");
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false);
  const [annotationSuccess, setAnnotationSuccess] = useState(false);

  // Persistent Reader Settings
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem(`bookbuddy_reader_fontsize_${userId}`);
    return saved ? parseInt(saved, 10) : 100;
  });
  const [activeTheme, setActiveTheme] = useState(() => {
    const saved = localStorage.getItem(`bookbuddy_reader_theme_${userId}`);
    return saved || "light";
  });

  // 1. Fetch metadata details of EResource
  const {
    data: resource,
    isLoading: loadingMeta,
    isError: errorMeta,
  } = useQuery({
    queryKey: ["e-resource-detail", resourceId],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/dashboards/student/eresources/${resourceId}`,
      );
      return data.data;
    },
    retry: 1,
  });

  // Determine file type and URL
  const isGutenberg = resource?.source === "gutenberg";
  const isPdf =
    resource?.fileType === "pdf" ||
    resource?.type === "pdf" ||
    resource?.fileUrl?.toLowerCase().endsWith(".pdf");
  const fileUrl = isGutenberg
    ? getContentUrl(resourceId, "epub")
    : resource?.fileUrl;

  // 2. Load EPUB (only if not PDF)
  const {
    rendition,
    toc,
    isLoading: loadingEpub,
    error: loaderError,
  } = useEpubLoader(isPdf ? null : fileUrl, viewerRef);

  // 3. Reader position tracking (handles both EPUB CFI & PDF Page)
  const pdfState = isPdf ? { page: pdfPage, totalPages: pdfTotalPages } : null;
  const { percentComplete, initialPosition } = useReaderPosition(
    resourceId,
    userId,
    rendition,
    pdfState,
  );

  // Set initial PDF page when position restores or from offline cache
  useEffect(() => {
    const offlinePosKey = `bookbuddy_offline_pos_${userId}_${resourceId}`;
    if (isPdf) {
      const restored =
        initialPosition?.page ||
        parseInt(localStorage.getItem(offlinePosKey), 10);
      if (restored && restored > 0) {
        queueMicrotask(() => {
          setPdfPage((prev) => (prev !== restored ? restored : prev));
        });
      }
    }
  }, [isPdf, initialPosition, resourceId, userId]);

  // Persist current page locally for offline backup
  useEffect(() => {
    if (isPdf && pdfPage > 0) {
      localStorage.setItem(
        `bookbuddy_offline_pos_${userId}_${resourceId}`,
        pdfPage.toString(),
      );
    }
  }, [isPdf, pdfPage, resourceId, userId]);

  // Load PDF Document & Extract Outline Table of Contents
  useEffect(() => {
    if (!isPdf || !fileUrl) return;

    let isCancelled = false;

    const pdfUrlString = typeof fileUrl === "string" ? fileUrl : (fileUrl?.url || fileUrl?.fileUrl || "");
    const loadingTask = pdfjsLib.getDocument({ url: pdfUrlString });
    loadingTask.promise
      .then(async (doc) => {
        if (isCancelled) return;
        setPdfDoc(doc);
        setPdfTotalPages(doc.numPages);
        setPdfLoading(false);

        // Fetch PDF Outline/TOC
        try {
          const outline = await doc.getOutline();
          if (Array.isArray(outline) && outline.length > 0) {
            const parsedOutline = [];
            for (const item of outline) {
              let pageNum = 1;
              if (item.dest) {
                try {
                  const destRef =
                    typeof item.dest === "string"
                      ? await doc.getDestination(item.dest)
                      : item.dest;
                  if (destRef && destRef[0]) {
                    const pageIdx = await doc.getPageIndex(destRef[0]);
                    pageNum = pageIdx + 1;
                  }
                } catch {
                  // Fallback if dest resolution fails
                }
              }
              parsedOutline.push({ title: item.title, destPage: pageNum });
            }
            setPdfOutline(parsedOutline);
          }
        } catch (err) {
          console.warn("PDF outline parsing skipped:", err);
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        setPdfError(err.message || "Failed to load PDF document.");
        setPdfLoading(false);
      });

    return () => {
      isCancelled = true;
      loadingTask.destroy?.();
    };
  }, [isPdf, fileUrl]);

  // Render PDF Page onto Canvas
  const renderPdfPage = useCallback(async () => {
    if (!pdfDoc || !pdfCanvasRef.current) return;
    try {
      const page = await pdfDoc.getPage(pdfPage);
      const canvas = pdfCanvasRef.current;
      const context = canvas.getContext("2d");
      const viewport = page.getViewport({ scale: (fontSize / 100) * 1.2 });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      await page.render(renderContext).promise;
    } catch (err) {
      console.error("PDF page render error:", err);
    }
  }, [pdfDoc, pdfPage, fontSize]);

  useEffect(() => {
    if (isPdf && pdfDoc) {
      renderPdfPage();
    }
  }, [isPdf, pdfDoc, pdfPage, renderPdfPage]);

  // EPUB Text Selection Handler for Highlights
  useEffect(() => {
    if (!rendition) return;

    const handleSelected = (cfiRange) => {
      const text = rendition.getRange(cfiRange).toString().trim();
      if (text) {
        setSelectedText(text);
        setAnnotationModalOpen(true);
      }
    };

    rendition.on("selected", handleSelected);
    return () => {
      rendition.off("selected", handleSelected);
    };
  }, [rendition]);

  // PDF Text Selection Listener
  const handlePdfMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      setSelectedText(selection.toString().trim());
      setAnnotationModalOpen(true);
    }
  };

  // Persist Annotation & Highlight to Backend
  const handleSaveAnnotation = async () => {
    if (!selectedText) return;
    setIsSavingAnnotation(true);
    try {
      await apiClient.post("/dashboards/student/bookmarks", {
        resourceId,
        bookTitle: resource?.title || "E-Resource",
        page: isPdf ? pdfPage : 1,
        highlightText: selectedText,
        noteText,
        color: highlightColor,
        tags: [annotationTag],
      });
      setAnnotationSuccess(true);
      setTimeout(() => {
        setAnnotationSuccess(false);
        setAnnotationModalOpen(false);
        setSelectedText("");
        setNoteText("");
      }, 1200);
    } catch (err) {
      console.error("Failed to persist annotation:", err);
    } finally {
      setIsSavingAnnotation(false);
    }
  };

  // Apply style options to EPUB rendition
  useEffect(() => {
    if (!rendition) return;

    const themes = {
      light: {
        body: {
          background: "#fdfcf8 !important",
          color: "#0f172a !important",
          "font-family": "Georgia, serif !important",
          "line-height": "1.65 !important",
        },
      },
      sepia: {
        body: {
          background: "#f4ecd8 !important",
          color: "#433422 !important",
          "font-family": "Georgia, serif !important",
          "line-height": "1.65 !important",
        },
      },
      dark: {
        body: {
          background: "#0f172a !important",
          color: "#f8fafc !important",
          "font-family": "Georgia, serif !important",
          "line-height": "1.65 !important",
        },
      },
    };

    Object.keys(themes).forEach((name) => {
      rendition.themes.register(name, themes[name]);
    });

    rendition.themes.select(activeTheme);
    rendition.themes.fontSize(`${fontSize}%`);
  }, [rendition, activeTheme, fontSize]);

  const handleThemeChange = (theme) => {
    setActiveTheme(theme);
    localStorage.setItem(`bookbuddy_reader_theme_${userId}`, theme);
  };

  const handleFontSizeChange = (size) => {
    setFontSize(size);
    localStorage.setItem(`bookbuddy_reader_fontsize_${userId}`, size);
  };

  const handlePrev = () => {
    if (isPdf) {
      setPdfPage((prev) => Math.max(1, prev - 1));
    } else {
      rendition?.prev();
    }
  };

  const handleNext = () => {
    if (isPdf) {
      setPdfPage((prev) => Math.min(pdfTotalPages, prev + 1));
    } else {
      rendition?.next();
    }
  };

  const handleExit = () => {
    navigate(-1);
  };

  const isError = errorMeta || loaderError || pdfError;
  const isLoading = loadingMeta || (isPdf ? pdfLoading : loadingEpub);

  const getThemeBgClass = () => {
    switch (activeTheme) {
      case "sepia":
        return "bg-[#f4ecd8] text-[#433422]";
      case "dark":
        return "bg-[#0f172a] text-slate-100";
      default:
        return "bg-[#fdfcf8] text-slate-900";
    }
  };

  return (
    <div
      ref={readerContainerRef}
      onMouseUp={isPdf ? handlePdfMouseUp : undefined}
      className={`fixed inset-0 z-50 flex flex-col h-screen w-screen overflow-hidden select-none outline-none ${getThemeBgClass()}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Ebook Reader: ${resource?.title || "Loading book"}`}
    >
      {isLoading && (
        <div className="absolute inset-0 flex flex-col justify-center items-center z-50 bg-inherit transition-all duration-300">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={44} />
          <h2 className="font-serif font-bold text-lg sm:text-xl text-center">
            {resource?.title
              ? `Opening "${resource.title}"...`
              : "Opening document..."}
          </h2>
          <p className="text-xs text-slate-400 mt-2 tracking-wide">
            {isPdf ? "Rendering PDF document..." : "Parsing EPUB content..."}
          </p>
        </div>
      )}

      {isError && (
        <div className="absolute inset-0 flex flex-col justify-center items-center z-50 bg-slate-900 text-white p-6 text-center">
          <div className="p-3 bg-red-500/10 rounded-full text-red-500 mb-4">
            <AlertTriangle size={40} />
          </div>
          <h2 className="text-xl font-bold font-serif">
            Failed to load document
          </h2>
          <p className="text-sm text-slate-400 max-w-sm mt-2 leading-relaxed">
            {isError || "The e-resource document could not be rendered."}
          </p>
          <button
            onClick={handleExit}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all text-xs"
          >
            <ArrowLeft size={16} />
            Return to Dashboard
          </button>
        </div>
      )}

      {!isLoading && !isError && (
        <ReaderToolbar
          title={resource?.title}
          author={resource?.author}
          percentComplete={percentComplete}
          onToggleToc={() => {
            setTocOpen(!tocOpen);
            setSettingsOpen(false);
          }}
          onToggleSettings={() => {
            setSettingsOpen(!settingsOpen);
            setTocOpen(false);
          }}
          onPrevPage={handlePrev}
          onNextPage={handleNext}
          onClose={handleExit}
          settingsOpen={settingsOpen}
          tocOpen={tocOpen}
        />
      )}

      <div className="flex-1 relative flex overflow-hidden w-full pt-16">
        {/* Table of Contents Sidebar */}
        {tocOpen && (
          <div className="absolute left-0 top-0 bottom-0 z-30 h-full shrink-0">
            <TableOfContents
              toc={toc}
              pdfOutline={pdfOutline}
              isPdf={isPdf}
              onJumpToLocation={(loc) => rendition?.display(loc)}
              onJumpToPdfPage={(page) => setPdfPage(page)}
              onClose={() => setTocOpen(false)}
            />
          </div>
        )}

        <div className="flex-1 h-full flex justify-center items-center relative z-10 overflow-auto">
          {settingsOpen && (
            <div className="absolute right-4 top-4 z-40 animate-in fade-in zoom-in-95 duration-200">
              <ReaderThemeControls
                fontSize={fontSize}
                onChangeFontSize={handleFontSizeChange}
                activeTheme={activeTheme}
                onChangeTheme={handleThemeChange}
              />
            </div>
          )}

          <button
            onClick={handlePrev}
            className="absolute left-0 top-16 bottom-16 w-12 sm:w-20 z-20 flex items-center justify-start pl-3 opacity-0 hover:opacity-10 hover:bg-black/5 text-slate-800 transition-all cursor-west-resize"
            aria-label="Previous page"
          >
            <ChevronLeft size={36} />
          </button>

          {isPdf ? (
            <div className="flex flex-col items-center justify-center h-full p-4 overflow-auto">
              <canvas
                ref={pdfCanvasRef}
                className="shadow-2xl rounded-lg max-h-[85vh] object-contain"
              />
              <div className="mt-2 text-xs font-mono font-bold text-slate-500 bg-white/80 dark:bg-slate-800/80 px-3 py-1 rounded-full shadow-sm">
                Page {pdfPage} of {pdfTotalPages}
              </div>
            </div>
          ) : (
            <div
              ref={viewerRef}
              className="w-full max-w-3xl h-full p-4 sm:p-12 overflow-hidden shadow-inner bg-transparent"
            />
          )}

          <button
            onClick={handleNext}
            className="absolute right-0 top-16 bottom-16 w-12 sm:w-20 z-20 flex items-center justify-end pr-3 opacity-0 hover:opacity-10 hover:bg-black/5 text-slate-800 transition-all cursor-east-resize"
            aria-label="Next page"
          >
            <ChevronRight size={36} />
          </button>
        </div>
      </div>

      {/* Annotation & Text Highlight Attachment Dialog */}
      {annotationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Highlighter size={18} className="text-amber-500" />
                Add Highlight & Personal Note
              </h3>
              <button
                onClick={() => setAnnotationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-400 text-xs text-amber-900 dark:text-amber-200 italic font-serif rounded-r-lg max-h-24 overflow-y-auto">
              "{selectedText}"
            </div>

            {/* Color Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Highlight Color
              </label>
              <div className="flex gap-3">
                {["yellow", "green", "blue", "pink"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setHighlightColor(c)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                      c === "yellow"
                        ? "bg-yellow-300"
                        : c === "green"
                          ? "bg-emerald-300"
                          : c === "blue"
                            ? "bg-sky-300"
                            : "bg-pink-300"
                    } ${highlightColor === c ? "scale-125 ring-2 ring-indigo-600" : "opacity-70"}`}
                  >
                    {highlightColor === c && (
                      <Check size={14} className="text-slate-800" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Note text input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Study Note
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Attach your study notes or thoughts..."
                className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                rows={3}
              />
            </div>

            {/* Tag selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tag Classification
              </label>
              <select
                value={annotationTag}
                onChange={(e) => setAnnotationTag(e.target.value)}
                className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="exam-prep">#exam-prep</option>
                <option value="important">#important</option>
                <option value="quote">#quote</option>
                <option value="research">#research</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setAnnotationModalOpen(false)}
                className="flex-1 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAnnotation}
                disabled={isSavingAnnotation}
                className="flex-1 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center gap-1.5 shadow"
              >
                {isSavingAnnotation ? (
                  <span>Saving...</span>
                ) : annotationSuccess ? (
                  <span>Saved to Bookmarks ✓</span>
                ) : (
                  <>
                    <Bookmark size={14} />
                    <span>Save Note</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EbookReader;
