import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollProgress } from "../../components/ui/ScrollProgress";
import { Navbar } from "../../components/layout/Navbar";
import { Footer } from "../../components/layout/Footer";
import { Hero } from "../../sections/Hero";
import { CatalogSearch } from "../../sections/CatalogSearch";
import { EResources } from "../../sections/EResources";
import { Features } from "../../sections/Features";
import { HowItWorks } from "../../sections/HowItWorks";
import { StreakShowcase } from "../../sections/StreakShowcase";
import { PatronCardSection } from "../../sections/PatronCard";
import { ForColleges } from "../../sections/ForColleges";
import { FAQ } from "../../sections/FAQ";
import { CTA } from "../../sections/CTA";
import useScrollObserver from "../../hooks/useScrollObserver";
import { getSubdomainTenantSlug } from "../../utils/tenantSubdomain";

import { SectionErrorBoundary } from "../../components/common/SectionErrorBoundary";
import { OfflineBanner } from "../../components/common/OfflineBanner";
import { CookieConsentBanner } from "../../components/common/CookieConsentBanner";

const Landing = () => {
  const containerRef = useRef(null);
  useScrollObserver(containerRef);
  const navigate = useNavigate();

  // Subdomain Isolation: College subdomains redirect to their isolated campus portal
  const subdomainSlug = getSubdomainTenantSlug();
  useEffect(() => {
    if (subdomainSlug) {
      navigate(`/c/${subdomainSlug}`, { replace: true });
    }
  }, [subdomainSlug, navigate]);

  // Support direct anchor link loading on page load and refresh (e.g. /#catalog, /#catalog-search)
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash;
      if (hash) {
        const id = hash.replace("#", "");
        const targetEl =
          document.getElementById(id) ||
          (id === "catalog" || id === "library"
            ? document.getElementById("catalog-search")
            : null) ||
          (id === "e-books" ? document.getElementById("e-resources") : null) ||
          (id === "streak" ? document.getElementById("streaks") : null) ||
          document.querySelector(`[data-section="${id}"]`);

        if (targetEl) {
          setTimeout(() => {
            targetEl.scrollIntoView({ behavior: "smooth" });
          }, 150);
          return;
        }
      }
      window.scrollTo(0, 0);
    };

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  return (
    <div className="bg-void text-ink font-sans selection:bg-ember/30 selection:text-ember-100 relative">
      {/* WCAG 2.1 AA: Skip to main content keyboard shortcut */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2.5 focus:bg-ember focus:text-white focus:font-bold focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>
      <ScrollProgress />
      <OfflineBanner />
      <CookieConsentBanner />
      <Navbar />
      {/* Intended Section Order: Hero → Catalog Search → E-Resources → Features/How it works → For Colleges → Footer */}
      <main
        id="main-content"
        ref={containerRef}
        tabIndex={-1}
        className="focus:outline-none"
      >
        <SectionErrorBoundary sectionName="Hero">
          <Hero />
        </SectionErrorBoundary>
        <SectionErrorBoundary sectionName="Catalog Search">
          <CatalogSearch />
        </SectionErrorBoundary>
        <SectionErrorBoundary sectionName="E-Resources">
          <EResources />
        </SectionErrorBoundary>
        <SectionErrorBoundary sectionName="Features">
          <Features />
        </SectionErrorBoundary>
        <SectionErrorBoundary sectionName="How It Works">
          <HowItWorks />
        </SectionErrorBoundary>
        <SectionErrorBoundary sectionName="Streaks Showcase">
          <StreakShowcase />
        </SectionErrorBoundary>
        <SectionErrorBoundary sectionName="Patron Card">
          <PatronCardSection />
        </SectionErrorBoundary>
        <SectionErrorBoundary sectionName="FAQ">
          <FAQ />
        </SectionErrorBoundary>
        <SectionErrorBoundary sectionName="Call to Action">
          <CTA />
        </SectionErrorBoundary>
        <SectionErrorBoundary sectionName="For Colleges">
          <ForColleges />
        </SectionErrorBoundary>
      </main>
      <Footer />
    </div>
  );
};

export default Landing;
