import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';
import { Flame } from 'lucide-react';

export const MilestoneCelebrationModal = () => {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState(null);

  function triggerConfetti() {
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#f97316', '#fbbf24']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#f97316', '#fbbf24']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }

  useEffect(() => {
    const handleStreakUpdate = (e) => {
      const data = e.detail || e; // Support custom events or direct calls
      if (data && (data.newStickers?.length > 0 || data.newRewards?.length > 0)) {
        setPayload(data);
        setOpen(true);
        triggerConfetti();
      }
    };

    window.addEventListener('streak:updated', handleStreakUpdate);
    return () => window.removeEventListener('streak:updated', handleStreakUpdate);
  }, []);

  if (!payload) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md text-center border-orange-200">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-orange-500 flex justify-center items-center gap-2">
            <Flame className="w-8 h-8" fill="currentColor" />
            Milestone Reached!
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            You just hit a {payload.streak?.currentStreak} day reading streak!
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {payload.newStickers?.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">New Stickers Unlocked</h4>
              <div className="flex justify-center gap-4 flex-wrap">
                {payload.newStickers.map(sticker => (
                  <div key={sticker.code} className="flex flex-col items-center p-3 bg-muted rounded-xl w-24">
                    <span className="text-4xl drop-shadow-md mb-2">{sticker.icon}</span>
                    <span className="text-xs font-bold leading-tight">{sticker.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {payload.newRewards?.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">New Rewards</h4>
              <ul className="text-left space-y-2 bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg">
                {payload.newRewards.map(reward => (
                  <li key={reward.streakDays} className="flex items-center gap-2 text-sm font-medium">
                    <span className="text-orange-500">✨</span>
                    {reward.rewardType.replace('_', ' ').toUpperCase()} Reward Unlocked!
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-center mt-2">
          <Button onClick={() => setOpen(false)} className="bg-orange-500 hover:bg-orange-600 text-white w-full">
            Keep it going 🔥
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
