import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../store/authStore";
import { ScrollProgress } from "../../components/ui/ScrollProgress";
import { Navbar } from "../../components/layout/Navbar";
import { Footer } from "../../components/layout/Footer";
import { Hero } from "../../sections/Hero";
import { Features } from "../../sections/Features";
import { EResources } from "../../sections/EResources";
import { StreakShowcase } from "../../sections/StreakShowcase";
import { HowItWorks } from "../../sections/HowItWorks";
import { PatronCardSection } from "../../sections/PatronCard";
import { CTA } from "../../sections/CTA";
import { FAQ } from "../../sections/FAQ";
import { LiveFeed } from "../../components/ui/LiveFeed";
import useScrollObserver from "../../hooks/useScrollObserver";

const Landing = () => {
  const containerRef = useRef(null);
  useScrollObserver(containerRef);
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      const role = user.role;
      if (role === "college-admin")
        navigate("/college-admin", { replace: true });
      else if (role === "general")
        navigate("/general-dashboard", { replace: true });
      else if (role === "super-admin")
        navigate("/admin-portal", { replace: true });
      else navigate("/student-dashboard", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main
      ref={containerRef}
      className="bg-void text-ink font-sans selection:bg-ember/30 selection:text-ember-100 relative"
    >
      <ScrollProgress />
      <Navbar />
      <Hero />
      <Features />
      <EResources />
      <StreakShowcase />
      <HowItWorks />
      <PatronCardSection />
      <FAQ />
      <CTA />
      <Footer />
      <LiveFeed />
    </main>
  );
};
export default Landing;
