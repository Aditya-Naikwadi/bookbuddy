import React from 'react';
import { Filter, AlertCircle } from 'lucide-react';

export default function ErrorOnlyFilterToggle({
  showErrorsOnly,
  onToggle,
  errorCount,
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
        showErrorsOnly
          ? 'bg-rose-600 text-white border-rose-700 shadow-sm shadow-rose-200'
          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
      }`}
    >
      <Filter size={14} />
      <span>{showErrorsOnly ? 'Showing Errors Only' : 'Filter Errors Only'}</span>
      {errorCount > 0 && (
        <span
          className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
            showErrorsOnly ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {errorCount}
        </span>
      )}
    </button>
  );
}
