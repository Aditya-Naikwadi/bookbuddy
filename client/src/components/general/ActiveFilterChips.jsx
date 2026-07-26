import React from "react";
import { X, RotateCcw } from "lucide-react";

const ActiveFilterChips = ({ chips = [], onRemoveChip, onResetAll }) => {
  const activeChips = chips.filter((c) => c.value && c.value !== "All");

  if (activeChips.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1 flex-shrink-0">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
        Active:
      </span>

      {activeChips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-semibold text-[11px] animate-in fade-in zoom-in-95 duration-150"
        >
          <span>
            {chip.label}: <strong className="font-bold">{chip.value}</strong>
          </span>
          <button
            onClick={() => onRemoveChip(chip.key)}
            className="hover:bg-indigo-200/80 p-0.5 rounded-full text-indigo-600 transition-colors"
            title={`Remove ${chip.label} filter`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {onResetAll && (
        <button
          onClick={onResetAll}
          className="text-[11px] text-slate-500 hover:text-indigo-600 font-semibold ml-1 flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Clear All</span>
        </button>
      )}
    </div>
  );
};

export default ActiveFilterChips;
