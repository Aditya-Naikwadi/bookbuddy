import {
  useState,
  useEffect,
  useRef,
  lazy,
  Suspense,
  useCallback,
} from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  ExternalLink,
  Loader2,
  BookOpen,
  Bookmark,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import HighlightToolbar from "./HighlightToolbar";
import AnnotationSidebar from "./AnnotationSidebar";
import {
  getBookAnnotations,
  createAnnotationApi,
  updateAnnotationApi,
  deleteAnnotationApi,
} from "../../services/annotationService";
import {
  queueOfflineAnnotation,
  flushOfflineQueue,
} from "../../utils/annotationOfflineStore";

const DEFAULT_FALLBACK_PDF =
  "https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf";

const COLOR_HEX_MAP = {
  yellow: "#fef08a",
  green: "#bbf7d0",
  blue: "#bae6fd",
  pink: "#fbcfe8",
  purple: "#e9d5ff",
};

const extractUrl = (fileUrl, resource, book) => {
  if (typeof fileUrl === "string" && fileUrl.trim()) return fileUrl.trim();
  if (fileUrl?.url) return fileUrl.url;
  if (fileUrl?.fileUrl) return fileUrl.fileUrl;
  if (fileUrl?.pdfUrl) return fileUrl.pdfUrl;

  const target = resource || book || {};
  const possible = [
    target.fileUrl,
    target.pdfUrl,
    target.digitalUrl,
    target.ebookUrl,
    target.downloadUrl,
    target.url,
    target.readUrl,
    target.link,
    target.eresourceUrl,
    target.gutenbergUrl,
    target.openLibraryUrl,
    target.digitalFile?.url,
    target.file?.url,
  ];

  for (const url of possible) {
    if (typeof url === "string" && url.trim()) return url.trim();
  }
  return null;
};

/**
 * Dynamically import PDF viewer module with normalized overlay & selection capture
 */
const PdfViewerEngine = lazy(async () => {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    pdfWorkerUrl ||
    new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  return {
    default: function PdfEngine({
      fileUrl,
      page,
      scale,
      annotations = [],
      onTotalPages,
      onError,
      onTextSelect,
      onHighlightClick,
    }) {
      const canvasRef = useRef(null);
      const containerRef = useRef(null);
      const [viewportDims, setViewportDims] = useState({ width: 0, height: 0 });

      useEffect(() => {
        let isMounted = true;
        let pdfDocInstance = null;

        const loadPdf = async () => {
          try {
            const pdfUrlString = fileUrl || DEFAULT_FALLBACK_PDF;
            if (!pdfUrlString) {
              throw new Error(
                "No digital document URL provided for in-app viewing.",
              );
            }

            const loadingTask = pdfjsLib.getDocument({ url: pdfUrlString });
            pdfDocInstance = await loadingTask.promise;
            if (isMounted) {
              onTotalPages(pdfDocInstance.numPages);
              const pageObj = await pdfDocInstance.getPage(page);

              const dpr =
                typeof window !== "undefined"
                  ? window.devicePixelRatio || 1
                  : 1;
              const viewport = pageObj.getViewport({ scale: scale * dpr });
              const canvas = canvasRef.current;
              if (canvas) {
                const context = canvas.getContext("2d");
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                const cssWidth = viewport.width / dpr;
                const cssHeight = viewport.height / dpr;
                canvas.style.width = `${cssWidth}px`;
                canvas.style.height = `${cssHeight}px`;

                setViewportDims({ width: cssWidth, height: cssHeight });

                await pageObj.render({ canvasContext: context, viewport })
                  .promise;
              }
            }
          } catch (err) {
            if (isMounted)
              onError(err.message || "Failed to load PDF document");
          }
        };

        loadPdf();
        return () => {
          isMounted = false;
        };
      }, [fileUrl, page, scale, onError, onTotalPages]);

      // Capture text layer selection on mouseup
      const handleMouseUp = (_e) => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

        const selectedText = sel.toString().trim();
        const container = containerRef.current;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const range = sel.getRangeAt(0);
        const rangeRect = range.getBoundingClientRect();

        // Calculate normalized (0-1) coordinates
        const normRect = {
          x: (rangeRect.left - containerRect.left) / containerRect.width,
          y: (rangeRect.top - containerRect.top) / containerRect.height,
          width: rangeRect.width / containerRect.width,
          height: rangeRect.height / containerRect.height,
        };

        onTextSelect({
          selectedText,
          page,
          rects: [normRect],
          position: {
            top: rangeRect.top,
            left: rangeRect.left + rangeRect.width / 2,
          },
        });
      };

      const pageHighlights = annotations.filter(
        (a) =>
          (a.type === "highlight" || a.type === "note") &&
          Number(a.page) === Number(page),
      );

      return (
        <div
          ref={containerRef}
          onMouseUp={handleMouseUp}
          className="relative flex justify-center items-center overflow-auto p-4 max-h-full select-text"
        >
          <canvas
            ref={canvasRef}
            className="shadow-2xl rounded-lg max-w-full block"
          />

          {/* SVG Overlay for Highlights */}
          {viewportDims.width > 0 && (
            <svg
              className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-10"
              style={{
                width: `${viewportDims.width}px`,
                height: `${viewportDims.height}px`,
              }}
            >
              {pageHighlights.map((hl) => {
                const rectList = Array.isArray(hl.rects)
                  ? hl.rects
                  : hl.rects
                    ? [hl.rects]
                    : [];
                const hexColor =
                  COLOR_HEX_MAP[hl.color || "yellow"] || "#fef08a";

                return rectList.map((r, idx) => (
                  <rect
                    key={`${hl._id || hl.clientId}_${idx}`}
                    x={`${(r.x || 0) * viewportDims.width}`}
                    y={`${(r.y || 0) * viewportDims.height}`}
                    width={`${(r.width || 0.1) * viewportDims.width}`}
                    height={`${(r.height || 0.03) * viewportDims.height}`}
                    fill={hexColor}
                    fillOpacity={0.4}
                    className="cursor-pointer pointer-events-auto hover:fill-opacity-60 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onHighlightClick(hl, { top: e.clientY, left: e.clientX });
                    }}
                  >
                    <title>
                      {hl.noteText ? `Note: ${hl.noteText}` : hl.highlightText}
                    </title>
                  </rect>
                ));
              })}
            </svg>
          )}
        </div>
      );
    },
  };
});

