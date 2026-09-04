import React, { useEffect } from "react";
import { motion } from "framer-motion";

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3200); // 3.2 seconds total to allow all animations to complete

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      onClick={onComplete}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-void select-none overflow-hidden cursor-pointer"
    >
      {/* Atmospheric background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-40 -right-40 w-96 h-96 bg-indigo rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-fuchsia rounded-full blur-[120px]"
        />
      </div>

      {/* Main Logo Container */}
      <div className="relative z-10 flex flex-col items-center max-w-sm px-4">
        {/* Pulsing glow aura behind the mascot */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{
            scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
            opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" },
            default: { duration: 1, ease: "easeOut" },
          }}
          className="absolute -top-6 w-44 h-44 bg-ember/30 rounded-full blur-[40px] pointer-events-none"
        />

        {/* Mascot Avatar with spring jump animation */}
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 120,
            damping: 12,
            delay: 0.1,
          }}
          className="w-32 h-32 rounded-full overflow-hidden bg-[#FAF6EC] border border-ember/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center relative z-10"
        >
          <img
            src="/favicon.png"
            alt="BookBuddy Mascot"
            className="w-full h-full object-cover scale-105"
          />
        </motion.div>

        {/* Brand Name Text with sliding spring animation */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 80,
            damping: 15,
            delay: 0.4,
          }}
          className="font-serif text-4xl text-ink mt-6 flex items-center justify-center tracking-wide"
        >
          Book
          <span className="bg-gradient-to-r from-ember to-ember-glow bg-clip-text text-transparent font-bold ml-1">
            Buddy
          </span>
        </motion.h1>

        {/* Animated Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.7, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: "easeOut" }}
          className="text-xs uppercase tracking-[0.25em] font-semibold text-muted text-center mt-3 max-w-xs leading-relaxed"
        >
          Spark the streak, stoke the mind.
        </motion.p>

        {/* Progress Loading Bar */}
        <div className="w-48 h-1 bg-edge/30 rounded-full overflow-hidden mt-8 backdrop-blur-sm">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.7, ease: "easeInOut" }}
            className="h-full bg-gradient-to-r from-ember to-ember-glow shadow-[0_0_8px_var(--color-ember)]"
          />
        </div>

        {/* Interactive skip hint */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="text-[10px] text-muted mt-5 hover:opacity-100 transition-opacity uppercase tracking-widest font-semibold"
        >
          Tap anywhere to skip
        </motion.span>
      </div>
    </motion.div>
  );
};
