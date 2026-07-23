import { AlertCircle } from 'lucide-react';

const StatCard = ({
  title,
  value,
  icon: Icon,
  subtitle,
  badge,
  trend,
  loading = false,
  error = null,
  onClick,
  clickable = false,
}) => {
  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm animate-pulse flex flex-col justify-between h-36">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-slate-200 rounded-md"></div>
          <div className="h-10 w-10 bg-slate-200 rounded-xl"></div>
        </div>
        <div>
          <div className="h-8 w-24 bg-slate-200 rounded-lg mb-2"></div>
          <div className="h-3 w-36 bg-slate-200 rounded-md"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50/50 p-6 rounded-2xl border border-red-200/80 shadow-sm flex flex-col justify-center items-center text-center h-36">
        <AlertCircle className="w-6 h-6 text-red-500 mb-1" />
        <p className="text-xs font-semibold text-red-800 mb-1">Failed to load stat</p>
        <span className="text-[11px] text-red-600">{error}</span>
      </div>
    );
  }

  const badgeStyles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  };

  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={`bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between transition-all duration-200 ${
        clickable
          ? 'cursor-pointer hover:shadow-md hover:border-indigo-300 hover:-translate-y-0.5 active:translate-y-0'
          : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
        {Icon && (
          <div className="p-2.5 bg-indigo-50/80 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{value}</span>
          {badge && (
            <span
              className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${
                badgeStyles[badge.type || 'info']
              }`}
            >
              {badge.text}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{subtitle}</span>
          {trend && <span className="font-semibold text-emerald-600 ml-2">{trend}</span>}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
