import React, { useState, useEffect, useRef } from 'react';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';

export const EResources = () => {
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    }, { threshold: 0.1 });
    
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="e-books" className="bg-deep py-24 md:py-32 xl:py-40 border-y border-edge" ref={containerRef}>
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24 flex flex-col md:flex-row items-center gap-12 overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="w-full md:w-1/2"
        >
          <SectionLabel>70,000+ FREE BOOKS</SectionLabel>
          <h2 className="font-serif text-4xl md:text-5xl text-ink mb-6">
            Read anything. Anywhere.<br/>No subscription needed.
          </h2>
          <p className="text-muted leading-relaxed text-lg mb-8">
            Powered by Project Gutenberg's public-domain catalog, filtered, searched, and read entirely inside BookBuddy — with your reading progress always saved.
          </p>
          <ul className="space-y-4 mb-8 text-ink font-medium">
            <li className="flex items-center gap-3"><span className="text-success text-xl">✓</span> Full in-app PDF & EPUB reader</li>
            <li className="flex items-center gap-3"><span className="text-success text-xl">✓</span> Pick up where you left off</li>
            <li className="flex items-center gap-3"><span className="text-success text-xl">✓</span> Download for offline reading</li>
            <li className="flex items-center gap-3"><span className="text-success text-xl">✓</span> Search by language, genre, author</li>
          </ul>
          <Button variant="secondary" size="lg">Browse the Library →</Button>
        </motion.div>
        
        <div className="w-full md:w-1/2 h-[500px] relative flex items-center justify-center perspective-1000 group cursor-pointer">
          <div className={`relative w-full max-w-sm aspect-[3/4] transition-all duration-1000 ease-out transform-style-3d group-hover:scale-105 group-hover:rotate-y-[-5deg] ${inView ? 'rotate-y-[-15deg]' : 'rotate-y-0 translate-y-12 opacity-0'}`}>
            
            {/* Book 3 (Back) */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-800 to-indigo-950 rounded-r-2xl rounded-l-md shadow-2xl border border-indigo-900 border-l-4 border-l-indigo-900/50 transform translate-x-12 translate-y-6 -z-20 rotate-6" />
            
            {/* Book 2 (Middle) */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 rounded-r-2xl rounded-l-md shadow-2xl border border-slate-800 border-l-4 border-l-slate-800/50 transform translate-x-6 translate-y-3 -z-10 rotate-3" />
            
            {/* Book 1 (Front) */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1E202E] to-[#0A0D15] rounded-r-3xl rounded-l-md shadow-[20px_20px_60px_rgba(0,0,0,0.8),-5px_0_20px_rgba(255,255,255,0.05)] border border-white/5 flex flex-col z-0 overflow-hidden">
              
              {/* Spine Gradient highlight */}
              <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/60 via-white/10 to-transparent z-10 pointer-events-none" />
              <div className="absolute inset-y-0 left-8 w-px bg-white/10 z-10" />

              {/* Cover Texture */}
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>

              <div className="flex flex-col h-full p-10 pl-14 relative z-20">
                <div className="w-12 h-1 bg-gradient-to-r from-ember to-ember-glow mb-12 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                <div className="text-sm font-bold tracking-widest text-indigo-300 uppercase mb-4">Science Fiction</div>
                <h3 className="font-serif text-5xl text-white leading-tight mb-auto drop-shadow-md">The Time<br/>Machine</h3>
                <div className="flex items-center gap-3 mt-8">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border border-white/20 shadow-inner" />
                  <span className="text-sm text-indigo-100 font-medium tracking-wide">H.G. Wells</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}