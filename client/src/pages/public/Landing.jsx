
import { useEffect, useRef } from 'react';
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
import { FAQ } from '../../sections/FAQ';
import { LiveFeed } from '../../components/ui/LiveFeed';


import { useLenis } from '../../hooks/useLenis';
import { LenisContext } from '../../context/LenisContext';

const Landing = () => {
  const containerRef = useRef(null);
  const lenisRef = useLenis(containerRef);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <LenisContext.Provider value={lenisRef}>
      <main ref={containerRef} className="bg-void text-ink font-sans selection:bg-ember/30 selection:text-ember-100 relative">
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
        <FAQ />
        <CTA />
        <Footer />
        <LiveFeed />


      </main>
    </LenisContext.Provider>
  );
};
export default Landing;
