import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, AlertCircle, ExternalLink, Loader2, BookOpen } from 'lucide-react';

/**
 * Dynamically import PDF viewer module to code-split pdfjs bundle
 */
const PdfViewerEngine = lazy(async () => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    typeof window !== 'undefined'
      ? `${window.location.origin}/pdf.worker.min.mjs`
      : '/pdf.worker.min.mjs';

  return {
    default: function PdfEngine({ fileUrl, page, scale, onTotalPages, onError }) {
      const canvasRef = useRef(null);

      useEffect(() => {
        let isMounted = true;
        let pdfDocInstance = null;

        const loadPdf = async () => {
          try {
            const loadingTask = pdfjsLib.getDocument(fileUrl);
            pdfDocInstance = await loadingTask.promise;
            if (isMounted) {
              onTotalPages(pdfDocInstance.numPages);
              const pageObj = await pdfDocInstance.getPage(page);
              const viewport = pageObj.getViewport({ scale });
              const canvas = canvasRef.current;
              if (canvas) {
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await pageObj.render({ canvasContext: context, viewport }).promise;
              }
            }
          } catch (err) {
            if (isMounted) onError(err.message || 'Failed to load PDF document');
          }
        };

        loadPdf();

        return () => {
          isMounted = false;
        };
      }, [fileUrl, page, scale]);

      return (
        <div className="flex justify-center items-center overflow-auto p-4 max-h-full">
          <canvas ref={canvasRef} className="shadow-2xl rounded-lg max-w-full" />
        </div>
      );
    },
  };
});

/**
 * Dynamically import EPUB viewer engine
 */
const EpubViewerEngine = lazy(async () => {
  const ePub = (await import('epubjs')).default;

  return {
    default: function EpubEngine({ fileUrl, page, onLocationChange, onError }) {
      const containerRef = useRef(null);
      const renditionRef = useRef(null);

      useEffect(() => {
        let isMounted = true;
        if (!containerRef.current) return;

        try {
          const book = ePub(fileUrl);
          const rendition = book.renderTo(containerRef.current, {
            width: '100%',
            height: '100%',
            spread: 'always',
          });
          renditionRef.current = rendition;

          rendition.display().catch((err) => {
            if (isMounted) onError(err?.message || 'Error rendering EPUB file');
          });

          rendition.on('relocated', (location) => {
            if (isMounted && location?.start?.percentage) {
              onLocationChange(Math.round(location.start.percentage * 100));
            }
          });
        } catch (err) {
          if (isMounted) onError(err?.message || 'Failed to parse EPUB archive');
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
      }, [fileUrl]);

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

const DigitalReaderModal = ({ isOpen, onClose, fileUrl, fileType = 'pdf', title = 'Digital E-Book' }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [error, setError] = useState(null);
  const modalRef = useRef(null);

  // Close on Escape key press & handle Focus Trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentPage, totalPages]);

  // Reset state on URL change
  useEffect(() => {
    setCurrentPage(1);
    setError(null);
    setScale(1.0);
  }, [fileUrl]);

  if (!isOpen || !fileUrl) return null;

  const normalizedType = fileType?.toLowerCase().includes('epub') ? 'epub' : 'pdf';

  const handleNext = () => {
    if (currentPage < totalPages || normalizedType === 'epub') {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="digital-reader-title"
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        ref={modalRef}
        className="bg-slate-900 rounded-3xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden border border-slate-800 shadow-2xl relative"
      >
        {/* Reader Header Bar */}
        <header className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl flex-shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <h2 id="digital-reader-title" className="text-xs sm:text-sm font-bold truncate">
              {title}
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-indigo-400 uppercase flex-shrink-0 hidden sm:inline-block">
              {normalizedType.toUpperCase()}
            </span>
          </div>

          {/* Navigation Controls */}
          {!error && (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1 px-2 text-xs">
              <button
                onClick={handlePrev}
                disabled={currentPage <= 1}
                aria-label="Previous Page"
                className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-semibold text-slate-300 px-1">
                {normalizedType === 'pdf' ? `${currentPage} / ${totalPages}` : `Page ${currentPage}`}
              </span>
              <button
                onClick={handleNext}
                disabled={normalizedType === 'pdf' && currentPage >= totalPages}
                aria-label="Next Page"
                className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {normalizedType === 'pdf' && (
                <>
                  <div className="w-px h-3 bg-slate-800 mx-1" />
                  <button
                    onClick={() => setScale((s) => Math.max(0.75, s - 0.15))}
                    title="Zoom Out"
                    className="p-1 text-slate-300 hover:text-white"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-slate-400 font-mono">{Math.round(scale * 100)}%</span>
                  <button
                    onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
                    title="Zoom In"
                    className="p-1 text-slate-300 hover:text-white"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Close Reader Modal"
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Reader Canvas Area */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-950 p-2 sm:p-4 relative">
          {error ? (
            <div className="bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-800 max-w-md text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Unable to Display In-App Digital Reader</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {error || 'The digital file URL could not be rendered inside the embedded reader canvas.'}
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <a
                  href={fileUrl}
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
              {normalizedType === 'pdf' ? (
                <PdfViewerEngine
                  fileUrl={fileUrl}
                  page={currentPage}
                  scale={scale}
                  onTotalPages={(total) => setTotalPages(total)}
                  onError={(msg) => setError(msg)}
                />
              ) : (
                <EpubViewerEngine
                  fileUrl={fileUrl}
                  page={currentPage}
                  onLocationChange={(pct) => setTotalPages(100)}
                  onError={(msg) => setError(msg)}
                />
              )}
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
};

export default DigitalReaderModal;
