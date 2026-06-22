import React from 'react';
import { StatCounter } from '../components/ui/StatCounter';
import { motion } from 'framer-motion';

const universities = [
  "Stanford University", "NYU", "University of Toronto", "Oxford", "MIT", "Harvard",
  "Stanford University", "NYU", "University of Toronto", "Oxford", "MIT", "Harvard" // Duplicated for seamless marquee
];

export const TrustBar = () => {
  return (
    <section className="bg-surface py-12 border-y border-edge overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24">
        
        <motion.p 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm font-semibold text-muted tracking-wider uppercase mb-8"
        >
          Trusted At
        </motion.p>
        
        {/* Infinite Marquee */}
        <div className="relative w-full overflow-hidden mb-16 before:absolute before:left-0 before:top-0 before:w-20 before:h-full before:bg-gradient-to-r before:from-surface before:to-transparent before:z-10 after:absolute after:right-0 after:top-0 after:w-20 after:h-full after:bg-gradient-to-l after:from-surface after:to-transparent after:z-10">
          <motion.div 
            animate={{ x: [0, -1035] }}
            transition={{ repeat: Infinity, ease: "linear", duration: 20 }}
            className="flex gap-4 md:gap-8 w-max"
          >
            {universities.map((uni, i) => (
              <div key={i} className="px-6 py-3 bg-deep/50 rounded-lg flex items-center justify-center border border-edge/50 whitespace-nowrap">
                <span className="text-xs md:text-sm text-muted font-semibold uppercase">{uni}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Stats Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-edge"
        >
          <StatCounter end={12000} suffix="+" label="Students" />
          <StatCounter end={70000} suffix="+" label="E-Books" />
          <StatCounter end={40} label="Institutions" />
        </motion.div>

      </div>
    </section>
  );
}
