import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookX, Home, Search, LifeBuoy } from "lucide-react";
import { Navbar } from "../../components/layout/Navbar";
import { Footer } from "../../components/layout/Footer";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { Button } from "../../components/ui/Button";
import useAuthStore from "../../store/authStore";

const NotFound = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleCatalogClick = () => {
    if (isAuthenticated && user) {
      const role = user.role;
      if (role === "general") navigate("/general-dashboard/search");
      else if (role === "college-admin") navigate("/college-admin");
      else if (role === "super-admin") navigate("/admin-portal");
      else navigate("/student/catalog");
    } else {
      navigate("/#catalog-search");
    }
  };

  const handleDashboardClick = () => {
    if (isAuthenticated && user) {
      const role = user.role;
      if (role === "general") navigate("/general-dashboard");
      else if (role === "college-admin") navigate("/college-admin");
      else if (role === "super-admin") navigate("/admin-portal");
      else navigate("/student");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="bg-void text-ink min-h-screen flex flex-col font-sans selection:bg-ember/30 selection:text-ember-100">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-6 py-32 md:py-48 relative overflow-hidden">
        {/* Background ambient lighting */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-ember/10 via-indigo-500/10 to-transparent rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-xl w-full text-center relative z-10 glass-panel p-8 md:p-12 rounded-3xl border border-edge bg-surface/40 shadow-2xl backdrop-blur-xl">
          <div className="w-20 h-20 rounded-2xl bg-ember/10 border border-ember/30 text-ember flex items-center justify-center mx-auto mb-6 shadow-inner animate-pulse">
            <BookX className="w-10 h-10" />
          </div>

          <SectionLabel className="mx-auto mb-3">ERROR 404</SectionLabel>

          <h1 className="font-serif text-3xl md:text-4xl text-ink font-semibold mb-4">
            Lost in the Library Stacks?
          </h1>

          <p className="text-muted text-base leading-relaxed mb-8">
            The book, shelf, or page you were looking for doesn't exist, has
            been relocated, or is currently checked out.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="w-full sm:w-auto"
              onClick={handleDashboardClick}
            >
              <Home className="w-4 h-4 mr-2" />
              {isAuthenticated ? "Go to Dashboard" : "Return to Home"}
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto border-white/20 hover:border-ember/40 hover:text-ember"
              onClick={handleCatalogClick}
            >
              <Search className="w-4 h-4 mr-2" />
              Browse Catalog
            </Button>

            <Link
              to="/support"
              className="inline-flex items-center text-xs text-muted hover:text-ember transition-colors py-2 px-3"
            >
              <LifeBuoy className="w-3.5 h-3.5 mr-1" />
              Need Help?
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default NotFound;
