
import { useQuery } from '@tanstack/react-query';
import { streakApi } from './api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Flame, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const StreakDashboardCard = () => {
  const { data: streak, isLoading } = useQuery({
    queryKey: ['streak', 'me'],
    queryFn: streakApi.getMyStreak
  });

  const { data: rewards } = useQuery({
    queryKey: ['streak', 'rewards'],
    queryFn: streakApi.getRewardsLadder
  });

  if (isLoading || !streak || !rewards) return null;

  // Find the next milestone
  const nextMilestone = rewards.find(r => r.streakDays > streak.currentStreak);
  const progressPercent = nextMilestone 
    ? (streak.currentStreak / nextMilestone.streakDays) * 100 
    : 100;

  return (
    <Card className="overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Flame className="w-32 h-32 text-orange-500" />
      </div>
      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" fill="currentColor" />
            Reading Streak
          </CardTitle>
          <span className="text-2xl font-black text-orange-500">{streak.currentStreak} Days</span>
        </div>
        <CardDescription>
          {streak.todayComplete 
            ? "Awesome! You've kept your streak alive today."
            : "Complete a reading session or borrow a book today to keep it going!"}
        </CardDescription>
      </CardHeader>
      <CardContent className="relative z-10">
        {nextMilestone && (
          <div className="space-y-2 mt-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Next Milestone: {nextMilestone.streakDays} Days</span>
              <span className="text-muted-foreground">{nextMilestone.streakDays - streak.currentStreak} left</span>
            </div>
            <Progress value={progressPercent} className="h-2 bg-orange-100 dark:bg-orange-950" indicatorColor="bg-orange-500" />
            <div className="flex items-center gap-2 mt-4 p-3 bg-muted/50 rounded-lg text-sm">
              <Star className="w-4 h-4 text-yellow-500" />
              <span>Reward unlocked at {nextMilestone.streakDays} days!</span>
            </div>
          </div>
        )}
        {!streak.todayComplete && (
          <Button className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => window.location.href='/eresources'}>
            Read Now
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
