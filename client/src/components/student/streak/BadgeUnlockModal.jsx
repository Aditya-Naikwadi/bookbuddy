import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Check, X, Sparkles, Trophy } from 'lucide-react';

export const BadgeUnlockModal = ({ unlockedBadges = [], onClose }) => {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

  if (!unlockedBadges || unlockedBadges.length === 0) return null;

  const currentBadge = unlockedBadges[0];
  const badgeName = currentBadge.name || 'Milestone Achievement';
  const rarity = (currentBadge.rarity || 'common').toLowerCase();

  const getRarityBadge = (r) => {
    switch (r) {
      case 'legendary':
        return {
          label: 'LEGENDARY',
          badgeClass: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black shadow-lg',
          glowClass: 'from-amber-500/30 to-yellow-500/20 border-amber-500/40',
        };
      case 'epic':
        return {
          label: 'EPIC',
          badgeClass: 'bg-gradient-to-r from-purple-600 to-pink-500 text-white font-black shadow-lg',
          glowClass: 'from-purple-500/30 to-pink-500/20 border-purple-500/40',
        };
      case 'rare':
        return {
          label: 'RARE',
          badgeClass: 'bg-gradient-to-r from-blue-600 to-indigo-500 text-white font-black shadow-lg',
          glowClass: 'from-blue-500/30 to-indigo-500/20 border-indigo-500/40',
        };
      default:
        return {
          label: 'COMMON',
          badgeClass: 'bg-slate-700 text-slate-200 font-bold',
          glowClass: 'from-indigo-500/20 to-slate-500/20 border-slate-500/30',
        };
    }
  };

  const rarityInfo = getRarityBadge(rarity);

  // Client-side Share Helper: Copy styled text or generate canvas snapshot
  const handleShare = async () => {
    try {
      const shareText = `🏆 I just unlocked the "${badgeName}" (${rarityInfo.label}) sticker on BookBuddy! 📚🔥`;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={`relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border ${rarityInfo.glowClass} text-center overflow-hidden z-10`}
        >
          {/* Ambient Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-all z-20"
          >
            <X size={18} />
          </button>

          {/* Header Banner */}
          <div className="space-y-2 relative z-10">
            <span className={`inline-block px-3 py-1 rounded-full text-[10px] uppercase tracking-widest ${rarityInfo.badgeClass}`}>
              {rarityInfo.label} UNLOCK
            </span>

            <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-white flex items-center justify-center gap-2 pt-1">
              <Sparkles className="text-amber-400" size={24} />
              Badge Unlocked!
            </h2>
            <p className="text-xs text-slate-400">Congratulations! You earned a new sticker accomplishment.</p>
          </div>

          {/* Badge Visual Icon / Illustration */}
          <div className="my-6 relative flex items-center justify-center">
            <div className={`w-32 h-32 rounded-3xl bg-gradient-to-br ${rarityInfo.glowClass} p-1 shadow-2xl ring-4 ring-white/10 flex items-center justify-center relative group`}>
              <div className="w-full h-full bg-slate-900/90 rounded-[22px] flex flex-col items-center justify-center p-3 text-center space-y-1">
                {currentBadge.iconUrl ? (
                  <img src={currentBadge.iconUrl} alt={badgeName} className="w-16 h-16 object-contain" />
                ) : (
                  <Trophy className="text-amber-400 w-14 h-14 animate-bounce" />
                )}
                <span className="text-xs font-bold text-white truncate max-w-full">{badgeName}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto mb-6">
            {currentBadge.criteria || 'Unlocked for outstanding reading streak consistency and milestone completion!'}
          </p>

          {/* Actions */}
          <div className="flex gap-3 text-xs font-bold">
            <button
              onClick={handleShare}
              className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
              <span>{copied ? 'Copied to Clipboard!' : 'Share Achievement'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all"
            >
              Done
            </button>
          </div>

          {/* Canvas placeholder for offline graphic rendering */}
          <canvas ref={canvasRef} width="400" height="200" className="hidden" />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BadgeUnlockModal;
