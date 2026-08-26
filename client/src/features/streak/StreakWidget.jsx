import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { streakApi } from "./api";
import { useSocket } from "../../hooks/useSocket";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Flame, Snowflake } from "lucide-react";

export const StreakWidget = () => {
  const { socket } = useSocket();
  const prefersReducedMotion = useReducedMotion();
  const [justBumped, setJustBumped] = useState(false);

  const { data: streak, refetch } = useQuery({
    queryKey: ["streak", "me"],
    queryFn: streakApi.getMyStreak,
  });

  useEffect(() => {
    const handleUpdate = () => {
      refetch();
      setJustBumped(true);
      setTimeout(() => setJustBumped(false), 2000);
    };

    window.addEventListener("streak:updated", handleUpdate);
    if (socket) {
      socket.on("streak:updated", handleUpdate);
    }
    return () => {
      window.removeEventListener("streak:updated", handleUpdate);
      if (socket) {
        socket.off("streak:updated", handleUpdate);
      }
    };
  }, [refetch, socket]);

  if (!streak) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.button
          animate={
            justBumped && !prefersReducedMotion
              ? { scale: [1, 1.25, 1], rotate: [0, -10, 10, 0] }
              : {}
          }
          transition={{ duration: 0.4 }}
          whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
          whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
            streak.todayComplete
              ? "bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200 dark:border-orange-800/60 shadow-xs"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          <Flame
            className={`w-5 h-5 ${
              streak.todayComplete ? "animate-pulse text-orange-500" : ""
            }`}
            fill={streak.todayComplete ? "currentColor" : "none"}
          />
          <span className="font-mono text-sm">{streak.currentStreak}</span>
        </motion.button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4" align="end">
        <div className="flex flex-col gap-3">
          <h4 className="font-bold text-lg flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" fill="currentColor" />
            {streak.currentStreak} Day Streak
          </h4>
          <p className="text-sm text-muted-foreground">
            {streak.todayComplete
              ? "You've completed your reading for today! Keep it going 🔥"
              : "Read for 3 minutes or borrow a book to keep your streak alive today."}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t">
            <span className="text-sm font-medium text-muted-foreground">
              Streak Freezes
            </span>
            <div className="flex gap-1">
              {Array.from({ length: 2 }).map((_, i) => (
                <Snowflake
                  key={i}
                  className={`w-4 h-4 ${
                    i < streak.freezesAvailable
                      ? "text-blue-500 animate-pulse"
                      : "text-slate-300 dark:text-slate-700"
                  }`}
                  fill={i < streak.freezesAvailable ? "currentColor" : "none"}
                />
              ))}
            </div>
          </div>
          {streak.freezesAvailable > 0 && (
            <p className="text-xs text-muted-foreground">
              A freeze will automatically protect your streak if you miss a day.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
