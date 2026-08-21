import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const QuickActionCard = ({
  title,
  description,
  icon: Icon,
  to,
  badge,
  color = "indigo",
}) => {
  const navigate = useNavigate();

  const colorThemes = {
    indigo: {
      bg: "bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-indigo-500/50 text-indigo-300",
      iconBg: "bg-indigo-600 text-white shadow-md shadow-indigo-600/20",
      badge: "bg-indigo-950 text-indigo-300 border border-indigo-800/80",
    },
    emerald: {
      bg: "bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-emerald-500/50 text-emerald-300",
      iconBg: "bg-emerald-600 text-white shadow-md shadow-emerald-600/20",
      badge: "bg-emerald-950 text-emerald-300 border border-emerald-800/80",
    },
    amber: {
      bg: "bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-amber-500/50 text-amber-300",
      iconBg: "bg-amber-600 text-white shadow-md shadow-amber-600/20",
      badge: "bg-amber-950 text-amber-300 border border-amber-800/80",
    },
    purple: {
      bg: "bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-purple-500/50 text-purple-300",
      iconBg: "bg-purple-600 text-white shadow-md shadow-purple-600/20",
      badge: "bg-purple-950 text-purple-300 border border-purple-800/80",
    },
  };

  const theme = colorThemes[color] || colorThemes.indigo;

  return (
    <div
      onClick={() => navigate(to)}
      className={`p-6 rounded-2xl border shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between group hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 ${theme.bg}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-2xl ${theme.iconBg}`}>
          {Icon && <Icon className="w-6 h-6" />}
        </div>
        {badge && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${theme.badge}`}
          >
            {badge}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-base font-bold text-slate-100 group-hover:text-white transition-colors mb-1">
          {title}
        </h3>
        <p className="text-xs text-slate-400 mb-4 line-clamp-2 leading-relaxed">
          {description}
        </p>

        <div className="flex items-center text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
          <span>Explore Now</span>
          <ArrowRight className="w-4 h-4 ml-1.5 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );
};

export default QuickActionCard;
