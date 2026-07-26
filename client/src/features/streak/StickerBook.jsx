import { useQuery } from "@tanstack/react-query";
import { streakApi } from "./api";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const StickerBook = () => {
  const { data: catalog, isLoading: isCatalogLoading } = useQuery({
    queryKey: ["stickers", "catalog"],
    queryFn: streakApi.getStickerCatalog,
  });

  const { data: earned, isLoading: isEarnedLoading } = useQuery({
    queryKey: ["stickers", "me"],
    queryFn: streakApi.getMyStickers,
  });

  if (isCatalogLoading || isEarnedLoading || !catalog || !earned) {
    return <div>Loading Sticker Book...</div>;
  }

  const earnedCodes = new Set(earned.map((e) => e.stickerCode));

  const categories = [...new Set(catalog.map((s) => s.category))];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sticker Book</h2>
        <p className="text-muted-foreground">
          Collect stickers by building your streak and exploring the library.
          You have {earnedCodes.size} of {catalog.length}.
        </p>
      </div>

      {categories.map((category) => {
        const catStickers = catalog.filter((s) => s.category === category);
        return (
          <div key={category} className="space-y-4">
            <h3 className="text-xl font-semibold capitalize border-b pb-2">
              {category.replace("_", " ")}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {catStickers.map((sticker) => {
                const isEarned = earnedCodes.has(sticker.code);
                return (
                  <Card
                    key={sticker.code}
                    className={`relative overflow-hidden transition-all ${isEarned ? "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-2 border-orange-200 dark:border-orange-900" : "bg-slate-50 dark:bg-slate-900 border-dashed"}`}
                  >
                    <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                      <div
                        className={`text-5xl drop-shadow-md transition-all ${isEarned ? "scale-110" : "grayscale opacity-20"}`}
                      >
                        {sticker.icon}
                      </div>

                      {!isEarned && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                          <Lock className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}

                      <div className="space-y-1 relative z-10 mt-2">
                        <h4 className="font-bold text-sm leading-tight">
                          {sticker.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {sticker.description}
                        </p>
                      </div>

                      {isEarned && (
                        <Badge
                          variant="secondary"
                          className="mt-2 text-[10px] uppercase"
                        >
                          {sticker.rarity}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
