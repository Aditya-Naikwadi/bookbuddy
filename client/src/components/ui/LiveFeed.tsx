import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const feedItems = [
  "Sarah started a 14-day streak 🔥",
  "David just borrowed 'Atomic Habits' 📖",
  "Emma reviewed 'Dune' ⭐⭐⭐⭐⭐",
  "Michael reserved a study room 🎓",
  "Alex unlocked the 'Bookworm' badge 🏆",
];

export const LiveFeed = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % feedItems.length);
    }, 4000); // Change every 4 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-6 left-6 z-[90] pointer-events-none hidden md:block">
      <div className="glass-panel px-4 py-3 rounded-2xl flex items-center gap-3 shadow-lg border border-white/10 bg-surface/80 backdrop-blur-md">
        <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        <div className="overflow-hidden h-6 relative w-64">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={currentIndex}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute inset-0 flex items-center text-sm font-medium text-ink"
            >
              {feedItems[currentIndex]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
