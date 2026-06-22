import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, BookOpen, Sun, Moon } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { useLenisContext } from '../../context/LenisContext';
import { useTheme } from '../../context/ThemeContext';

const NAV_ITEMS = [
  { label: 'Features',   target: '#features'  },
  { label: 'E-Books',    target: '#e-books' },
  { label: 'Streaks',    target: '#streak'     },
  { label: 'How It Works', target: '#how-it-works' },
];

export const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const lenisRef = useLenisContext();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (target: string) => {
    lenisRef?.current?.scrollTo(target, {
      offset: -80,
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
  };

  return (
    <header 
      className={cn("fixed top-0 w-full z-[100] transition-all duration-300", scrolled ? "glass-panel py-3" : "bg-transparent py-5")} 
      role="navigation" 
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#FAF6EC] border border-ember/20 flex items-center justify-center relative shadow-sm">
            <img 
              src="/favicon.png" 
              alt="BookBuddy Mascot" 
              className="w-full h-full object-cover" 
            />
          </div>
          <span className="font-serif text-2xl text-ink">Book<span className="text-ember">Buddy</span></span>
        </div>
        
        <nav className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map(({ label, target }) => (
            <button key={target} onClick={() => scrollTo(target)} className="text-sm font-semibold text-muted hover:text-ember transition-all duration-200 hover:-translate-y-0.5" aria-label={`Scroll to ${label} section`}>
              {label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <button 
            onClick={toggleTheme} 
            className="p-2 rounded-full hover:bg-surface/60 text-muted hover:text-ember transition-colors"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <Button onClick={() => window.location.href = '/auth/register'}>Start for Free</Button>
        </div>

        <div className="md:hidden flex items-center gap-4">
          <button 
            onClick={toggleTheme} 
            className="p-2 text-ink"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button className="text-ink" aria-label="Open mobile menu" onClick={() => setMobileOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed inset-0 bg-void z-50 flex flex-col p-6"
          >
            <div className="flex justify-end">
              <button aria-label="Close mobile menu" onClick={() => setMobileOpen(false)}><X className="w-8 h-8 text-ink" /></button>
            </div>
            <nav className="flex flex-col gap-6 mt-12 text-2xl font-serif">
              {NAV_ITEMS.map(({ label, target }) => (
                <button key={target} onClick={() => { setMobileOpen(false); scrollTo(target); }} className="text-left text-ink hover:text-ember transition-all duration-200 hover:translate-x-2 w-full">
                  {label}
                </button>
              ))}
            </nav>
            <div className="mt-auto mb-12">
              <Button className="w-full" size="lg" onClick={() => window.location.href = '/auth/register'}>Start for Free</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
