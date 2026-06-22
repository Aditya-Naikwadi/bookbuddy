const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const hooksDir = path.join(srcDir, 'hooks');
const uiDir = path.join(srcDir, 'components', 'ui');

fs.mkdirSync(hooksDir, { recursive: true });
fs.mkdirSync(uiDir, { recursive: true });

// Hooks
fs.writeFileSync(path.join(hooksDir, 'useReducedMotion.ts'), `
import { useState, useEffect } from 'react';

export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersReducedMotion;
}
`);

fs.writeFileSync(path.join(hooksDir, 'useLenis.ts'), `
import { useEffect } from 'react';
import Lenis from 'lenis';

let lenisInstance: Lenis | null = null;

export const initLenis = () => {
  if (lenisInstance) return lenisInstance;
  lenisInstance = new Lenis({ lerp: 0.1, smoothWheel: true });
  return lenisInstance;
};

export const getLenis = () => lenisInstance;

export function useLenis(callback?: (e: any) => void) {
  useEffect(() => {
    if (!lenisInstance) return;
    if (callback) {
      lenisInstance.on('scroll', callback);
      return () => {
        lenisInstance?.off('scroll', callback);
      };
    }
  }, [callback]);
  
  return lenisInstance;
}
`);

fs.writeFileSync(path.join(hooksDir, 'useInView.ts'), `
import { useState, useEffect, useRef } from 'react';

export function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<any>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
      }
    }, { threshold: 0.1, ...options });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [options]);

  return { ref, isInView };
}
`);

fs.writeFileSync(path.join(hooksDir, 'useScrollProgress.ts'), `
import { useState, useEffect } from 'react';

export function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollTop;
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setProgress(totalScroll / windowHeight);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return progress;
}
`);

// UI Components
fs.writeFileSync(path.join(uiDir, 'Button.tsx'), `
import React from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ className, variant = 'primary', size = 'md', ...props }) => {
  const base = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember";
  const variants = {
    primary: "bg-ember text-white hover:bg-ember-glow",
    secondary: "bg-indigo text-white hover:bg-indigo-600",
    ghost: "text-ink hover:bg-surface border border-edge",
  };
  const sizes = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-6 text-base",
    lg: "h-14 px-8 text-lg",
  };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
`);

fs.writeFileSync(path.join(uiDir, 'Badge.tsx'), `
import React from 'react';
import { cn } from '../../utils/cn';

export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className, ...props }) => {
  return <span className={cn("inline-flex items-center rounded-full bg-ember/10 px-2.5 py-0.5 text-xs font-semibold text-ember", className)} {...props} />;
}
`);

fs.writeFileSync(path.join(uiDir, 'SectionLabel.tsx'), `
import React from 'react';
import { cn } from '../../utils/cn';

export const SectionLabel: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => {
  return <p className={cn("text-xs font-bold text-ember uppercase tracking-wider mb-2", className)} {...props} />;
}
`);

fs.writeFileSync(path.join(uiDir, 'FeatureCard.tsx'), `
import React from 'react';
import { cn } from '../../utils/cn';
import { useInView } from '../../hooks/useInView';

interface Props {
  label: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isActive?: boolean;
}

export const FeatureCard: React.FC<Props> = ({ label, title, description, icon, isActive }) => {
  const { ref, isInView } = useInView({ threshold: 0.5 });
  
  return (
    <div 
      ref={ref}
      className={cn(
        "p-6 rounded-2xl border transition-all duration-500",
        isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
        isActive ? "border-ember bg-surface shadow-lg" : "border-edge bg-void"
      )}
    >
      <div className="flex items-center gap-4 mb-3">
        <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-ember border border-edge">
          {icon}
        </div>
        <div>
          <span className="text-xs font-bold text-ember uppercase tracking-wider">{label}</span>
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
        </div>
      </div>
      <p className="text-muted leading-relaxed">{description}</p>
    </div>
  );
}
`);

fs.writeFileSync(path.join(uiDir, 'StickerCard.tsx'), `
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
`);

fs.writeFileSync(path.join(uiDir, 'StatCounter.tsx'), `
import React, { useEffect, useState } from 'react';
import { useInView } from '../../hooks/useInView';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export const StatCounter: React.FC<{ end: number, suffix?: string, label: string }> = ({ end, suffix = '', label }) => {
  const { ref, isInView } = useInView({ threshold: 0.1 });
  const reducedMotion = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (isInView) {
      if (reducedMotion) {
        setCount(end);
        return;
      }
      
      let start = 0;
      const duration = 2000;
      const startTime = performance.now();
      
      const update = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutQuart
        const ease = 1 - Math.pow(1 - progress, 4);
        setCount(Math.floor(ease * end));
        
        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          setCount(end);
        }
      };
      requestAnimationFrame(update);
    }
  }, [isInView, end, reducedMotion]);

  return (
    <div ref={ref} className="text-center" aria-live="polite">
      <div className="text-4xl md:text-5xl font-serif text-ink mb-2">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-sm font-semibold text-muted tracking-wider uppercase">{label}</div>
    </div>
  );
}
`);

fs.writeFileSync(path.join(uiDir, 'ScrollProgress.tsx'), `
import React from 'react';
import { useScrollProgress } from '../../hooks/useScrollProgress';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export const ScrollProgress = () => {
  const progress = useScrollProgress();
  const reducedMotion = useReducedMotion();

  if (reducedMotion) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-1 bg-void z-[100]">
      <div 
        className="h-full bg-ember origin-left transition-transform duration-100 ease-out"
        style={{ transform: \`scaleX(\${progress})\` }}
      />
    </div>
  );
}
`);

console.log('Phase 2 files generated successfully.');
