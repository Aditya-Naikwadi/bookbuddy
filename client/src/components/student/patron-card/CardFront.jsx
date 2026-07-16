import React from 'react';
import { Book, ShieldAlert, Sparkles } from 'lucide-react';

export const CardFront = ({ profile, isOnline }) => {
  const { name = 'Student', studentId = 'N/A', major = 'N/A', membershipStatus = 'active', validTill } = profile || {};

  const isExpired = membershipStatus === 'expired';
  const isSuspended = membershipStatus === 'suspended';
  const isBlock = isExpired || isSuspended;

  // Formatting dates
  const expiryDate = validTill
    ? new Date(validTill).toLocaleDateString(undefined, { month: '2-digit', year: 'numeric' })
    : 'N/A';

  // Initials fallback
  const initials = name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U';

  return (
    <div
      className={`w-full h-full rounded-3xl overflow-hidden relative shadow-xl border flex flex-col justify-between p-6 sm:p-8 select-none transition-all duration-300 ${
        isExpired
          ? 'bg-gradient-to-br from-void via-deep to-surface border-amber-500/30'
          : isSuspended
          ? 'bg-gradient-to-br from-void via-deep to-surface border-danger/30'
          : 'bg-gradient-to-br from-slate-950 via-indigo-950 to-deep border-indigo-500/20 text-white'
      }`}
    >
      {/* Decorative gradient overlay */}
      {!isBlock && (
        <>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-[0.02] rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 opacity-10 rounded-full -ml-20 -mb-20 blur-3xl pointer-events-none"></div>
        </>
      )}

      {/* Top Bar */}
      <div className="flex justify-between items-start z-10">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-black flex items-center gap-2 tracking-wide">
            <span className="w-7 sm:w-8 h-7 sm:h-8 bg-ember rounded-lg flex items-center justify-center text-white text-sm sm:text-base font-sans">
              B
            </span>
            BookBuddy
          </h2>
          <p className="text-[10px] text-muted tracking-widest font-extrabold uppercase mt-1">
            Digital Library Pass
          </p>
        </div>

        {/* Profile Avatar */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-ink text-base sm:text-lg font-black shrink-0 shadow-inner">
          {initials}
        </div>
      </div>

      {/* Middle: Student details */}
      <div className="space-y-1 my-auto z-10">
        <h3 className="text-2xl sm:text-3xl font-serif font-black tracking-wide truncate max-w-[280px] sm:max-w-xs text-ink">
          {name}
        </h3>
        <p className="text-xs text-muted font-bold tracking-wider">
          Major: <span className="text-ink">{major}</span>
        </p>
      </div>

      {/* Bottom Bar */}
      <div className="flex justify-between items-end border-t border-edge/10 pt-4 z-10">
        <div className="space-y-1">
          <p className="text-[8px] text-muted tracking-widest uppercase font-extrabold">Student Card ID</p>
          <p className="font-mono text-sm sm:text-base font-extrabold tracking-wide text-ink">{studentId}</p>
        </div>

        <div className="text-right space-y-1">
          <p className="text-[8px] text-muted tracking-widest uppercase font-extrabold">Valid Thru</p>
          <p className="font-mono text-sm sm:text-base font-extrabold text-ink">{expiryDate}</p>
        </div>
      </div>

      {/* Expired / Suspended Overlay States */}
      {isBlock && (
        <div className="absolute inset-0 bg-void/85 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
          <div
            className={`p-3 rounded-full mb-3 ${
              isExpired ? 'bg-amber-500/10 text-amber-500' : 'bg-danger/10 text-danger'
            }`}
          >
            <ShieldAlert size={32} />
          </div>
          <h4 className="text-lg font-bold text-ink flex items-center gap-1.5 justify-center">
            Membership {isExpired ? 'Expired' : 'Suspended'}
          </h4>
          <p className="text-[11px] text-muted max-w-[280px] mt-1 leading-relaxed">
            {isExpired
              ? 'Your student borrowing pass has expired. Please visit the librarian desk to renew it.'
              : 'Your library card is currently blocked. Please resolve outstanding fines or support hold issues.'}
          </p>
          <button
            onClick={() => window.open('/support')}
            className={`mt-4 text-xs font-extrabold px-4 py-2 rounded-lg border transition-colors ${
              isExpired
                ? 'border-amber-500/20 text-amber-500 hover:bg-amber-500/10'
                : 'border-danger/20 text-danger hover:bg-danger/10'
            }`}
          >
            Contact Desk / Appeal
          </button>
        </div>
      )}
    </div>
  );
};
