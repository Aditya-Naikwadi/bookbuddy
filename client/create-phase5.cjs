const fs = require('fs');
const path = require('path');

const mainJsxPath = path.join(__dirname, 'src', 'main.jsx');
let mainCode = '';
try {
  mainCode = fs.readFileSync(mainJsxPath, 'utf-8');
} catch(e) {}

if (!mainCode.includes('Lenis')) {
  const newMainCode = `
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from './utils/gsap'

const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`;
  fs.writeFileSync(mainJsxPath, newMainCode);
}

const landingPath = path.join(__dirname, 'src', 'pages', 'public', 'Landing.jsx');
const landingCode = `
import React, { useEffect } from 'react';
import { ScrollProgress } from '../../components/ui/ScrollProgress';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { Hero } from '../../sections/Hero';
import { TrustBar } from '../../sections/TrustBar';
import { Features } from '../../sections/Features';
import { EResources } from '../../sections/EResources';
import { StreakShowcase } from '../../sections/StreakShowcase';
import { HowItWorks } from '../../sections/HowItWorks';
import { PatronCardSection } from '../../sections/PatronCard';
import { Testimonials } from '../../sections/Testimonials';
import { CTA } from '../../sections/CTA';

const Landing = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="bg-void text-ink min-h-screen font-sans selection:bg-ember/30 selection:text-ember-100 relative">
      <ScrollProgress />
      <Navbar />
      <Hero />
      <TrustBar />
      <Features />
      <EResources />
      <StreakShowcase />
      <HowItWorks />
      <PatronCardSection />
      <Testimonials />
      <CTA />
      <Footer />
    </main>
  );
};

export default Landing;
`;

fs.writeFileSync(landingPath, landingCode);

console.log('Phase 5 completed.');
