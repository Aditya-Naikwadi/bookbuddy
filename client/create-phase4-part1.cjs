const fs = require('fs');
const path = require('path');

const layoutDir = path.join(__dirname, 'src', 'components', 'layout');
const sectionsDir = path.join(__dirname, 'src', 'sections');

fs.mkdirSync(layoutDir, { recursive: true });
fs.mkdirSync(sectionsDir, { recursive: true });

// Navbar
fs.writeFileSync(path.join(layoutDir, 'Navbar.tsx'), `
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, BookOpen } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const links = ['Features', 'E-Books', 'Streaks', 'How It Works'];

  return (
    <header className={cn("fixed top-0 left-0 w-full z-50 transition-all duration-300", scrolled ? "bg-void/80 backdrop-blur-lg border-b border-edge py-4" : "bg-transparent py-6")}>
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-ember" />
          <span className="font-serif text-2xl text-ink">Book<span className="text-ember">Buddy</span></span>
        </div>
        
        <nav className="hidden md:flex items-center gap-8">
          {links.map(link => (
            <a key={link} href={\`#\${link.toLowerCase().replace(/ /g, '-')}\`} className="text-sm font-semibold text-muted hover:text-ink transition-colors">
              {link}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex">
          <Button onClick={() => window.location.href = '/auth/register'}>Start for Free</Button>
        </div>

        <button className="md:hidden text-ink" onClick={() => setMobileOpen(true)}>
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed inset-0 bg-void z-50 flex flex-col p-6"
          >
            <div className="flex justify-end">
              <button onClick={() => setMobileOpen(false)}><X className="w-8 h-8 text-ink" /></button>
            </div>
            <nav className="flex flex-col gap-6 mt-12 text-2xl font-serif">
              {links.map(link => (
                <a key={link} href={\`#\${link.toLowerCase().replace(/ /g, '-')}\`} onClick={() => setMobileOpen(false)} className="text-ink hover:text-ember">
                  {link}
                </a>
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
`);

// Footer
fs.writeFileSync(path.join(layoutDir, 'Footer.tsx'), `
import React from 'react';
import { BookOpen } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-void border-t border-edge py-16">
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-6 h-6 text-ember" />
            <span className="font-serif text-2xl text-ink">Book<span className="text-ember">Buddy</span></span>
          </div>
          <p className="text-muted text-sm leading-relaxed">
            The Library in Your Pocket. Manage your borrowing, read free e-books, and build your reading streak.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-ink mb-4">Product</h4>
          <ul className="space-y-3 text-sm text-muted">
            <li><a href="#features" className="hover:text-ember">Features</a></li>
            <li><a href="#e-books" className="hover:text-ember">E-Books</a></li>
            <li><a href="#streaks" className="hover:text-ember">Streaks</a></li>
            <li><a href="#features" className="hover:text-ember">Lab Booking</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-ink mb-4">Institution</h4>
          <ul className="space-y-3 text-sm text-muted">
            <li><a href="#" className="hover:text-ember">For Libraries</a></li>
            <li><a href="#" className="hover:text-ember">API</a></li>
            <li><a href="#" className="hover:text-ember">Pricing</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-ink mb-4">Company</h4>
          <ul className="space-y-3 text-sm text-muted">
            <li><a href="#" className="hover:text-ember">About</a></li>
            <li><a href="#" className="hover:text-ember">Blog</a></li>
            <li><a href="#" className="hover:text-ember">Contact</a></li>
            <li><a href="#" className="hover:text-ember">Privacy & Terms</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24 mt-16 pt-8 border-t border-edge text-xs text-muted text-center flex flex-col md:flex-row items-center justify-between">
        <p>&copy; {new Date().getFullYear()} BookBuddy. All rights reserved.</p>
      </div>
    </footer>
  );
}
`);

