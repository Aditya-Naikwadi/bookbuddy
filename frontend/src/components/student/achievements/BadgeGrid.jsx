import { Lock, Award } from "lucide-react";
import { Badge } from "../../ui/Badge";

export const BadgeGrid = ({ catalog = [], earned = [] }) => {
  // Convert earned array to a set of unlocked sticker names for fast lookup
  // Wait! In the server's UserSticker model, the earned stickers are stored as reference objects!
  // Let's verify how they are stored:
  // UserSticker has: userId, stickerId.
  // In getMyStickers controller: `const userStickers = await UserSticker.find({ userId: req.user._id });`
  // So earned is an array of objects: { _id, userId, stickerId, createdAt, updatedAt }
  // To match against the catalog, we should check if the stickerId matches!
  const earnedStickerIds = new Set(
    earned.map((e) => e.stickerId?.toString() || e.stickerId),
  );

  // Group catalog stickers by category
  const categories = [
    ...new Set(catalog.map((s) => s.category || "Milestones")),
  ];

  return (
    <div className="space-y-8 w-full">
      <div>
        <h2 className="text-xl font-serif font-black text-slate-900 flex items-center gap-2">
          <Award className="text-indigo-600" />
          Sticker Book & Badges
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Unlock achievements by extending check-in streaks and exploring
          BookBuddy features. You have{" "}
          <span className="text-indigo-600 font-extrabold">
            {earned.length}
          </span>{" "}
          of{" "}
          <span className="text-slate-800 font-extrabold">
            {catalog.length}
          </span>{" "}
          earned.
        </p>
      </div>

      {categories.map((category) => {
        const catStickers = catalog.filter((s) => s.category === category);
        return (
          <div key={category} className="space-y-4">
            {/* Category Header */}
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">
              {category.replace("_", " ")}
            </h3>

            {/* Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {catStickers.map((sticker) => {
                // Check if earned by matching either ID or name
                const isEarned = earnedStickerIds.has(
                  sticker._id?.toString() || sticker._id,
                );

                return (
                  <div
                    key={sticker._id}
                    className={`relative rounded-3xl border p-5 flex flex-col items-center text-center justify-between min-h-[180px] transition-all select-none focus:outline-none focus:ring-2 focus:ring-indigo-600 ${
                      isEarned
                        ? "bg-gradient-to-br from-white to-slate-50 border-slate-200 shadow-sm hover:scale-[1.02] hover:shadow-md"
                        : "bg-slate-50/50 border-slate-100 border-dashed opacity-75"
                    }`}
                    tabIndex={0}
                    aria-label={`Sticker: ${sticker.name}. Rarity: ${sticker.rarity}. Status: ${
                      isEarned
                        ? "Unlocked"
                        : `Locked. Criteria: ${sticker.criteria}`
                    }`}
                  >
                    {/* Lock Overlay for locked stickers */}
                    {!isEarned && (
                      <div
                        className="absolute top-3 right-3 text-slate-300"
                        aria-hidden="true"
                      >
                        <Lock size={14} />
                      </div>
                    )}

                    {/* Emoji Icon */}
                    <div
                      className={`text-4xl sm:text-5xl drop-shadow-sm transition-all duration-300 mt-2 ${
                        isEarned ? "scale-110" : "grayscale opacity-30 scale-95"
                      }`}
                    >
                      {sticker.iconUrl || sticker.icon || "🏅"}
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 mt-4 flex-1 flex flex-col justify-end">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-800 leading-tight">
                        {sticker.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 leading-normal max-w-[140px] mx-auto">
                        {sticker.criteria}
                      </p>
                    </div>

                    {/* Rarity Badge (for earned stickers) */}
                    {isEarned && (
                      <Badge
                        className={`mt-3 text-[9px] font-black uppercase px-2 py-0.5 ${
                          sticker.rarity === "legendary"
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            : sticker.rarity === "epic"
                              ? "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                              : sticker.rarity === "rare"
                                ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                                : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                        }`}
                      >
                        {sticker.rarity}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BadgeGrid;
