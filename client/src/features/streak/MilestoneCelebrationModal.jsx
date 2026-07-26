import { useEffect, useState, useRef } from "react";
import { Flame, Sparkles, X, Gift } from "lucide-react";

export const MilestoneCelebrationModal = () => {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    const handleStreakUpdate = (e) => {
      const data = e.detail || e; // Support custom events or direct socket payloads
      if (
        data &&
        (data.newStickers?.length > 0 || data.newRewards?.length > 0)
      ) {
        setPayload(data);
        setOpen(true);

        // Focus the close button for accessibility
        setTimeout(() => {
          closeBtnRef.current?.focus();
        }, 80);
      }
    };

    window.addEventListener("streak:updated", handleStreakUpdate);
    return () =>
      window.removeEventListener("streak:updated", handleStreakUpdate);
  }, []);

  // Keyboard Escape closer
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  if (!open || !payload) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-void/80 backdrop-blur-[2px] animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-title"
    >
      <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 p-6 text-center shadow-2xl relative animate-in zoom-in-95 duration-300 flex flex-col items-center">
        {/* Close Button */}
        <button
          ref={closeBtnRef}
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors focus:ring-2 focus:ring-orange-500 focus:outline-none"
          aria-label="Dismiss milestone celebration"
        >
          <X size={18} />
        </button>

        {/* Header Icon */}
        <div className="w-16 h-16 bg-orange-100 rounded-3xl flex items-center justify-center text-orange-500 mb-4 animate-bounce-slow">
          <Flame size={36} fill="currentColor" />
        </div>

        {/* Title */}
        <h3
          id="milestone-title"
          className="text-2xl font-serif font-black text-slate-900 flex items-center gap-1.5 justify-center"
        >
          <Sparkles className="text-yellow-500" size={20} />
          Milestone Reached!
          <Sparkles className="text-yellow-500" size={20} />
        </h3>

        {/* Subtitle */}
        <p className="text-slate-600 font-medium text-sm mt-2">
          Awesome work! You've reached a{" "}
          <span className="text-orange-500 font-black">
            {payload.streak?.currentStreak || 0} Day
          </span>{" "}
          reading streak!
        </p>

        {/* New Badges Section */}
        {payload.newStickers?.length > 0 && (
          <div className="w-full mt-6 space-y-3">
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              New Stickers Unlocked
            </h4>
            <div className="flex justify-center gap-3 flex-wrap">
              {payload.newStickers.map((sticker) => (
                <div
                  key={sticker.code || sticker._id}
                  className="flex flex-col items-center p-3.5 bg-slate-50 border border-slate-100 rounded-2xl w-24 shrink-0 shadow-sm"
                >
                  <span className="text-4xl drop-shadow-sm mb-1.5">
                    {sticker.iconUrl || sticker.icon || "🏅"}
                  </span>
                  <span className="text-[10px] font-extrabold text-slate-800 leading-tight truncate w-full text-center">
                    {sticker.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Rewards Section */}
        {payload.newRewards?.length > 0 && (
          <div className="w-full mt-6 space-y-3 pt-5 border-t border-slate-100">
            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Streak Rewards Unlocked
            </h4>
            <ul className="text-left space-y-2 bg-orange-50 p-4 rounded-2xl w-full">
              {payload.newRewards.map((reward, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-xs text-orange-800 font-medium"
                >
                  <Gift size={16} className="text-orange-500 shrink-0" />
                  <span>
                    Unlocked{" "}
                    <span className="font-extrabold capitalize">
                      {reward.rewardType.replace("_", " ")}
                    </span>{" "}
                    reward: {reward.rewardValue || "Claimed"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Keep it going Button */}
        <button
          onClick={() => setOpen(false)}
          className="mt-6 w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-md transition-all active:scale-[0.98] text-xs focus:ring-2 focus:ring-orange-500/50"
        >
          Keep it going 🔥
        </button>
      </div>
    </div>
  );
};

export default MilestoneCelebrationModal;
