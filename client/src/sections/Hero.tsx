import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { SectionLabel } from "../components/ui/SectionLabel";
import { Button } from "../components/ui/Button";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { motion, useScroll, useTransform, Variants } from "framer-motion";

const HeroComponent = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  // High-performance scroll parallax using Framer Motion
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const textY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const glowY = useTransform(scrollYProgress, [0, 1], [0, 250]);
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 100]);

  // Framer Motion Variants
  const textContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
  };

  const textItemVariants: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.215, 0.61, 0.355, 1] },
    },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 80 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1, ease: [0.34, 1.56, 0.64, 1] },
    },
  };

  // Continuous floating animation
  const floatAnimation = reducedMotion
    ? {}
    : {
        y: [-10, 10],
        transition: {
          duration: 3,
          repeat: Infinity,
          repeatType: "reverse" as const,
          ease: "easeInOut" as const,
        },
      };

  return (
    <section
      ref={containerRef}
      className="relative w-full min-h-[100dvh] overflow-hidden bg-void flex items-center"
    >
      <div className="relative z-0 max-w-7xl mx-auto w-full px-6 md:px-12 xl:px-24 flex flex-col md:flex-row items-center pt-32 pb-12 pointer-events-none">
        {/* Left: Text Content */}
        <motion.div
          style={{ y: reducedMotion ? 0 : textY, opacity: textOpacity }}
          variants={textContainerVariants}
          initial="hidden"
          animate="visible"
          className="w-full md:w-1/2 md:pr-12 pointer-events-auto z-20 flex flex-col items-center text-center md:items-start md:text-left"
        >
          <motion.div variants={textItemVariants}>
            <SectionLabel>Built for Students</SectionLabel>
          </motion.div>
          <motion.h1
            variants={textItemVariants}
            className="font-serif text-5xl md:text-6xl lg:text-[72px] leading-[1.1] tracking-tight text-gradient-primary mb-4 md:mb-6 mt-4"
          >
            The Library in <br className="hidden md:block" /> Your Pocket.
          </motion.h1>
          <motion.p
            variants={textItemVariants}
            className="text-base md:text-lg text-muted mb-8 max-w-md leading-relaxed"
          >
            Borrow, reserve, read 70,000+ free books, track your streaks, and
            never miss a due date — all from one beautifully simple dashboard.
          </motion.p>
          <motion.div
            variants={textItemVariants}
            className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 w-full"
          >
            <Button
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => {
                if (isAuthenticated && user) {
                  const role = user.role;
                  if (role === "college-admin") navigate("/college-admin");
                  else if (role === "general") navigate("/general-dashboard");
                  else if (role === "super-admin") navigate("/admin-portal");
                  else navigate("/student-dashboard");
                } else {
                  navigate("/auth/register");
                }
              }}
            >
              Get Started Free
            </Button>
            <Button variant="ghost" size="lg" className="w-full sm:w-auto">
              Watch Demo ▶
            </Button>
          </motion.div>
        </motion.div>

        {/* Right: CSS UI Composition */}
        <div className="flex w-full md:w-1/2 h-[50dvh] md:h-full relative items-center justify-center pointer-events-none z-10 scale-[0.7] sm:scale-90 md:scale-[0.95] lg:scale-100 mt-12 md:mt-0">
          <div className="relative w-full max-w-lg aspect-square">
            {/* Decorative background glow */}
            <motion.div
              style={{ y: glowY }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-indigo-500/20 via-fuchsia-500/10 to-transparent rounded-full blur-[100px]"
            />

            {/* Main Dashboard Card */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] aspect-[4/3] glass-panel bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 rounded-2xl border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-6 flex flex-col gap-4 overflow-hidden transform -rotate-2 backdrop-blur-2xl"
            >
              <motion.div
                animate={floatAnimation}
                className="w-full h-full flex flex-col gap-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                  <div className="flex flex-col gap-1.5">
                    <div className="h-3 w-32 bg-white/40 rounded-full" />
                    <div className="h-2 w-20 bg-white/20 rounded-full" />
                  </div>
                </div>
                <div className="h-32 bg-gradient-to-br from-white/10 to-transparent rounded-xl w-full border border-white/10 relative overflow-hidden flex items-end p-4">
                  <motion.div
                    style={{ y: bgY }}
                    className="absolute -inset-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30 mix-blend-overlay"
                  />
                  <div className="w-full flex items-end justify-between gap-2 h-16">
                    <div className="w-1/6 bg-indigo-400/60 rounded-t-sm h-[40%]" />
                    <div className="w-1/6 bg-indigo-400/60 rounded-t-sm h-[60%]" />
                    <div className="w-1/6 bg-indigo-400/80 rounded-t-sm h-[90%]" />
                    <div className="w-1/6 bg-fuchsia-400/80 rounded-t-sm h-[100%]" />
                    <div className="w-1/6 bg-fuchsia-400/60 rounded-t-sm h-[70%]" />
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-16 flex-1 bg-white/10 rounded-xl border border-white/10 flex flex-col justify-center px-4">
                    <div className="h-2 w-1/2 bg-white/30 rounded-full mb-2" />
                    <div className="h-2 w-3/4 bg-white/20 rounded-full" />
                  </div>
                  <div className="h-16 flex-1 bg-gradient-to-br from-ember/30 to-ember-glow/20 rounded-xl border border-ember/20 flex items-center justify-center shadow-[inset_0_0_20px_rgba(230,101,37,0.2)]">
                    <div className="h-3 w-1/2 bg-ember/60 rounded-full shadow-[0_0_10px_rgba(230,101,37,0.8)]" />
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Streak Card */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              transition={{
                delay: 0.2,
                duration: 1,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className="absolute top-1/4 right-0 w-[40%] aspect-square glass-panel bg-gradient-to-b from-surface/40 to-deep/40 rounded-2xl border border-white/20 shadow-[0_0_30px_rgba(245,158,11,0.15)] p-5 flex flex-col items-center justify-center transform rotate-6 translate-x-6 backdrop-blur-2xl"
            >
              <motion.div
                animate={floatAnimation}
                transition={{ delay: 0.5, ...floatAnimation.transition }}
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-amber-500/10 to-transparent pointer-events-none" />
                <div className="text-5xl mb-3 drop-shadow-[0_0_25px_rgba(245,158,11,0.8)] text-center">
                  🔥
                </div>
                <div className="text-2xl md:text-3xl font-bold text-white mb-1 drop-shadow-md text-center">
                  14 Days
                </div>
                <div className="text-[10px] md:text-xs text-amber-200/80 font-medium tracking-wide uppercase text-center">
                  Reading Streak
                </div>
              </motion.div>
            </motion.div>

            {/* Book Cover Card */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              transition={{
                delay: 0.4,
                duration: 1,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className="absolute top-0 left-0 w-[35%] aspect-[3/4] bg-gradient-to-br from-indigo-500 to-fuchsia-600 backdrop-blur-2xl rounded-xl border border-white/30 shadow-[0_20px_50px_rgba(79,70,229,0.5)] p-5 flex flex-col justify-end transform -rotate-12 -translate-x-6 relative overflow-hidden mt-8 md:mt-12"
            >
              <motion.div
                animate={floatAnimation}
                transition={{ delay: 1, ...floatAnimation.transition }}
                className="w-full h-full flex flex-col justify-end"
              >
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-black/40 via-transparent to-transparent w-4" />{" "}
                {/* Spine */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full blur-xl" />
                <div className="h-3 w-full bg-white/50 rounded-full mb-3 shadow-[0_0_10px_rgba(255,255,255,0.3)] z-10" />
                <div className="h-2 w-2/3 bg-white/40 rounded-full mb-4 z-10" />
                <div className="h-8 w-8 rounded-full bg-white/20 self-end z-10" />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export const Hero = React.memo(HeroComponent);

