import React from 'react';

const StatSummaryStrip = ({ items = [] }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="flex items-center gap-3 overflow-x-auto py-1.5 px-3 bg-slate-50/80 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-700 flex-shrink-0">
      {items.map((item, idx) => {
        const Icon = item.icon;
        const colorClass = item.colorClass || 'text-slate-600';
        const bgBadgeClass = item.bgBadgeClass || 'bg-slate-100 text-slate-800';

        return (
          <div key={idx} className="flex items-center gap-1.5 whitespace-nowrap">
            {Icon && <Icon className={`w-3.5 h-3.5 ${colorClass}`} />}
            <span className="text-slate-500 font-medium">{item.label}:</span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${bgBadgeClass}`}>
              {item.value}
            </span>
            {idx < items.length - 1 && <span className="text-slate-300 ml-1.5">•</span>}
          </div>
        );
      })}
    </div>
  );
};

export default StatSummaryStrip;