/**
 * Dynamically import EPUB viewer engine with native annotations
 */
const EpubViewerEngine = lazy(async () => {
  const ePub = (await import("epubjs")).default;

  return {
    default: function EpubEngine({
      fileUrl,
      page,
      annotations = [],
      onLocationChange,
      onError,
      onTextSelect,
      onHighlightClick,
    }) {
      const containerRef = useRef(null);
      const renditionRef = useRef(null);

      useEffect(() => {
        let isMounted = true;
        if (!containerRef.current) return;

        try {
          const resolvedUrl = extractUrl(fileUrl, null, null);
          const book = ePub(resolvedUrl);
          const rendition = book.renderTo(containerRef.current, {
            width: "100%",
            height: "100%",
            spread: "always",
          });
          renditionRef.current = rendition;

          rendition.display().catch((err) => {
            if (isMounted) onError(err?.message || "Error rendering EPUB file");
          });

          rendition.on("relocated", (location) => {
            if (isMounted && location?.start?.percentage) {
              onLocationChange(Math.round(location.start.percentage * 100));
            }
          });

          // Text selection capture in EPUB iframe
          rendition.on("selected", (cfiRange, contents) => {
            const selectedText = rendition.getRange(cfiRange).toString().trim();
            if (!selectedText) return;

            const selection = contents.window.getSelection();
            if (!selection.rangeCount) return;

            const rect = selection.getRangeAt(0).getBoundingClientRect();
            const iframeRect = containerRef.current.getBoundingClientRect();

            onTextSelect({
              selectedText,
              cfiRange,
              position: {
                top: iframeRect.top + rect.top,
                left: iframeRect.left + rect.left + rect.width / 2,
              },
            });
          });
        } catch (err) {
          if (isMounted)
            onError(err?.message || "Failed to parse EPUB archive");
        }

        return () => {
          isMounted = false;
          if (renditionRef.current) {
            try {
              renditionRef.current.destroy();
            } catch {
              // Cleanup
            }
          }
        };
      }, [fileUrl, onError, onLocationChange, onTextSelect]);

      // Re-render annotations in EPUB rendition
      useEffect(() => {
        const rendition = renditionRef.current;
        if (!rendition) return;

        annotations.forEach((hl) => {
          if (hl.type === "highlight" && hl.cfiRange) {
            try {
              const hexColor = COLOR_HEX_MAP[hl.color || "yellow"] || "#fef08a";
              rendition.annotations.add(
                "highlight",
                hl.cfiRange,
                {},
                (e) => {
                  onHighlightClick(hl, { top: e.clientY, left: e.clientX });
                },
                "epub-highlight",
                { fill: hexColor, "fill-opacity": "0.4" },
              );
            } catch {
              // Ignore duplicate annotation error
            }
          }
        });
      }, [annotations, onHighlightClick]);

      useEffect(() => {
        if (renditionRef.current && page) {
          try {
            renditionRef.current.display(page);
          } catch {
            // Ignored
          }
        }
      }, [page]);

      return <div ref={containerRef} className="w-full h-full min-h-[400px]" />;
    },
  };
});

