import React from "react";
import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="bg-void border-t border-edge py-16" aria-label="Footer">
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-[#FAF6EC] border border-ember/20 flex items-center justify-center relative shadow-sm">
              <img
                src="/favicon.png"
                alt="BookBuddy Mascot"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="font-serif text-2xl text-ink">
              Book<span className="text-ember">Buddy</span>
            </span>
          </div>
          <p className="text-muted text-sm leading-relaxed">
            The Library in Your Pocket. Manage course reserves, read free
            e-books, track your streaks, and connect with your campus library.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-ink mb-4">Product</h4>
          <ul className="space-y-3 text-sm text-muted">
            <li>
              <a
                href="#catalog-search"
                className="hover:text-ember transition-colors"
              >
                Catalog Search
              </a>
            </li>
            <li>
              <a
                href="#e-resources"
                className="hover:text-ember transition-colors"
              >
                E-Resources
              </a>
            </li>
            <li>
              <a
                href="#features"
                className="hover:text-ember transition-colors"
              >
                Features
              </a>
            </li>
            <li>
              <a
                href="#how-it-works"
                className="hover:text-ember transition-colors"
              >
                How It Works
              </a>
            </li>
            <li>
              <a href="#streaks" className="hover:text-ember transition-colors">
                Streaks & Rewards
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-ink mb-4">Institutions</h4>
          <ul className="space-y-3 text-sm text-muted">
            <li>
              <a
                href="#for-colleges"
                className="hover:text-ember transition-colors"
              >
                For Colleges
              </a>
            </li>
            <li>
              <Link
                to="/auth/register"
                className="hover:text-ember transition-colors"
              >
                College Admin Onboarding
              </Link>
            </li>
            <li>
              <Link
                to="/support"
                className="hover:text-ember transition-colors"
              >
                Institutional Support
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-ink mb-4">Legal & Support</h4>
          <ul className="space-y-3 text-sm text-muted">
            <li>
              <Link
                to="/privacy"
                className="hover:text-ember transition-colors"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-ember transition-colors">
                Terms
              </Link>
            </li>
            <li>
              <Link
                to="/support"
                className="hover:text-ember transition-colors"
              >
                Contact/Support
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24 mt-16 pt-8 border-t border-edge text-xs text-muted flex flex-col md:flex-row items-center justify-between gap-4">
        <p>&copy; {new Date().getFullYear()} BookBuddy. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <Link to="/privacy" className="hover:text-ember transition-colors">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-ember transition-colors">
            Terms
          </Link>
          <Link to="/support" className="hover:text-ember transition-colors">
            Contact/Support
          </Link>
        </div>
      </div>
    </footer>
  );
};
