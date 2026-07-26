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
      bg: "bg-indigo-50/70 hover:bg-indigo-100/80 border-indigo-200/80 text-indigo-700",
      iconBg: "bg-indigo-600 text-white",
      badge: "bg-indigo-100 text-indigo-800",
    },
    emerald: {
      bg: "bg-emerald-50/70 hover:bg-emerald-100/80 border-emerald-200/80 text-emerald-700",
      iconBg: "bg-emerald-600 text-white",
      badge: "bg-emerald-100 text-emerald-800",
    },
    amber: {
      bg: "bg-amber-50/70 hover:bg-amber-100/80 border-amber-200/80 text-amber-700",
      iconBg: "bg-amber-600 text-white",
      badge: "bg-amber-100 text-amber-800",
    },
    purple: {
      bg: "bg-purple-50/70 hover:bg-purple-100/80 border-purple-200/80 text-purple-700",
      iconBg: "bg-purple-600 text-white",
      badge: "bg-purple-100 text-purple-800",
    },
  };

  const theme = colorThemes[color] || colorThemes.indigo;

  return (
    <div
      onClick={() => navigate(to)}
      className={`p-6 rounded-2xl border shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between group hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${theme.bg}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-2xl shadow-sm ${theme.iconBg}`}>
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
        <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-900 transition-colors mb-1">
          {title}
        </h3>
        <p className="text-xs text-slate-600 mb-4 line-clamp-2 leading-relaxed">
          {description}
        </p>

        <div className="flex items-center text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
          <span>Explore Now</span>
          <ArrowRight className="w-4 h-4 ml-1.5 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );
};

export default QuickActionCard;
