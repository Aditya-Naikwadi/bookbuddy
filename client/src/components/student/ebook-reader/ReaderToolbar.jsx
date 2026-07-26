import { useState, useEffect, useRef, useCallback } from "react";
import { Menu, Settings, X, ArrowRight, ChevronLeft } from "lucide-react";

export const ReaderToolbar = ({
  title,
  author,
  percentComplete,
  onToggleToc,
  onToggleSettings,
  onPrevPage,
  onNextPage,
  onClose,
  settingsOpen = false,
  tocOpen = false,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const hideTimeoutRef = useRef(null);
  const containerRef = useRef(null);

  // Manage visibility timeout
  const resetHideTimeout = useCallback(() => {
    setIsVisible(true);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Do not auto-hide if settings panel or TOC panel is open, or if any control inside has focus
    const hasFocus = containerRef.current?.contains(document.activeElement);
    if (settingsOpen || tocOpen || hasFocus) return;

    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 3000);
  }, [settingsOpen, tocOpen]);

  // Visibility triggers: mouse move, screen taps, active focus changes
  useEffect(() => {
    const handleActivity = () => {
      resetHideTimeout();
    };

    const handleFocusIn = () => {
      setIsVisible(true);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    document.addEventListener("focusin", handleFocusIn);

    // Schedule auto-hide timer after mount
    if (
      !settingsOpen &&
      !tocOpen &&
      !containerRef.current?.contains(document.activeElement)
    ) {
      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    }

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      document.removeEventListener("focusin", handleFocusIn);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [settingsOpen, tocOpen, resetHideTimeout]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-x-0 top-0 z-40 bg-white/95 border-b border-slate-200 shadow-md backdrop-blur-md transition-all duration-300 transform flex flex-col sm:flex-row items-center justify-between px-6 py-3.5 gap-3 sm:gap-6 ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "-translate-y-full opacity-0 pointer-events-none"
      }`}
      onMouseEnter={() => {
        setIsVisible(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      }}
      onMouseLeave={resetHideTimeout}
    >
      {/* Left: Close/Exit & Book Title */}
      <div className="flex items-center gap-4 w-full sm:w-auto min-w-0">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-indigo-600 focus:outline-none flex items-center gap-1 font-bold text-xs shrink-0"
          aria-label="Exit ebook reader and return to dashboard"
        >
          <X size={18} />
          <span>Exit</span>
        </button>

        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-serif font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs leading-tight">
            {title || "Loading Ebook..."}
          </h1>
          <p className="text-[10px] sm:text-xs text-slate-500 truncate max-w-[150px] sm:max-w-[200px]">
            {author || "Unknown Author"}
          </p>
        </div>
      </div>

      {/* Middle: Page navigation controls */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onPrevPage}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-indigo-600 focus:outline-none"
          aria-label="Previous page"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Page progress screen reader tag */}
        <div
          className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-full flex items-center gap-1.5"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>Progress:</span>
          <span className="text-indigo-600 font-extrabold">
            {percentComplete}%
          </span>
        </div>

        <button
          onClick={onNextPage}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-indigo-600 focus:outline-none"
          aria-label="Next page"
        >
          <ArrowRight size={20} />
        </button>
      </div>

      {/* Right: Sidebar Toggles (TOC & Settings) */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
        {/* TOC toggle */}
        <button
          onClick={onToggleToc}
          className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all focus:ring-2 focus:ring-indigo-600 focus:outline-none ${
            tocOpen
              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
              : "border-slate-200 hover:bg-slate-50 text-slate-600"
          }`}
          aria-label="Toggle Table of Contents sidebar"
          aria-expanded={tocOpen}
        >
          <Menu size={16} />
          <span>Chapters</span>
        </button>

        {/* Settings toggle */}
        <button
          onClick={onToggleSettings}
          className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all focus:ring-2 focus:ring-indigo-600 focus:outline-none ${
            settingsOpen
              ? "bg-indigo-50 border-indigo-200 text-indigo-700"
              : "border-slate-200 hover:bg-slate-50 text-slate-600"
          }`}
          aria-label="Toggle text typography and contrast settings"
          aria-expanded={settingsOpen}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};

export default ReaderToolbar;
