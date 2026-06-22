
import React from 'react';
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { useInView } from '../hooks/useInView';

export const Testimonials = () => {
  const { ref, isInView } = useInView({ threshold: 0.2 });

  return (
    <section className="bg-void py-24 md:py-32 xl:py-40">
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24">
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl text-ink">Don't just take our word for it</h2>
        </div>
        
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { name: "Michael Chang", inst: "Stanford University", text: "BookBuddy completely changed how I use the library. The availability alerts alone saved my finals week." },
            { name: "Jessica Smith", inst: "NYU", text: "I love the streaks feature! It actually motivates me to read the public domain books during my commute." },
            { name: "David Osei", inst: "University of Toronto", text: "Having my patron card on my phone means I never have to dig through my wallet at the self-checkout kiosk again." }
          ].map((t, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className="glass-panel glass-panel-hover rounded-2xl p-8 cursor-default"
            >
              <div className="flex gap-1 text-ember mb-4">
                {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 fill-current" />)}
              </div>
              <blockquote className="text-ink leading-relaxed mb-6">"{t.text}"</blockquote>
              <div>
                <div className="font-semibold text-sm text-ink">{t.name}</div>
                <div className="text-xs text-muted mt-1 uppercase tracking-wider">{t.inst}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