// Hero
fs.writeFileSync(path.join(sectionsDir, 'Hero.tsx'), `
import React, { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../../utils/gsap';
import { Scene } from '../components/three/Scene';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Button } from '../components/ui/Button';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export const Hero = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const reducedMotion = useReducedMotion();

  useGSAP(() => {
    if (reducedMotion || !containerRef.current) return;
    
    gsap.from(".hero-line", {
      y: 40,
      opacity: 0,
      stagger: 0.15,
      duration: 0.8,
      ease: "power3.out",
      delay: 0.2
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top top",
        end: "+=200",
        pin: true,
        scrub: 1,
        onUpdate: (self) => {
          setScrollProgress(self.progress);
        }
      }
    });

    tl.to(textRef.current, {
      y: -80,
      opacity: 0,
    });
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="relative w-full h-[100dvh] overflow-hidden bg-void">
      <div className="absolute inset-0 z-0">
        <Scene scrollProgress={scrollProgress} />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto h-full px-6 md:px-12 xl:px-24 flex flex-col md:flex-row items-center pt-24 md:pt-0 pointer-events-none">
        <div ref={textRef} className="w-full md:w-1/2 md:pr-12 pointer-events-auto mt-auto md:mt-0 pb-12 md:pb-0">
          <SectionLabel className="hero-line">Built for Students</SectionLabel>
          <h1 className="hero-line font-serif text-5xl md:text-7xl lg:text-[96px] leading-[1.1] tracking-tight text-ink mb-6">
            The Library in <br className="hidden md:block"/> Your Pocket.
          </h1>
          <p className="hero-line text-lg text-muted mb-8 max-w-md leading-relaxed">
            Borrow, reserve, read 70,000+ free books, track your streaks, and never miss a due date — all from one beautifully simple dashboard.
          </p>
          <div className="hero-line flex flex-col sm:flex-row items-center gap-4">
            <Button size="lg" className="w-full sm:w-auto" onClick={() => window.location.href='/auth/register'}>Get Started Free</Button>
            <Button variant="ghost" size="lg" className="w-full sm:w-auto">Watch Demo ▶</Button>
          </div>
          <div className="hero-line mt-12 text-sm font-semibold text-muted">
            Trusted by 12,000+ students at 40 institutions
          </div>
        </div>
      </div>
    </section>
  );
}
`);

// TrustBar
fs.writeFileSync(path.join(sectionsDir, 'TrustBar.tsx'), `
import React from 'react';
import { StatCounter } from '../components/ui/StatCounter';

export const TrustBar = () => {
  return (
    <section className="bg-surface py-10 border-y border-edge">
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24">
        <p className="text-center text-sm font-semibold text-muted tracking-wider uppercase mb-8">Trusted At</p>
        <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-16">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="w-32 h-12 bg-deep/50 rounded-lg flex items-center justify-center border border-edge/50">
              <span className="text-xs text-muted/50 font-semibold uppercase">University</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-edge">
          <StatCounter end={12000} suffix="+" label="Students" />
          <StatCounter end={70000} suffix="+" label="E-Books" />
          <StatCounter end={40} label="Institutions" />
        </div>
      </div>
    </section>
  );
}
`);

