
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface Props {
  title: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
}

export const StickerCard: React.FC<Props> = ({ title, description, icon, unlocked }) => {
  return (
    <motion.div 
      whileHover={unlocked ? { scale: 1.06 } : {}}
      className={cn(
        "p-4 rounded-xl border flex flex-col items-center text-center gap-2",
        unlocked ? "bg-surface border-ember shadow-[0_0_15px_rgba(217,119,6,0.15)] text-ink" : "bg-void border-edge text-muted grayscale opacity-60"
      )}
    >
      <div className={cn("w-16 h-16 rounded-full flex items-center justify-center text-3xl", unlocked ? "bg-ember/20 text-ember" : "bg-surface")}>
        {icon}
      </div>
      <h4 className="font-semibold text-sm">{title}</h4>
      <p className="text-xs">{description}</p>
    </motion.div>
  );
}