const DigitalReaderModal = ({
  isOpen,
  onClose,
  fileUrl,
  fileType = "pdf",
  title = "Digital E-Book",
  resource = null,
  book = null,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [error, setError] = useState(null);

  // Annotations & UI State
  const [annotations, setAnnotations] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeToolbar, setActiveToolbar] = useState(null);
  const [showBookmarkPrompt, setShowBookmarkPrompt] = useState(false);
  const [bookmarkLabelInput, setBookmarkLabelInput] = useState("");

  const modalRef = useRef(null);
  const activeTarget = resource || book;
  const targetId = activeTarget?._id || activeTarget?.id;
  const resolvedTitle =
    title || activeTarget?.title || activeTarget?.name || "Digital E-Book";
  const resolvedFileType =
    fileType || activeTarget?.fileType || activeTarget?.format || "pdf";
  const resolvedUrl = extractUrl(fileUrl, resource, book);

  const isModalOpen =
    isOpen !== undefined ? isOpen : Boolean(fileUrl || resource || book);
  const normalizedType = resolvedFileType?.toLowerCase().includes("epub")
    ? "epub"
    : "pdf";

  // Load annotations on mount / open
  useEffect(() => {
    if (!isModalOpen || !targetId) return;
    let isMounted = true;

    const loadData = async () => {
      try {
        await flushOfflineQueue(targetId);
        const res = await getBookAnnotations(targetId);
        if (isMounted && res.success) {
          setAnnotations(res.data || []);
        }
      } catch (err) {
        console.warn("Could not load annotations:", err.message);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [isModalOpen, targetId]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages || normalizedType === "epub") {
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage, totalPages, normalizedType]);

  const handlePrev = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage]);

  // Keyboard navigation & Esc listener
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, handleNext, handlePrev, onClose]);

  // Reset state on target book/resource change
  const resetKey = `${targetId || resolvedTitle}_${resolvedUrl || "no-url"}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setCurrentPage(1);
    setError(
      resolvedUrl ? null : "No digital document URL provided for this title.",
    );
    setScale(1.0);
  }

  const prefersReducedMotion = useReducedMotion();

  // Create / Update Highlight
  const handleSelectColor = async (colorId, noteText) => {
    if (!targetId || !activeToolbar) return;

    const isEditing = activeToolbar.isEditing;
    const annotationId = activeToolbar.annotationId;

    try {
      if (isEditing && annotationId) {
        const res = await updateAnnotationApi(annotationId, {
          color: colorId,
          noteText,
        });
        if (res.success) {
          setAnnotations((prev) =>
            prev.map((a) =>
              a._id === annotationId || a.id === annotationId ? res.data : a,
            ),
          );
        }
      } else {
        const payload = {
          type: "highlight",
          page: normalizedType === "pdf" ? currentPage : undefined,
          cfiRange: activeToolbar.cfiRange,
          rects: activeToolbar.rects,
          highlightText: activeToolbar.selectedText,
          noteText,
          color: colorId,
        };

        try {
          const res = await createAnnotationApi(targetId, payload);
          if (res.success) {
            setAnnotations((prev) => [res.data, ...prev]);
          }
        } catch {
          // Offline fallback
          const queued = queueOfflineAnnotation(targetId, payload);
          setAnnotations((prev) => [queued, ...prev]);
        }
      }
    } catch (err) {
      console.error("Save annotation failed:", err);
    } finally {
      setActiveToolbar(null);
    }
  };

  // Save / Update Note only
  const handleSaveNote = async (noteText) => {
    if (!activeToolbar) return;
    handleSelectColor(activeToolbar.existingColor || "yellow", noteText);
  };

  // Create Bookmark
  const handleConfirmBookmark = async (e) => {
    e.preventDefault();
    if (!targetId) return;

    const label = bookmarkLabelInput.trim() || `Page ${currentPage}`;
    const payload = {
      type: "bookmark",
      page: currentPage,
      label,
    };

    try {
      const res = await createAnnotationApi(targetId, payload);
      if (res.success) {
        setAnnotations((prev) => [res.data, ...prev]);
      }
    } catch {
      const queued = queueOfflineAnnotation(targetId, payload);
      setAnnotations((prev) => [queued, ...prev]);
    } finally {
      setShowBookmarkPrompt(false);
      setBookmarkLabelInput("");
    }
  };

  // Delete Annotation
  const handleDeleteAnnotation = async (id) => {
    if (!id) return;
    try {
      await deleteAnnotationApi(id);
      setAnnotations((prev) =>
        prev.filter((a) => a._id !== id && a.id !== id && a.clientId !== id),
      );
    } catch (err) {
      console.error("Delete annotation error:", err);
    } finally {
      setActiveToolbar(null);
    }
  };

  // Jump to location from review panel
  const handleJumpToLocation = (item) => {
    if (item.page) {
      setCurrentPage(item.page);
    } else if (item.cfiRange) {
      setCurrentPage(item.cfiRange);
    }
  };

  return (
    <AnimatePresence>
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="digital-reader-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
        >
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            ref={modalRef}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.95, y: 15 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.95, y: 15 }
            }
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
            className="bg-slate-900 rounded-3xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden border border-slate-800 shadow-2xl relative z-10"
          >
            {/* Reader Header Bar */}
            <header className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3 text-white flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl flex-shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h2
                  id="digital-reader-title"
                  className="text-xs sm:text-sm font-bold truncate"
                >
                  {resolvedTitle}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-indigo-400 uppercase flex-shrink-0 hidden sm:inline-block">
                  {normalizedType.toUpperCase()}
                </span>
              </div>

              {/* Navigation & Controls */}
              {!error && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1 px-2 text-xs">
                    <button
                      onClick={handlePrev}
                      disabled={currentPage <= 1}
                      aria-label="Previous Page"
                      className="p-1 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-semibold text-slate-300 px-1">
                      {normalizedType === "pdf"
                        ? `${currentPage} / ${totalPages}`
                        : `Page ${currentPage}`}
                    </span>
                    <button
                      onClick={handleNext}
                      disabled={
                        normalizedType === "pdf" && currentPage >= totalPages
                      }
                      aria-label="Next Page"
                      className="p-1 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {normalizedType === "pdf" && (
                      <>
                        <div className="w-px h-3 bg-slate-800 mx-1" />
                        <button
                          onClick={() =>
                            setScale((s) => Math.max(0.75, s - 0.15))
                          }
                          title="Zoom Out"
                          className="p-1 text-slate-300 hover:text-white cursor-pointer"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {Math.round(scale * 100)}%
                        </span>
                        <button
                          onClick={() =>
                            setScale((s) => Math.min(2.0, s + 0.15))
                          }
                          title="Zoom In"
                          className="p-1 text-slate-300 hover:text-white cursor-pointer"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Bookmark Button */}
                  <button
                    onClick={() => setShowBookmarkPrompt(true)}
                    title="Bookmark Location"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Bookmark className="w-4 h-4 text-indigo-400" />
                    <span className="hidden md:inline">Bookmark</span>
                  </button>

                  {/* Annotations Sidebar Toggle */}
                  <button
                    onClick={() => setIsSidebarOpen((prev) => !prev)}
                    title="Toggle Annotations Panel"
                    className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold relative ${
                      isSidebarOpen
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                    }`}
                  >
                    {isSidebarOpen ? (
                      <PanelRightClose className="w-4 h-4" />
                    ) : (
                      <PanelRightOpen className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Notes</span>
                    {annotations.length > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 bg-indigo-400 text-slate-950 font-bold rounded-full text-[10px]">
                        {annotations.length}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={onClose}
                aria-label="Close Reader Modal"
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Reader Canvas + Review Panel Area */}
            <div className="flex-1 overflow-hidden flex bg-slate-950 relative">
              <div className="flex-1 overflow-auto flex items-center justify-center p-2 sm:p-4 relative">
                {error ? (
                  <div className="bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-800 max-w-md text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-white">
                      Unable to Display In-App Digital Reader
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {error ||
                        "The digital file URL could not be rendered inside the reader."}
                    </p>
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <a
                        href={resolvedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                      >
                        <span>Open in External Tab</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => setError(null)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors"
                      >
                        Retry Loading
                      </button>
                    </div>
                  </div>
                ) : (
                  <Suspense
                    fallback={
                      <div className="flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
                        <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
                        <span>Loading open-access document engine...</span>
                      </div>
                    }
                  >
                    {normalizedType === "pdf" ? (
                      <PdfViewerEngine
                        fileUrl={resolvedUrl}
                        page={currentPage}
                        scale={scale}
                        annotations={annotations}
                        onTotalPages={(total) => setTotalPages(total)}
                        onError={(msg) => setError(msg)}
                        onTextSelect={(data) =>
                          setActiveToolbar({
                            visible: true,
                            position: data.position,
                            selectedText: data.selectedText,
                            page: data.page,
                            rects: data.rects,
                            isEditing: false,
                          })
                        }
                        onHighlightClick={(hl, pos) =>
                          setActiveToolbar({
                            visible: true,
                            position: pos,
                            selectedText: hl.highlightText,
                            annotationId: hl._id || hl.id,
                            existingColor: hl.color,
                            existingNote: hl.noteText || "",
                            isEditing: true,
                          })
                        }
                      />
                    ) : (
                      <EpubViewerEngine
                        fileUrl={resolvedUrl}
                        page={currentPage}
                        annotations={annotations}
                        onLocationChange={() => setTotalPages(100)}
                        onError={(msg) => setError(msg)}
                        onTextSelect={(data) =>
                          setActiveToolbar({
                            visible: true,
                            position: data.position,
                            selectedText: data.selectedText,
                            cfiRange: data.cfiRange,
                            isEditing: false,
                          })
                        }
                        onHighlightClick={(hl, pos) =>
                          setActiveToolbar({
                            visible: true,
                            position: pos,
                            selectedText: hl.highlightText,
                            annotationId: hl._id || hl.id,
                            existingColor: hl.color,
                            existingNote: hl.noteText || "",
                            isEditing: true,
                          })
                        }
                      />
                    )}
                  </Suspense>
                )}
              </div>

              {/* Annotation Sidebar Panel */}
              <AnnotationSidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                annotations={annotations}
                bookId={targetId}
                fileType={normalizedType}
                onJumpToLocation={handleJumpToLocation}
                onDeleteAnnotation={handleDeleteAnnotation}
              />
            </div>
          </motion.div>

          {/* Floating Contextual Highlight Toolbar */}
          {activeToolbar && activeToolbar.visible && (
            <HighlightToolbar
              position={activeToolbar.position}
              selectedColor={activeToolbar.existingColor || "yellow"}
              existingNote={activeToolbar.existingNote || ""}
              isEditing={activeToolbar.isEditing}
              onSelectColor={handleSelectColor}
              onSaveNote={handleSaveNote}
              onDelete={() =>
                handleDeleteAnnotation(activeToolbar.annotationId)
              }
              onClose={() => setActiveToolbar(null)}
            />
          )}

          {/* Bookmark Label Prompt Modal */}
          {showBookmarkPrompt && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
              <form
                onSubmit={handleConfirmBookmark}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-sm space-y-4 shadow-2xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Bookmark className="w-4 h-4 text-indigo-400" />
                    <span>Add Bookmark</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBookmarkPrompt(false)}
                    className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300 font-medium">
                    Bookmark Label (Optional)
                  </label>
                  <input
                    type="text"
                    value={bookmarkLabelInput}
                    onChange={(e) => setBookmarkLabelInput(e.target.value)}
                    placeholder={`e.g. Chapter 3 or Page ${currentPage}`}
                    maxLength={250}
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBookmarkPrompt(false)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
                  >
                    Save Bookmark
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
};

export default DigitalReaderModal;
