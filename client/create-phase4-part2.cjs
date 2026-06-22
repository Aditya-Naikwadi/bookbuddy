const fs = require('fs');
const path = require('path');
const sectionsDir = path.join(__dirname, 'src', 'sections');

// StreakShowcase
fs.writeFileSync(path.join(sectionsDir, 'StreakShowcase.tsx'), `
import React from 'react';
import { Flame, Trophy, Star, BookOpen, Clock, Calendar } from 'lucide-react';
import { StatCounter } from '../components/ui/StatCounter';
import { StickerCard } from '../components/ui/StickerCard';

export const StreakShowcase = () => {
  return (
    <section id="streaks" className="bg-void py-24 md:py-32 xl:py-40">
      <div className="max-w-[900px] mx-auto px-6">
        <div className="flex flex-col items-center mb-16">
          <Flame className="w-24 h-24 text-ember mb-4" />
          <StatCounter end={42} label="Day Streak" />
        </div>

        <div className="mb-16">
          <div className="flex justify-between text-xs font-semibold text-muted mb-2">
            <span>42 Days</span>
            <span>Next: 60 Days</span>
          </div>
          <div className="w-full h-3 bg-surface rounded-full overflow-hidden">
            <div className="h-full bg-ember w-[70%]"></div>
          </div>
          <div className="flex justify-between text-xs text-muted mt-2 px-1">
            <span>3</span><span>7</span><span>14</span><span>30</span><span>60</span><span>100</span><span>365</span>
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-16" role="list">
          <StickerCard title="Bookworm" description="7 Days" icon={<BookOpen/>} unlocked={true} />
          <StickerCard title="1st Chapter" description="14 Days" icon={<Star/>} unlocked={true} />
          <StickerCard title="Warrior" description="30 Days" icon={<Trophy/>} unlocked={true} />
          <StickerCard title="Master" description="60 Days" icon={<Trophy/>} unlocked={false} />
          <StickerCard title="Explorer" description="100 Days" icon={<Star/>} unlocked={false} />
          <StickerCard title="Legend" description="365 Days" icon={<Flame/>} unlocked={false} />
        </div>

        <div className="bg-surface border border-edge rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-deep border-b border-edge">
                <th className="px-6 py-4 text-muted font-semibold">Days</th>
                <th className="px-6 py-4 text-muted font-semibold">Reward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              <tr><td className="px-6 py-4 font-semibold text-ember">7</td><td className="px-6 py-4 text-ink">+1 Freeze + Bonus Renewal</td></tr>
              <tr><td className="px-6 py-4 font-semibold text-ember">14</td><td className="px-6 py-4 text-ink">Custom Patron Card Theme</td></tr>
              <tr><td className="px-6 py-4 font-semibold text-ember">30</td><td className="px-6 py-4 text-ink">Fine-Waiver Coupon + Certificate</td></tr>
              <tr><td className="px-6 py-4 font-semibold text-muted">60</td><td className="px-6 py-4 text-muted">Early Access to New Arrivals</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
`);

// HowItWorks
fs.writeFileSync(path.join(sectionsDir, 'HowItWorks.tsx'), `
import React from 'react';
import { cn } from '../../utils/cn';

export const HowItWorks = () => {
  return (
    <section id="how-it-works" className="bg-surface py-24 md:py-32 xl:py-40">
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24">
        <div className="text-center mb-20">
          <h2 className="font-serif text-4xl md:text-5xl text-ink mb-4">How it works</h2>
          <p className="text-muted text-lg max-w-xl mx-auto">Get started in seconds, not hours.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-12 md:gap-8 relative">
          
          <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-[2px] bg-edge">
            <div className="h-full bg-ember w-full origin-left" />
          </div>

          {[
            { num: "1", title: "Register with your student ID", desc: "Takes 60 seconds. Your institution's book catalog appears immediately — no setup, no waiting." },
            { num: "2", title: "Search, borrow, and read", desc: "Physical books reserved with one tap. 70,000+ e-books readable right in the app — PDF or EPUB." },
            { num: "3", title: "Build your streak", desc: "Come back daily to read, borrow, or return. Earn stickers, unlock rewards, and hit milestones that actually mean something." }
          ].map((step, i) => (
            <div key={i} className="flex-1 relative bg-surface p-6 rounded-2xl border border-edge z-10 text-center">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-[120px] font-serif text-ember opacity-10 leading-none select-none">{step.num}</div>
              <div className="w-12 h-12 bg-ember text-white rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-6 relative z-20 shadow-[0_0_20px_rgba(217,119,6,0.4)]">{step.num}</div>
              <h3 className="text-xl font-semibold text-ink mb-3">{step.title}</h3>
              <p className="text-muted text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`);

// PatronCard
fs.writeFileSync(path.join(sectionsDir, 'PatronCard.tsx'), `
import React from 'react';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Button } from '../components/ui/Button';

export const PatronCardSection = () => {
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
        <div className="w-full md:w-1/2 flex justify-center" style={{ perspective: '1000px' }}>
          <div className="relative w-full max-w-[400px] aspect-[1.586/1] transition-transform duration-700 group cursor-pointer" style={{ transformStyle: 'preserve-3d' }}>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-900 p-6 shadow-2xl border border-indigo-400/30 flex flex-col justify-between group-hover:opacity-0 transition-opacity duration-300">
              <div className="flex justify-between items-start">
                <span className="font-serif text-xl text-white">BookBuddy</span>
                <div className="w-12 h-12 bg-white/20 rounded-full" />
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-indigo-200 text-xs mb-1">PATRON</p>
                  <p className="text-white text-lg font-semibold tracking-wider">SARAH JENKINS</p>
                  <p className="text-indigo-200 text-sm font-mono mt-1">ID: 8493 2049 1194</p>
                </div>
                <div className="w-16 h-16 bg-white rounded flex items-center justify-center p-1">
                  <div className="w-full h-full bg-[repeating-linear-gradient(45deg,#000_0_2px,#fff_2px_4px)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
`);

// Testimonials
fs.writeFileSync(path.join(sectionsDir, 'Testimonials.tsx'), `
import React from 'react';
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { useInView } from '../../hooks/useInView';

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
              className="bg-surface border border-edge rounded-2xl p-8"
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
`);

// CTA
fs.writeFileSync(path.join(sectionsDir, 'CTA.tsx'), `
import React from 'react';
import { Button } from '../components/ui/Button';

export const CTA = () => {
  return (
    <section className="bg-ember py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <h2 className="font-serif text-4xl md:text-6xl text-white mb-6">Your library. Upgraded.</h2>
        <p className="text-ember-100 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
          Join 12,000 students who never miss a due date, never lose a book, and never waste a library visit.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="bg-white text-ember hover:bg-slate-50 w-full sm:w-auto" onClick={() => window.location.href='/auth/register'}>Get Started Free</Button>
          <Button size="lg" className="bg-transparent border border-white text-white hover:bg-white/10 w-full sm:w-auto">Talk to Us</Button>
        </div>
      </div>
    </section>
  );
}
`);

console.log('Phase 4 (Part 2) generated successfully.');
