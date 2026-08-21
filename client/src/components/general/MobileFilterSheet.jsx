import { useEffect, useRef } from "react";
import { X, RotateCcw, SlidersHorizontal } from "lucide-react";

const MobileFilterSheet = ({
  isOpen,
  onClose,
  title = "Faceted Filters",
  onResetAll,
  children,
}) => {
  const sheetRef = useRef(null);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex justify-end md:justify-center animate-in fade-in duration-200">
      {/* Backdrop click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Sheet Content Panel */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm bg-slate-900 h-full md:h-auto md:max-h-[85vh] md:rounded-3xl shadow-2xl border-l md:border border-slate-800 flex flex-col z-10 animate-in slide-in-from-right md:slide-in-from-bottom duration-300 overflow-hidden text-slate-100"
      >
        {/* Sheet Header */}
        <div className="flex items-center justify-between p-4 px-5 border-b border-slate-800 flex-shrink-0 bg-slate-950/60">
          <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
            <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
            <span>{title}</span>
          </div>

          <div className="flex items-center gap-2">
            {onResetAll && (
              <button
                onClick={onResetAll}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              aria-label="Close filters panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Sheet Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
          {children}
        </div>

        {/* Sheet Footer */}
        <div className="p-4 border-t border-slate-800 flex-shrink-0 bg-slate-900">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/20"
          >
            Apply & View Results
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileFilterSheet;
