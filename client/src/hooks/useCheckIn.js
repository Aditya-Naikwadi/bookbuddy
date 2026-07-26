import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { streakApi } from "../api/streakApi";
import { useReducedMotion } from "./useReducedMotion";
import confetti from "canvas-confetti";

export const useCheckIn = () => {
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();
  const [announcement, setAnnouncement] = useState("");

  // Confetti explosion helper (skips if reduced motion is preferred)
  const triggerConfetti = () => {
    if (prefersReducedMotion) return;

    const duration = 2.5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  };

  // 1. Check-In Mutation
  const checkInMutation = useMutation({
    mutationFn: streakApi.checkIn,
    onMutate: async () => {
      // Cancel outgoing queries to prevent overwrites
      await queryClient.cancelQueries({ queryKey: ["streak", "me"] });

      // Save previous state for rollback
      const prevStreak = queryClient.getQueryData(["streak", "me"]);

      // Optimistically update cache
      if (prevStreak) {
        queryClient.setQueryData(["streak", "me"], {
          ...prevStreak,
          currentStreak: prevStreak.currentStreak + 1,
          longestStreak: Math.max(
            prevStreak.longestStreak,
            prevStreak.currentStreak + 1,
          ),
          todayComplete: true,
        });
      }

      return { prevStreak };
    },
    onSuccess: (data) => {
      // Reconcile with actual server response
      queryClient.setQueryData(["streak", "me"], data);

      // Invalidate badges/stickers list in case a new milestone was crossed
      queryClient.invalidateQueries({ queryKey: ["stickers", "me"] });

      // Screen reader announcements
      const newStreakCount = data.currentStreak;
      setAnnouncement(
        `Check-in successful! Your daily reading streak is now ${newStreakCount} days.`,
      );

      // Confetti celebration
      triggerConfetti();

      // Trigger local window event in case a badge celebration is unlocked
      window.dispatchEvent(
        new CustomEvent("streak:updated", {
          detail: {
            streak: data,
            newStickers: data.newStickers || [],
            newRewards: data.newRewards || [],
          },
        }),
      );
    },
    onError: (err, variables, context) => {
      // Rollback to previous state on failure
      if (context?.prevStreak) {
        queryClient.setQueryData(["streak", "me"], context.prevStreak);
      }
      setAnnouncement(
        "Failed to check in. Please verify your connection and try again.",
      );
    },
  });

  // 2. Repair Streak Mutation
  const repairMutation = useMutation({
    mutationFn: streakApi.repairStreak,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["streak", "me"] });
      queryClient.invalidateQueries({ queryKey: ["stickers", "me"] });
      setAnnouncement(
        "Streak repaired successfully! Your freezes saved your progress.",
      );
      triggerConfetti();
    },
    onError: () => {
      setAnnouncement(
        "Failed to repair streak. Make sure you have freezes available.",
      );
    },
  });

  return {
    checkIn: checkInMutation.mutate,
    isCheckInPending: checkInMutation.isPending,
    repairStreak: repairMutation.mutate,
    isRepairPending: repairMutation.isPending,
    announcement,
  };
};

export default useCheckIn;
