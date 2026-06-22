import React from 'react';
import { cn } from '../utils/cn';
import { motion, Variants } from 'framer-motion';

export const HowItWorks = () => {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 80, damping: 20 } }
  };

  return (
    <section id="how-it-works" className="bg-surface py-24 md:py-32 xl:py-40 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="font-serif text-4xl md:text-5xl text-ink mb-4">How it works</h2>
          <p className="text-muted text-lg max-w-xl mx-auto">Get started in seconds, not hours.</p>
        </motion.div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col md:flex-row gap-12 md:gap-8 relative"
        >
          {/* Animated Connecting Line */}
          <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-[2px] bg-edge">
            <motion.div 
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
              viewport={{ once: true }}
              className="h-full bg-ember w-full origin-left" 
            />
          </div>

          {[
            { num: "1", title: "Register with your student ID", desc: "Takes 60 seconds. Your institution's book catalog appears immediately — no setup, no waiting." },
            { num: "2", title: "Search, borrow, and read", desc: "Physical books reserved with one tap. 70,000+ e-books readable right in the app — PDF or EPUB." },
            { num: "3", title: "Build your streak", desc: "Come back daily to read, borrow, or return. Earn stickers, unlock rewards, and hit milestones that actually mean something." }
          ].map((step, i) => (
            <motion.div key={i} variants={itemVariants} className="flex-1 relative bg-surface p-6 rounded-2xl border border-edge z-10 text-center shadow-lg hover:border-ember/50 transition-colors">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-[120px] font-serif text-ember opacity-10 leading-none select-none">{step.num}</div>
              <div className="w-12 h-12 bg-ember text-white rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-6 relative z-20 shadow-[0_0_20px_rgba(217,119,6,0.4)]">{step.num}</div>
              <h3 className="text-xl font-semibold text-ink mb-3">{step.title}</h3>
              <p className="text-muted text-sm leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