// Features
fs.writeFileSync(path.join(sectionsDir, 'Features.tsx'), `
import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Bookmark, Book, Clock, CheckCircle, RotateCcw, AlertTriangle, List, Bell, CreditCard, Mail, User, Monitor, MessageSquare, Headphones, FileText } from 'lucide-react';
import { SectionLabel } from '../components/ui/SectionLabel';
import { FeatureCard } from '../components/ui/FeatureCard';
import { AnimatePresence, motion } from 'framer-motion';

const featuresList = [
  { group: "DISCOVER", title: "Advanced Search Filters", desc: "Find exactly what you need with robust category and genre filters.", icon: <Search /> },
  { group: "DISCOVER", title: "Smart Recommendations", desc: "AI-driven suggestions based on your reading history.", icon: <Sparkles /> },
  { group: "DISCOVER", title: "Save Searches & Bookmarks", desc: "Never lose track of the resources you rely on.", icon: <Bookmark /> },
  { group: "DISCOVER", title: "Curated Reading Lists", desc: "Access lists curated by professors and library staff.", icon: <List /> },
  
  { group: "MY BORROWING", title: "Real-Time Availability", desc: "See exactly which copies are on the shelf.", icon: <CheckCircle /> },
  { group: "MY BORROWING", title: "One-Click Renewals", desc: "Extend your borrowing time with a single tap.", icon: <RotateCcw /> },
  { group: "MY BORROWING", title: "Current Browsing Status", desc: "Manage everything you currently have checked out.", icon: <Book /> },
  { group: "MY BORROWING", title: "Browsing History", desc: "Look back at past reads for citations and references.", icon: <Clock /> },
  { group: "MY BORROWING", title: "Queue Tracking", desc: "See your position in line for reserved books.", icon: <List /> },
  { group: "MY BORROWING", title: "Availability Alerts", desc: "Get notified the moment a reserved book is returned.", icon: <Bell /> },
  
  { group: "MY ACCOUNT", title: "Transparent Fine Tracking", desc: "No more surprise fees. See exactly what you owe.", icon: <CreditCard /> },
  { group: "MY ACCOUNT", title: "Automated Dues Reminders", desc: "We'll remind you before anything is due.", icon: <Mail /> },
  { group: "MY ACCOUNT", title: "Digital Patron Card", desc: "Your library ID lives safely in your phone.", icon: <User /> },
  
  { group: "RESOURCES & FACILITIES", title: "Integrated E-Resources", desc: "Read digital content natively inside the app.", icon: <FileText /> },
  { group: "RESOURCES & FACILITIES", title: "Book Computer Lab Seats", desc: "Reserve study spaces and lab computers in advance.", icon: <Monitor /> },
  
  { group: "ENGAGE & SUPPORT", title: "Book Recommendation Request", desc: "Ask the library to purchase new materials.", icon: <MessageSquare /> },
  { group: "ENGAGE & SUPPORT", title: "Feedback System", desc: "Help us improve library services.", icon: <MessageSquare /> },
  { group: "ENGAGE & SUPPORT", title: "Complaint Box", desc: "Direct line to library administration for issues.", icon: <AlertTriangle /> }
];

export const Features = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const cards = document.querySelectorAll('.feature-card-item');
      let current = activeIndex;
      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        if (rect.top < window.innerHeight / 2 && rect.bottom > window.innerHeight / 2) {
          current = index;
        }
      });
      if (current !== activeIndex) setActiveIndex(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeIndex]);

  const activeFeature = featuresList[activeIndex];

  return (
    <section id="features" className="bg-void py-24 md:py-32 xl:py-40 relative">
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24 flex flex-col md:flex-row gap-12">
        <div className="w-full md:w-1/3 relative">
          <div className="md:sticky md:top-32 h-auto md:h-[calc(100vh-16rem)] flex flex-col justify-center">
            <SectionLabel>Everything you need</SectionLabel>
            <h2 className="font-serif text-4xl md:text-5xl text-ink mb-8">The complete library experience.</h2>
            <div className="hidden md:block h-48 relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0"
                >
                  <div className="w-16 h-16 rounded-2xl bg-ember/10 flex items-center justify-center text-ember mb-4 border border-ember/20">
                    {activeFeature.icon}
                  </div>
                  <h3 className="text-2xl font-semibold text-ink mb-2">{activeFeature.title}</h3>
                  <p className="text-muted leading-relaxed">{activeFeature.desc}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
        <div className="w-full md:w-2/3 flex flex-col gap-6 pt-12 md:pt-40 pb-40">
          {featuresList.map((f, i) => (
            <div key={i} className="feature-card-item">
              <FeatureCard 
                label={f.group}
                title={f.title}
                description={f.desc}
                icon={f.icon}
                isActive={i === activeIndex}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`);

// EResources
fs.writeFileSync(path.join(sectionsDir, 'EResources.tsx'), `
import React from 'react';
import { Canvas } from '@react-three/fiber';
import { FeatureBook } from '../components/three/FeatureBook';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Button } from '../components/ui/Button';

export const EResources = () => {
  return (
    <section id="e-books" className="bg-deep py-24 md:py-32 xl:py-40 border-y border-edge">
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24 flex flex-col md:flex-row items-center gap-12">
        <div className="w-full md:w-1/2">
          <SectionLabel>70,000+ FREE BOOKS</SectionLabel>
          <h2 className="font-serif text-4xl md:text-5xl text-ink mb-6">
            Read anything. Anywhere.<br/>No subscription needed.
          </h2>
          <p className="text-muted leading-relaxed text-lg mb-8">
            Powered by Project Gutenberg's public-domain catalog, filtered, searched, and read entirely inside BookBuddy — with your reading progress always saved.
          </p>
          <ul className="space-y-4 mb-8 text-ink font-medium">
            <li className="flex items-center gap-3"><span className="text-success">✓</span> Full in-app PDF & EPUB reader</li>
            <li className="flex items-center gap-3"><span className="text-success">✓</span> Pick up where you left off</li>
            <li className="flex items-center gap-3"><span className="text-success">✓</span> Download for offline reading</li>
            <li className="flex items-center gap-3"><span className="text-success">✓</span> Search by language, genre, author</li>
          </ul>
          <Button variant="secondary" size="lg">Browse the Library →</Button>
        </div>
        <div className="w-full md:w-1/2 h-[500px]">
          <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[2, 5, 2]} intensity={1} />
            <group rotation={[Math.PI / 8, -Math.PI / 6, 0]}>
              {[0, 1, 2, 3, 4].map(i => <FeatureBook key={i} index={i} />)}
            </group>
          </Canvas>
        </div>
      </div>
    </section>
  );
}
`);

console.log('Phase 4 (Part 1) files generated successfully.');
