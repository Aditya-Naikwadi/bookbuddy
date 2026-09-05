import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { cn } from "../../utils/cn";
import { ThemeToggle } from "../common/ThemeToggle";

const NAV_ITEMS = [
  { label: "Features", target: "#features" },
  { label: "E-Resources", target: "#e-resources" },
  { label: "Catalog Search", target: "#catalog-search" },
  { label: "Streaks", target: "#streaks" },
  { label: "How It Works", target: "#how-it-works" },
];

const NavbarComponent = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Lock body scroll when mobile/tablet navigation drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const closeMenu = useCallback(() => setMobileOpen(false), []);

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        closeMenu();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, closeMenu]);

  const handleNavClick = (target: string) => {
    closeMenu();
    if (target === "#" || target === "") {
      window.scrollTo({ top: 0, behavior: "smooth" });
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
        (id === "e-books"
          ? document.getElementById("e-resources")
          : null) ||
        (id === "streak"
          ? document.getElementById("streaks")
          : null);

      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      } else {
        const queryEl = document.querySelector(`[data-section="${id}"]`);
        if (queryEl) {
          queryEl.scrollIntoView({ behavior: "smooth" });
        }
      }
    } else {
      navigate(target);
    }
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
          {NAV_ITEMS.map(({ label, target }) => (
            <button
              key={target}
              onClick={() => handleNavClick(target)}
              className="text-sm font-semibold text-muted hover:text-ember transition-all duration-200 hover:-translate-y-0.5"
              aria-label={`Navigate to ${label}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Desktop Actions (Visible on >= 1024px) */}
        <div className="hidden lg:flex items-center gap-4">
          <Button onClick={() => navigate("/auth/register")}>
            Start for Free
          </Button>
        </div>

        {/* Mobile & Tablet Controls (Visible on < 1024px) */}
        <div className="flex lg:hidden items-center gap-2 sm:gap-3">

          {/* CSS-Animated Hamburger Toggle Button */}
          <button
            className="hamburger-button"
            aria-expanded={mobileOpen}
            aria-controls="responsive-nav-drawer"
            aria-label={
              mobileOpen ? "Close navigation menu" : "Open navigation menu"
            }
            onClick={() => setMobileOpen((prev) => !prev)}
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
        className={cn("nav-drawer-panel lg:hidden", mobileOpen && "is-open")}
        aria-label="Mobile and tablet navigation drawer"
      >
        <nav className="flex flex-col gap-5 mt-4">
          <span className="text-xs font-bold uppercase tracking-widest text-ember mb-2">
            Navigation Menu
          </span>
          {NAV_ITEMS.map(({ label, target }) => (
            <button
              key={target}
              onClick={() => handleNavClick(target)}
              className="text-left text-lg font-serif text-ink hover:text-ember transition-colors py-2 border-b border-white/5"
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10 flex flex-col gap-3">
          <Button
            className="w-full justify-center"
            size="lg"
            onClick={() => navigate("/auth/register")}
          >
            Start for Free
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={() => navigate("/auth/login")}
          >
            Sign In
          </Button>
        </div>
      </aside>
    </header>
  );
};

export const Navbar = React.memo(NavbarComponent);
