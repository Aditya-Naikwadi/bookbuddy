import React from 'react';
import { motion } from 'framer-motion';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Flame, Trophy, Award, Zap } from 'lucide-react';

const streakData = [
  { id: 1, label: 'Early Bird', icon: <Zap className="text-yellow-400" />, unlocked: true },
  { id: 2, label: '7 Day Streak', icon: <Flame className="text-ember" />, unlocked: true },
  { id: 3, label: 'Bookworm', icon: <Award className="text-indigo-400" />, unlocked: true },
  { id: 4, label: '14 Day Streak', icon: <Flame className="text-ember" />, unlocked: false },
  { id: 5, label: 'Scholar', icon: <Trophy className="text-yellow-500" />, unlocked: false },
];

export const StreakShowcase = () => {
  return (
    <section id="streaks" className="bg-void py-24 md:py-32 xl:py-40 relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-ember/10 via-amber-500/5 to-transparent rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24">
        <div className="text-center mb-16 md:mb-24">
          <SectionLabel className="mx-auto">Build Habits</SectionLabel>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-ink mt-6">Consistency rewarded.</h2>
          <p className="text-muted text-lg mt-4 max-w-2xl mx-auto">Track your daily reading, earn exclusive stickers, and build a lasting reading habit.</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="glass-panel bg-gradient-to-br from-surface/50 to-void border border-white/10 rounded-3xl p-8 md:p-12 max-w-4xl mx-auto backdrop-blur-xl relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 hover:shadow-[0_30px_60px_rgba(0,0,0,0.7)] hover:-translate-y-1"
        >
          {/* Flame Icon */}
          <div className="flex justify-center mb-8 relative z-10">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-t from-ember to-yellow-400 blur-xl opacity-50 rounded-full mix-blend-screen animate-pulse" />
              <Flame className="w-24 h-24 text-ember drop-shadow-[0_0_15px_rgba(245,158,11,0.8)] relative z-10" />
            </div>
          </div>

          <div className="text-center mb-12 relative z-10">
            <h3 className="text-5xl font-bold text-white mb-2 tracking-tight">12 <span className="text-3xl text-indigo-200 font-medium">Days</span></h3>
            <p className="text-muted tracking-wide uppercase text-sm font-semibold">Current Reading Streak</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-12 relative z-10">
            <div className="flex justify-between text-sm text-indigo-300 font-medium mb-3 px-1">
              <span>Day 1</span>
              <span>Day 14</span>
            </div>
            <div className="h-4 bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                whileInView={{ width: '85%' }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-ember via-amber-500 to-yellow-400 rounded-full relative"
              >
                <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30" />
              </motion.div>
            </div>
          </div>

          {/* Stickers */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative z-10">
            {streakData.map((item) => (
              <div 
                key={item.id} 
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300
                  ${item.unlocked 
                    ? 'bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/5 border-indigo-500/30 shadow-[inset_0_0_20px_rgba(99,102,241,0.15),0_5px_15px_rgba(0,0,0,0.2)] cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:border-indigo-400/50' 
                    : 'bg-black/20 border-white/5 opacity-50 grayscale'
                  }`}
              >
                <div className={`w-12 h-12 flex items-center justify-center rounded-full mb-3 shadow-inner
                  ${item.unlocked ? 'bg-gradient-to-br from-surface to-deep border border-white/10' : 'bg-surface/50 border border-white/5'}
                `}>
                  {item.icon}
                </div>
                <span className={`text-xs font-semibold text-center ${item.unlocked ? 'text-indigo-100' : 'text-muted'}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
