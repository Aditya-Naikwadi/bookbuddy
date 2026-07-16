import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { motion, useScroll, useTransform, Variants } from 'framer-motion';
import { Button } from '../components/ui/Button';

export const CTA = () => {
  const containerRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  
  // Parallax effects for the background elements
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [-50, 50]);
  const opacityFade = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 1, 0.3]);

  // Framer motion variants for staggered text animation
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.2 }
    }
  };

  const wordVariants: Variants = {
    hidden: { opacity: 0, y: 40, filter: "blur(10px)", scale: 0.9 },
    visible: { 
      opacity: 1, 
      y: 0, 
      filter: "blur(0px)",
      scale: 1,
      transition: { duration: 0.8, ease: [0.215, 0.61, 0.355, 1] } 
    }
  };

  return (
    <section 
      ref={containerRef} 
      className="relative overflow-hidden py-32 md:py-48 lg:py-56 bg-void flex items-center justify-center min-h-[80vh]"
    >
      {/* 1. Dynamic Background Layer */}
      <div className="absolute inset-0 bg-ember/10 mix-blend-screen" />
      
      {/* Interactive Glowing Orb 1 */}
      <motion.div
        style={{ y: y1 }}
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.4, 0.6, 0.4]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 right-[10%] w-[30vw] h-[30vw] rounded-full bg-ember/30 blur-[120px] pointer-events-none"
      />
      
      {/* Interactive Glowing Orb 2 */}
      <motion.div
        style={{ y: y2 }}
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-[-10%] left-[5%] w-[40vw] h-[40vw] rounded-full bg-amber-600/20 blur-[150px] pointer-events-none"
      />

      {/* Noise Texture Overlay for Premium Feel */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay pointer-events-none" />

      {/* 2. Main Content Container */}
      <motion.div 
        style={{ opacity: opacityFade }}
        className="max-w-5xl mx-auto px-6 relative z-10 text-center flex flex-col items-center"
      >
        {/* Animated Heading */}
        <motion.h2
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="font-serif text-6xl md:text-8xl lg:text-[7rem] text-white tracking-tight leading-[1.1] mb-8 flex flex-wrap justify-center gap-x-4 md:gap-x-6 drop-shadow-xl"
        >
          {"Your library. Upgraded.".split(' ').map((word, i) => (
            <motion.span 
              key={i} 
              variants={wordVariants}
              className="inline-block"
            >
              {word}
            </motion.span>
          ))}
        </motion.h2>

        {/* Animated Subtitle */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
          className="text-white/80 text-xl md:text-3xl mb-14 font-medium max-w-2xl mx-auto drop-shadow-md leading-relaxed"
        >
          Join thousands of students managing their resources smarter.
        </motion.p>
        
        {/* Animated Buttons */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 1.1, duration: 0.6, type: "spring", stiffness: 200, damping: 20 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full sm:w-auto"
        >
          <Button 
            size="lg" 
            className="w-full sm:w-auto bg-white text-void hover:bg-white/90 hover:scale-[1.02] transition-transform duration-300 shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] px-10 h-16 text-lg rounded-xl"
            onClick={() => {
              if (isAuthenticated && user) {
                const role = user.role;
                if (role === 'college-admin') navigate('/college-admin');
                else if (role === 'general') navigate('/general-dashboard');
                else if (role === 'super-admin') navigate('/admin-portal');
                else navigate('/student-dashboard');
              } else {
                const hadAccount = localStorage.getItem('bookbuddy_had_account') === 'true';
                if (hadAccount) {
                  navigate('/auth/login');
                } else {
                  navigate('/auth/register');
                }
              }
            }}
          >
            Create Free Account
          </Button>
          <Button 
            variant="ghost" 
            size="lg" 
            className="w-full sm:w-auto text-white hover:bg-white/10 border border-white/20 hover:border-white/50 px-10 h-16 text-lg rounded-xl transition-all duration-300 backdrop-blur-md"
          >
            Contact Sales
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
};