import React, { useRef } from 'react';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Button } from '../components/ui/Button';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export const PatronCardSection = () => {
  const cardRef = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["17.5deg", "-17.5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-17.5deg", "17.5deg"]);
  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <section className="bg-deep py-24 md:py-32 xl:py-40">
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24 flex flex-col md:flex-row items-center gap-16">
        <div className="w-full md:w-1/2">
          <SectionLabel>YOUR LIBRARY IDENTITY</SectionLabel>
          <h2 className="font-serif text-4xl md:text-5xl text-ink mb-6">One card. Every access point.</h2>
          <p className="text-muted text-lg leading-relaxed mb-8">
            Your digital patron card is always in your pocket. Show it at the desk, scan the QR at self-checkout, or download it for offline access.
          </p>
          <Button variant="secondary" size="lg">Get Your Card →</Button>
        </div>
        
        <div className="w-full md:w-1/2 flex justify-center" style={{ perspective: '1200px' }}>
          <motion.div 
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
            className="relative w-full max-w-[400px] aspect-[1.586/1] cursor-pointer group"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-900 p-6 shadow-2xl border border-indigo-400/30 flex flex-col justify-between overflow-hidden">
              
              {/* Dynamic Glare */}
              <motion.div 
                className="absolute inset-0 z-10 pointer-events-none mix-blend-overlay opacity-0 group-hover:opacity-40 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at var(--gx) var(--gy), rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 60%)`,
                  // @ts-ignore
                  '--gx': glareX, '--gy': glareY
                }}
              />

              <div className="flex justify-between items-start relative z-20" style={{ transform: "translateZ(30px)" }}>
                <span className="font-serif text-xl text-white">BookBuddy</span>
                <div className="w-12 h-12 bg-white/20 rounded-full backdrop-blur-md border border-white/30" />
              </div>
              
              <div className="flex justify-between items-end relative z-20" style={{ transform: "translateZ(40px)" }}>
                <div>
                  <p className="text-indigo-200 text-xs mb-1 font-semibold tracking-widest">PATRON</p>
                  <p className="text-white text-lg font-bold tracking-wider">PRADNYA PAWAR</p>
                  <p className="text-indigo-200 text-sm font-mono mt-1 opacity-80">ID: 8493 2049 1194</p>
                </div>
                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center p-1 shadow-lg">
                  <div className="w-full h-full bg-[repeating-linear-gradient(45deg,#000_0_2px,#fff_2px_4px)] rounded-sm opacity-90" />
                </div>
              </div>

            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
}
