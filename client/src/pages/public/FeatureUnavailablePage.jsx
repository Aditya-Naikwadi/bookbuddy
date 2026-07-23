import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Building2 } from 'lucide-react';

export default function FeatureUnavailablePage({ featureKey }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-center text-amber-600 mb-6 shadow-sm">
        <ShieldAlert size={32} />
      </div>

      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
        Module Unavailable
      </span>

      <h1 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-3">
        Feature Not Available at Your Institution
      </h1>

      <p className="text-slate-600 max-w-md mb-8 text-sm md:text-base leading-relaxed">
        This service module {featureKey ? `("${featureKey}")` : ''} has not been enabled by your college administrator. Please contact your campus library administration if you believe this is an error.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          to="/student-dashboard"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all shadow-sm shadow-indigo-200"
        >
          <ArrowLeft size={18} />
          Return to Dashboard
        </Link>
        <div className="inline-flex items-center gap-2 px-4 py-2.5 text-xs text-slate-500 bg-slate-100 rounded-xl">
          <Building2 size={16} />
          <span>Tenant Policy Enforced</span>
        </div>
      </div>
    </div>
  );
}
