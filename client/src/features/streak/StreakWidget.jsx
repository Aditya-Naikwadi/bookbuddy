import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { streakApi } from './api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Flame, Snowflake } from 'lucide-react';

export const StreakWidget = () => {
  const { data: streak, refetch } = useQuery({
    queryKey: ['streak', 'me'],
    queryFn: streakApi.getMyStreak
  });

  // Example: listen to a global window event or socket for realtime updates
  useEffect(() => {
    const handleUpdate = () => refetch();
    window.addEventListener('streak:updated', handleUpdate);
    return () => window.removeEventListener('streak:updated', handleUpdate);
  }, [refetch]);

  if (!streak) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
            streak.todayComplete 
              ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-500' 
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          <Flame 
            className={`w-5 h-5 ${streak.todayComplete ? 'animate-pulse' : ''}`} 
            fill={streak.todayComplete ? 'currentColor' : 'none'} 
          />
          <span>{streak.currentStreak}</span>
        </button>
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
            <span className="text-sm font-medium text-muted-foreground">Streak Freezes</span>
            <div className="flex gap-1">
              {Array.from({ length: 2 }).map((_, i) => (
                <Snowflake 
                  key={i} 
                  className={`w-4 h-4 ${i < streak.freezesAvailable ? 'text-blue-500' : 'text-slate-300 dark:text-slate-700'}`} 
                  fill={i < streak.freezesAvailable ? 'currentColor' : 'none'}
                />
              ))}
            </div>
          </div>
          {streak.freezesAvailable > 0 && (
            <p className="text-xs text-muted-foreground">A freeze will automatically protect your streak if you miss a day.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
