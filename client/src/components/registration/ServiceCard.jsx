import * as Icons from 'lucide-react';

export default function ServiceCard({
  service,
  isSelected,
  onToggle,
  isDisabled = false,
}) {
  const IconComponent = Icons[service.icon] || Icons.CheckCircle2;

  return (
    <div
      onClick={() => !isDisabled && onToggle(service.key)}
      className={`group relative p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
        isSelected
          ? 'bg-indigo-50/70 border-indigo-500 shadow-sm shadow-indigo-100'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
      } ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
            }`}
          >
            <IconComponent size={20} />
          </div>

          <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              disabled={isDisabled}
              aria-label={`Select ${service.name}`}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-semibold text-slate-900 text-sm group-hover:text-indigo-950">
            {service.name}
          </h4>
          {service.isCore && (
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded uppercase">
              Core
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
          {service.description}
        </p>
      </div>

      {service.dependencies && service.dependencies.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-200/60 text-[11px] text-slate-400 flex items-center gap-1">
          <Icons.Info size={12} className="text-slate-400" />
          <span>Requires: {service.dependencies.join(', ')}</span>
        </div>
      )}
    </div>
  );
}
