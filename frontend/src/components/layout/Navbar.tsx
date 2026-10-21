import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "../ui/Button";
import { cn } from "../../utils/cn";
import useAuthStore from "../../store/authStore";
import { LogOut, LayoutDashboard, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

export const NAV_ITEMS = [
  { label: "Catalog Search", target: "#catalog-search" },
  { label: "E-Resources", target: "#e-resources" },
  { label: "Features", target: "#features" },
  { label: "How It Works", target: "#how-it-works" },
  { label: "Streaks", target: "#streaks" },
  { label: "For Colleges", target: "#for-colleges" },
];

export const getRoleDashboardRoute = (role?: string) => {
  if (role === "super-admin" || role === "super_admin") return "/admin-portal";
  if (role === "college-admin" || role === "college_admin")
    return "/college-admin";
  if (role === "general") return "/general-dashboard";
  return "/student";
};

const NavbarComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, isLoading, logout } = useAuthStore();
  const { t, i18n } = useTranslation();

  const navItems = [
    {
      label: t("landing.navCatalog", "Catalog Search"),
      target: "#catalog-search",
    },
    {
      label: t("landing.navEResources", "E-Resources"),
      target: "#e-resources",
    },
    { label: t("landing.navFeatures", "Features"), target: "#features" },
    {
      label: t("landing.navHowItWorks", "How It Works"),
      target: "#how-it-works",
    },
    { label: t("landing.navStreaks", "Streaks"), target: "#streaks" },
    {
      label: t("landing.navForColleges", "For Colleges"),
      target: "#for-colleges",
    },
  ];

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  const drawerRef = useRef<HTMLElement>(null);
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const dashboardRoute = getRoleDashboardRoute(user?.role);

  const LanguageSwitcher = ({ idPrefix }: { idPrefix: string }) => (
    <div className="relative flex items-center">
      <label htmlFor={`${idPrefix}-language-select`} className="sr-only">
        {t("landing.selectLanguage", "Select language")}
      </label>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-edge/60 bg-surface/40 hover:bg-surface/70 text-ink text-xs font-medium transition-colors">
        <Globe className="w-3.5 h-3.5 text-ember shrink-0" aria-hidden="true" />
        <select
          id={`${idPrefix}-language-select`}
          value={i18n.language || "en"}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="bg-transparent text-ink text-xs font-semibold focus:outline-none cursor-pointer pr-1"
          aria-label={t("landing.selectLanguage", "Select language")}
        >
          <option value="en" className="bg-[#12141D] text-white">
            EN
          </option>
          <option value="hi" className="bg-[#12141D] text-white">
            HI - हिन्दी
          </option>
          <option value="mr" className="bg-[#12141D] text-white">
            MR - मराठी
          </option>
          <option value="es" className="bg-[#12141D] text-white">
            ES - Español
          </option>
        </select>
      </div>
    </div>
  );

  // Handle sticky header scroll threshold with RAF throttling
  useEffect(() => {
    let ticking = false;
    let isScrolled = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const nextScrolled = window.scrollY > 40;
          if (nextScrolled !== isScrolled) {
            isScrolled = nextScrolled;
            setScrolled(nextScrolled);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Active section spy on landing page
  useEffect(() => {
    if (location.pathname !== "/") {
      setActiveSection("");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length > 0) {
          // Sort by intersection ratio or top position
          visibleEntries.sort(
            (a, b) => b.intersectionRatio - a.intersectionRatio,
          );
          setActiveSection(`#${visibleEntries[0].target.id}`);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75] },
    );

    const sectionElements: HTMLElement[] = [];
    NAV_ITEMS.forEach(({ target }) => {
      const id = target.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
        sectionElements.push(el);
      }
    });

    return () => {
      sectionElements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [location.pathname]);

  const closeMenu = useCallback(() => {
    setMobileOpen(false);
    if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus();
    }
  }, []);

  const openMenu = useCallback(() => {
    previousActiveElementRef.current = document.activeElement as HTMLElement;
    setMobileOpen(true);
  }, []);

  // Lock body scroll and trap focus when mobile navigation drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";

      // Focus first element inside drawer
      const focusableEls = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusableEls && focusableEls.length > 0) {
        focusableEls[0].focus();
      }
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Handle keyboard events (Escape to close, Tab for focus trapping)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!mobileOpen) return;

      if (e.key === "Escape") {
        closeMenu();
        return;
      }

      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, closeMenu]);

  const handleNavClick = (target: string) => {
    closeMenu();
    if (target === "#" || target === "") {
      if (location.pathname === "/") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        navigate("/");
      }
      return;
    }

    if (target.startsWith("#")) {
      const id = target.substring(1);
      const element =
        document.getElementById(id) ||
        document.querySelector(target) ||
        (id === "library" || id === "catalog"
          ? document.getElementById("catalog-search")
          : null) ||
        (id === "e-books" ? document.getElementById("e-resources") : null) ||
        (id === "streak" ? document.getElementById("streaks") : null);

      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      } else {
        // If element not on current page (e.g., from /privacy or /terms), navigate to home with hash
        navigate(`/${target}`);
      }
    } else {
      navigate(target);
    }
  };

  const handleLogout = () => {
    closeMenu();
    logout();
    navigate("/", { replace: true });
  };

  return (
    <header
      className={cn(
        "fixed top-0 w-full z-[100] transition-all duration-300",
        scrolled ? "glass-panel py-3 shadow-lg" : "bg-transparent py-5",
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => handleNavClick("#")}
          className="flex items-center gap-2.5 cursor-pointer select-none"
        >
          <div className="w-9 h-9 rounded-full overflow-hidden bg-[#FAF6EC] border border-ember/20 flex items-center justify-center relative shadow-sm">
            <img
              src="/favicon.png"
              alt="BookBuddy Mascot"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-serif text-2xl font-bold text-ink">
            Book<span className="text-ember">Buddy</span>
          </span>
        </div>

        {/* Desktop Navigation Links (Visible on >= 1024px) */}
        <nav className="hidden lg:flex items-center gap-7">
          {navItems.map(({ label, target }) => {
            const isActive = activeSection === target;
            return (
              <button
                key={target}
                onClick={() => handleNavClick(target)}
                className={cn(
                  "text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5",
                  isActive
                    ? "text-ember font-bold drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                    : "text-muted hover:text-ember",
                )}
                aria-label={`Navigate to ${label}`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* Desktop Actions (Visible on >= 1024px) */}
        <div className="hidden lg:flex items-center gap-3">
          <LanguageSwitcher idPrefix="desktop" />
          {isLoading && !user ? (
            <div className="h-9 w-36 rounded-xl bg-surface/50 border border-edge/60 animate-pulse" />
          ) : isAuthenticated && user ? (
            <>
              <Button
                variant="outline"
                className="text-sm font-semibold border-ember/30 text-ink hover:text-ember"
                onClick={() => navigate(dashboardRoute)}
              >
                <LayoutDashboard className="w-4 h-4 mr-1.5" />
                {t("landing.navDashboard", "Dashboard")}
              </Button>
              <Button
                variant="ghost"
                className="text-sm font-semibold text-muted hover:text-danger hover:bg-danger/10"
                onClick={handleLogout}
                aria-label={t("landing.navLogout", "Logout")}
              >
                <LogOut className="w-4 h-4 mr-1" />
                {t("landing.navLogout", "Logout")}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                className="text-sm font-semibold text-muted hover:text-ink"
                onClick={() => navigate("/auth/login")}
              >
                {t("landing.signIn", "Sign In")}
              </Button>
              <Button onClick={() => navigate("/auth/register")}>
                {t("landing.startForFree", "Start for Free")}
              </Button>
            </>
          )}
        </div>

        {/* Mobile & Tablet Controls (Visible on < 1024px) */}
        <div className="flex lg:hidden items-center gap-2 sm:gap-3">
          <LanguageSwitcher idPrefix="mobile-bar" />
          {/* CSS-Animated Hamburger Toggle Button */}
          <button
            ref={hamburgerButtonRef}
            className="hamburger-button"
            aria-expanded={mobileOpen}
            aria-controls="responsive-nav-drawer"
            aria-label={
              mobileOpen ? "Close navigation menu" : "Open navigation menu"
            }
            onClick={() => (mobileOpen ? closeMenu() : openMenu())}
          >
            <span className="hamburger-line hamburger-line-1" />
            <span className="hamburger-line hamburger-line-2" />
            <span className="hamburger-line hamburger-line-3" />
          </button>
        </div>
      </div>

      {/* Mobile/Tablet Backdrop Overlay */}
      <div
        className={cn("nav-drawer-overlay lg:hidden", mobileOpen && "is-open")}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* Mobile/Tablet Slide-In Panel Drawer */}
      <aside
        id="responsive-nav-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile and tablet navigation drawer"
        className={cn("nav-drawer-panel lg:hidden", mobileOpen && "is-open")}
      >
        <nav className="flex flex-col gap-5 mt-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <span className="text-xs font-bold uppercase tracking-widest text-ember">
              {t("landing.navMenu", "Navigation Menu")}
            </span>
            <LanguageSwitcher idPrefix="mobile-drawer" />
          </div>
          {navItems.map(({ label, target }) => {
            const isActive = activeSection === target;
            return (
              <button
                key={target}
                onClick={() => handleNavClick(target)}
                className={cn(
                  "text-left text-lg font-serif transition-colors py-2 border-b border-white/5",
                  isActive
                    ? "text-ember font-bold"
                    : "text-ink hover:text-ember",
                )}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10 flex flex-col gap-3">
          {isLoading && !user ? (
            <div className="h-11 w-full rounded-xl bg-surface/50 border border-edge/60 animate-pulse" />
          ) : isAuthenticated && user ? (
            <>
              <Button
                className="w-full justify-center"
                size="lg"
                onClick={() => {
                  closeMenu();
                  navigate(dashboardRoute);
                }}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                {t("landing.goToDashboard", "Go to Dashboard")}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-center border-danger/30 text-danger hover:bg-danger/10"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t("landing.navLogout", "Logout")}
              </Button>
            </>
          ) : (
            <>
              <Button
                className="w-full justify-center"
                size="lg"
                onClick={() => {
                  closeMenu();
                  navigate("/auth/register");
                }}
              >
                {t("landing.startForFree", "Start for Free")}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => {
                  closeMenu();
                  navigate("/auth/login");
                }}
              >
                {t("landing.signIn", "Sign In")}
              </Button>
            </>
          )}
        </div>
      </aside>
    </header>
  );
};

export const Navbar = React.memo(NavbarComponent);
