import React from "react";
import { BookOpen } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-void border-t border-edge py-16">
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
            The Library in Your Pocket. Manage your borrowing, read free
            e-books, and build your reading streak.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-ink mb-4">Product</h4>
          <ul className="space-y-3 text-sm text-muted">
            <li>
              <a href="#features" className="hover:text-ember">
                Features
              </a>
            </li>
            <li>
              <a href="#e-books" className="hover:text-ember">
                E-Books
              </a>
            </li>
            <li>
              <a href="#streaks" className="hover:text-ember">
                Streaks
              </a>
            </li>
            <li>
              <a href="#features" className="hover:text-ember">
                Lab Booking
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-ink mb-4">Institution</h4>
          <ul className="space-y-3 text-sm text-muted">
            <li>
              <a href="#" className="hover:text-ember">
                For Libraries
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-ember">
                API
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-ember">
                Pricing
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-ink mb-4">Company</h4>
          <ul className="space-y-3 text-sm text-muted">
            <li>
              <a href="#" className="hover:text-ember">
                About
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-ember">
                Blog
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-ember">
                Contact
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-ember">
                Privacy & Terms
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24 mt-16 pt-8 border-t border-edge text-xs text-muted text-center flex flex-col md:flex-row items-center justify-between">
        <p>&copy; {new Date().getFullYear()} BookBuddy. All rights reserved.</p>
      </div>
    </footer>
  );
};
