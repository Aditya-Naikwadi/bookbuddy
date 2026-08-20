import React, { useState, useEffect } from 'react';
import { Award, Sparkles, X } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';

export const BadgeUnlockToast = () => {
  const { socket } = useSocket();
  const [badgeToast, setBadgeToast] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const handleBadgeEarned = (data) => {
      if (data && (data.badge || data.badgeKey)) {
        setBadgeToast({
          title: data.badge?.label || data.badgeKey || 'New Badge Unlocked!',
          icon: data.badge?.icon || 'award',
          pointsEarned: data.pointsEarned || data.pointsAdded || 10,
          tier: data.badge?.tier || 'bronze',
          earnedAt: new Date().toLocaleTimeString(),
        });

        // Auto dismiss after 5s
        const timer = setTimeout(() => {
          setBadgeToast(null);
        }, 5000);
        return () => clearTimeout(timer);
      }
    };

    socket.on('badge:earned', handleBadgeEarned);

    return () => {
      socket.off('badge:earned', handleBadgeEarned);
    };
  }, [socket]);

  if (!badgeToast) return null;

  const tierGradients = {
    bronze: 'from-amber-600 to-amber-800 border-amber-500/50',
    silver: 'from-slate-400 to-slate-600 border-slate-300/50',
    gold: 'from-yellow-400 to-amber-500 border-yellow-300/50',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce-in max-w-md w-full">
      <div
        className={`p-4 rounded-2xl bg-gradient-to-r ${tierGradients[badgeToast.tier] || tierGradients.bronze} text-white shadow-2xl backdrop-blur-md border flex items-center justify-between gap-4`}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm flex items-center justify-center">
            <Award className="w-8 h-8 text-yellow-200 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-yellow-200">
              <Sparkles className="w-3.5 h-3.5" /> Badge Unlocked!
            </div>
            <h4 className="font-bold text-lg leading-tight">{badgeToast.title}</h4>
            <p className="text-xs text-white/80">+{badgeToast.pointsEarned} Leaderboard Points</p>
          </div>
        </div>

        <button
          onClick={() => setBadgeToast(null)}
          className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          aria-label="Dismiss toast"
        >
          <X className="w-5 h-5 text-white/80" />
        </button>
      </div>
    </div>
  );
};

export default BadgeUnlockToast;
