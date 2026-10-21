import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  ShieldCheck,
  Layers,
  Users,
  BookCheck,
  BarChart3,
  ArrowRight,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { SectionLabel } from "../components/ui/SectionLabel";
import { Button } from "../components/ui/Button";
import { motion, Variants } from "framer-motion";

const collegeFeatures = [
  {
    icon: <ShieldCheck className="w-6 h-6 text-indigo-400" />,
    title: "Multi-Tenant Campus Isolation",
    desc: "Strict college-level data boundaries ensure student records, catalog circulation, and fine balances remain isolated, private, and FERPA-compliant.",
    accent: "border-indigo-500/20 bg-indigo-500/5",
  },
  {
    icon: <Layers className="w-6 h-6 text-ember" />,
    title: "Automated Circulation & Shelving",
    desc: "Real-time shelf tracking, one-tap loan renewals, reserve queues, and automated hold-expiration notifications without manual librarian overhead.",
    accent: "border-ember/20 bg-ember/5",
  },
  {
    icon: <Users className="w-6 h-6 text-emerald-400" />,
    title: "Roster Sync & Instant Onboarding",
    desc: "Bulk-import student rosters via CSV or direct SIS sync. Pre-approved students activate digital library cards in 60 seconds with their campus ID.",
    accent: "border-emerald-500/20 bg-emerald-500/5",
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-cyan-400" />,
    title: "Circulation Insights & Analytics",
    desc: "Monitor high-demand course reserves, peak lending hours, lost book rates, and student reading streaks with real-time institutional reporting.",
    accent: "border-cyan-500/20 bg-cyan-500/5",
  },
];

const institutionalStats = [
  { value: "100%", label: "Cloud Native (Zero Server Maintenance)" },
  { value: "60 Sec", label: "Student Patron Activation" },
  { value: "70k+", label: "Included Public Domain E-Books" },
  { value: "99.9%", label: "Uptime Guaranteed" },
];

export const ForColleges = () => {
  const navigate = useNavigate();

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  return (
    <section
      id="for-colleges"
      data-section="for-colleges"
      className="bg-void py-24 md:py-32 xl:py-40 relative overflow-hidden border-t border-edge"
      aria-label="For Colleges"
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-indigo-500/10 via-ember/10 to-transparent rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <SectionLabel className="mx-auto">
            CAMPUS & INSTITUTIONAL PARTNERSHIPS
          </SectionLabel>
          <h2 className="font-serif text-2xl sm:text-3xl md:text-5xl lg:text-6xl text-ink mt-4 mb-6 leading-tight hover:brightness-110 transition-all duration-300 cursor-default select-text">
            Empower your campus library with BookBuddy.
          </h2>
          <p className="text-muted text-sm sm:text-base md:text-lg leading-relaxed select-text">
            Modernize circulation, catalog course reserves, and provide students
            with instant mobile access to physical volumes and 70,000+ digital
            titles — all in one multi-tenant institutional platform.
          </p>
        </div>

        {/* Feature Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mb-20"
        >
          {collegeFeatures.map((feat, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              className={`p-6 sm:p-8 rounded-3xl border ${feat.accent} bg-surface/50 backdrop-blur-md hover:border-white/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group flex flex-col cursor-pointer`}
            >
              <div className="w-12 h-12 rounded-2xl bg-surface border border-edge flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                {feat.icon}
              </div>
              <h3 className="font-serif text-xl sm:text-2xl text-ink font-semibold mb-3 group-hover:text-ember transition-colors duration-300">
                {feat.title}
              </h3>
              <p className="text-muted leading-relaxed text-sm md:text-base group-hover:text-slate-200 transition-colors duration-300">
                {feat.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-16">
          {institutionalStats.map((stat, i) => (
            <div
              key={i}
              className="glass-panel p-5 sm:p-6 rounded-2xl border border-edge text-center bg-surface/30 hover:border-ember/40 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group cursor-pointer"
            >
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-ink mb-1 font-serif group-hover:text-ember transition-colors duration-300 select-text">
                {stat.value}
              </div>
              <div className="text-xs md:text-sm text-muted font-medium group-hover:text-ink transition-colors duration-300 select-text">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Institutional Call To Action Banner */}
        <div className="glass-panel rounded-3xl border border-indigo-500/20 p-8 md:p-12 bg-gradient-to-r from-indigo-950/40 via-surface/60 to-void flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
          <div className="max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-4">
              <GraduationCap className="w-3.5 h-3.5" />
              For Deans, Librarians & IT Directors
            </div>
            <h3 className="font-serif text-2xl md:text-3xl text-ink font-semibold mb-3">
              Ready to onboard your college?
            </h3>
            <p className="text-muted text-sm md:text-base leading-relaxed">
              Register your institution today or speak with our institutional
              onboarding team for automated SIS integration and dedicated
              migration support.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <Button
              size="lg"
              className="w-full sm:w-auto shadow-lg shadow-indigo-500/20"
              onClick={() => navigate("/auth/register")}
            >
              Register Your College <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => navigate("/support")}
            >
              Contact Support
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
