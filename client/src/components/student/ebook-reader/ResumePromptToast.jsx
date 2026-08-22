import { BookOpen, ArrowRight, X } from "lucide-react";

/**
 * Non-blocking Resume-Prompt Toast UI (F1.7)
 * Displays when local and server reading positions disagree on open.
 */
export const ResumePromptToast = ({ discrepancy, onJump, onStay }) => {
  if (!discrepancy || !discrepancy.server) return null;

  const serverPos = discrepancy.server.position;
  const pageLabel =
    serverPos?.page !== undefined
      ? `page ${serverPos.page}`
      : serverPos?.cfi
        ? "saved position"
        : `${discrepancy.server.percentageComplete || 0}%`;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex max-w-md items-center justify-between gap-4 rounded-xl border border-indigo-500/20 bg-gray-900/95 p-4 text-white shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-400">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-100">
            Resume Reading Discrepancy
          </h4>
          <p className="text-xs text-gray-300">
            Continue from{" "}
            <span className="font-medium text-indigo-300">{pageLabel}</span>?
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onJump(discrepancy.server)}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 active:scale-95 transition-all"
        >
          <span>Jump</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onStay}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-all"
        >
          Stay
        </button>
        <button
          type="button"
          onClick={onStay}
          aria-label="Dismiss toast"
          className="ml-1 rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ResumePromptToast;
