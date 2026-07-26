import { useQuery } from "@tanstack/react-query";
import { streakApi } from "../api/streakApi";

export const useStreakData = () => {
  // 1. Fetch student's active streak stats
  const {
    data: streak,
    isLoading: loadingStreak,
    isError: errorStreak,
    refetch: refetchStreak,
  } = useQuery({
    queryKey: ["streak", "me"],
    queryFn: streakApi.getMyStreak,
    staleTime: 60000, // Cache for 1 minute
  });

  // 2. Fetch the full rewards ladder
  const { data: rewards, isLoading: loadingRewards } = useQuery({
    queryKey: ["streak", "rewards"],
    queryFn: streakApi.getRewardsLadder,
    staleTime: 300000, // Cache for 5 minutes
  });

  // 3. Fetch the full achievement stickers catalog
  const { data: catalog, isLoading: loadingCatalog } = useQuery({
    queryKey: ["stickers", "catalog"],
    queryFn: streakApi.getStickerCatalog,
    staleTime: 300000,
  });

  // 4. Fetch the student's unlocked stickers
  const {
    data: earned,
    isLoading: loadingEarned,
    refetch: refetchStickers,
  } = useQuery({
    queryKey: ["stickers", "me"],
    queryFn: streakApi.getMyStickers,
    staleTime: 60000,
  });

  const isLoading =
    loadingStreak || loadingRewards || loadingCatalog || loadingEarned;
  const isError = errorStreak;

  return {
    streak,
    rewards: rewards || [],
    catalog: catalog || [],
    earned: earned || [],
    isLoading,
    isError,
    refetchAll: () => {
      refetchStreak();
      refetchStickers();
    },
  };
};

export default useStreakData;
