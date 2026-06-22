import React, { useRef } from 'react';
import { Search, Sparkles, Bookmark, Book, Clock, CheckCircle, RotateCcw, AlertTriangle, List, Bell, CreditCard, Mail, User, Monitor, MessageSquare, FileText } from 'lucide-react';
import { SectionLabel } from '../components/ui/SectionLabel';
import { motion, useScroll, useTransform } from 'framer-motion';

const bentoBlocks = [
  {
    colSpan: "col-span-1 md:col-span-2 lg:col-span-2",
    rowSpan: "row-span-2",
    group: "DISCOVER",
    title: "AI-Powered Discovery",
    desc: "Find exactly what you need with robust category filters and AI-driven recommendations based on your reading history. Save searches and curate custom reading lists for your classes.",
    icons: [<Search key="1" />, <Sparkles key="2" />, <Bookmark key="3" />],
    accent: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-[inset_0_0_20px_rgba(79,70,229,0.1)]",
    bgGradient: "bg-gradient-to-br from-indigo-500/5 to-transparent",
    glowColor: "bg-indigo-500",
    borderColor: "group-hover:border-indigo-500/30"
  },
  {
    colSpan: "col-span-1 md:col-span-1 lg:col-span-1",
    rowSpan: "row-span-1",
    group: "MY BORROWING",
    title: "Real-Time Tracking",
    desc: "See exact shelf availability and queue positions.",
    icons: [<CheckCircle key="1" />],
    accent: "bg-success/10 text-success border-success/20 shadow-[inset_0_0_20px_rgba(22,163,74,0.1)]",
    bgGradient: "bg-gradient-to-br from-success/5 to-transparent",
    glowColor: "bg-success",
    borderColor: "group-hover:border-success/30"
  },
  {
    colSpan: "col-span-1 md:col-span-1 lg:col-span-1",
    rowSpan: "row-span-1",
    group: "MY BORROWING",
    title: "One-Click Renew",
    desc: "Extend your borrowing time with a single tap.",
    icons: [<RotateCcw key="1" />],
    accent: "bg-ember/10 text-ember border-ember/20 shadow-[inset_0_0_20px_rgba(217,119,6,0.1)]",
    bgGradient: "bg-gradient-to-br from-ember/5 to-transparent",
    glowColor: "bg-ember",
    borderColor: "group-hover:border-ember/30"
  },
  {
    colSpan: "col-span-1 md:col-span-2 lg:col-span-2",
    rowSpan: "row-span-1",
    group: "MY ACCOUNT",
    title: "Transparent Fines & Reminders",
    desc: "No more surprise fees. See exactly what you owe and get automated email reminders before any book is due.",
    icons: [<CreditCard key="1" />, <Mail key="2" />],
    accent: "bg-danger/10 text-danger border-danger/20 shadow-[inset_0_0_20px_rgba(220,38,38,0.1)]",
    bgGradient: "bg-gradient-to-br from-danger/5 to-transparent",
    glowColor: "bg-danger",
    borderColor: "group-hover:border-danger/30"
  },
  {
    colSpan: "col-span-1 md:col-span-2 lg:col-span-2",
    rowSpan: "row-span-1",
    group: "RESOURCES & FACILITIES",
    title: "E-Resources & Lab Booking",
    desc: "Read digital content natively inside the app, and reserve study spaces or lab computers weeks in advance.",
    icons: [<FileText key="1" />, <Monitor key="2" />],
    accent: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]",
    bgGradient: "bg-gradient-to-br from-cyan-500/5 to-transparent",
    glowColor: "bg-cyan-500",
    borderColor: "group-hover:border-cyan-500/30"
  },
  {
    colSpan: "col-span-1 md:col-span-1 lg:col-span-1",
    rowSpan: "row-span-2",
    group: "MY ACCOUNT",
    title: "Digital Card",
    desc: "Your library ID lives safely in your phone.",
    icons: [<User key="1" className="w-12 h-12" />],
    accent: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20 shadow-[inset_0_0_20px_rgba(217,70,239,0.1)]",
    centerIcon: true,
    bgGradient: "bg-gradient-to-br from-fuchsia-500/5 to-transparent",
    glowColor: "bg-fuchsia-500",
    borderColor: "group-hover:border-fuchsia-500/30"
  },
  {
    colSpan: "col-span-1 md:col-span-1 lg:col-span-1",
    rowSpan: "row-span-1",
    group: "SUPPORT",
    title: "Direct Feedback",
    desc: "Request new books or report issues directly to admin.",
    icons: [<MessageSquare key="1" />],
    accent: "bg-teal-500/10 text-teal-400 border-teal-500/20 shadow-[inset_0_0_20px_rgba(20,184,166,0.1)]",
    bgGradient: "bg-gradient-to-br from-teal-500/5 to-transparent",
    glowColor: "bg-teal-500",
    borderColor: "group-hover:border-teal-500/30"
  }
];

export const Features = () => {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });
  const glowY = useTransform(scrollYProgress, [0, 1], [-200, 200]);

  return (
    <section ref={containerRef} id="features" className="bg-void py-16 md:py-24 relative overflow-hidden">
      {/* Decorative background glow */}
      <motion.div style={{ y: glowY }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-indigo-500/5 to-fuchsia-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12 xl:px-24">
        <div className="text-center mb-12 md:mb-16">
          <SectionLabel className="mx-auto">Everything you need</SectionLabel>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-ink mt-4">The complete library experience.</h2>
        </div>

        {/* Masonry Layout (Pinterest Style) */}
        <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 md:gap-6 space-y-4 md:space-y-6">
          {bentoBlocks.map((block, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`break-inside-avoid glass-panel glass-panel-hover rounded-3xl p-6 md:p-8 flex flex-col group ${block.bgGradient} ${block.borderColor} relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 mb-4 md:mb-6 h-auto min-h-[220px]`}
            >
              {/* Colored radial gradient on hover */}
              <div className={`absolute -top-32 -left-32 w-64 h-64 ${block.glowColor} opacity-0 group-hover:opacity-15 transition-opacity duration-700 rounded-full blur-[80px] pointer-events-none`} />
              
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className={`flex items-center gap-2 p-3 rounded-2xl border ${block.accent} ${block.centerIcon ? 'mx-auto mt-4' : ''}`}>
                  {block.icons}
                </div>
              </div>
              
              <div className={`mt-auto relative z-10 ${block.centerIcon ? 'text-center' : ''}`}>
                <span className="text-[11px] font-bold tracking-widest text-muted uppercase mb-2 block">{block.group}</span>
                <h3 className="text-xl md:text-2xl font-semibold text-ink mb-3 transition-colors">{block.title}</h3>
                <p className="text-muted leading-relaxed text-sm md:text-base">{block.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
