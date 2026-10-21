import { useEffect } from "react";
import { Navbar } from "../../components/layout/Navbar";
import { Footer } from "../../components/layout/Footer";
import { SectionLabel } from "../../components/ui/SectionLabel";
import {
  BookOpen,
  Scale,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

const TermsOfService = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-void text-ink min-h-screen flex flex-col font-sans selection:bg-ember/30 selection:text-ember-100">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-6 md:px-12 py-32 md:py-40">
        <div className="mb-12">
          <SectionLabel>PLATFORM AGREEMENT</SectionLabel>
          <h1 className="font-serif text-4xl md:text-5xl text-ink mt-3 mb-4">
            Terms of Service
          </h1>
          <p className="text-muted text-sm md:text-base">
            Last updated: October 2026 • Governing patron circulation,
            e-resources, and institutional access.
          </p>
        </div>

        <div className="space-y-10 text-muted leading-relaxed text-base">
          <section className="glass-panel p-6 md:p-8 rounded-2xl border border-edge bg-surface/30">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2 mb-3">
              <Scale className="w-5 h-5 text-indigo-400" />
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the BookBuddy library management and digital
              catalog platform, you agree to comply with and be bound by these
              Terms of Service. If you are using BookBuddy on behalf of an
              educational institution, you represent that you possess the
              requisite authority to bind that institution to these terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-ember" />
              2. Physical Item Borrowing & Patron Responsibilities
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-muted">
              <li>
                <strong className="text-ink">Care of Materials:</strong> Patrons
                are responsible for returning borrowed physical volumes in the
                condition received on or before the stated due date.
              </li>
              <li>
                <strong className="text-ink">Loan Periods & Renewals:</strong>{" "}
                Standard loan durations are set by each partner institution.
                Loans may be renewed provided there are no active reserve holds
                from other patrons.
              </li>
              <li>
                <strong className="text-ink">Fines and Overdues:</strong>{" "}
                Overdue items may accrue daily fines capped at the replacement
                value of the item. Borrowing privileges may be temporarily
                paused until overdue accounts are resolved.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
              3. Digital E-Resources & Public Domain Literature
            </h2>
            <p>
              BookBuddy provides in-app access to over 70,000 public domain
              literary and academic works sourced from Project Gutenberg and
              open educational repositories. These works are free to read,
              download, and study. Patrons may not redistribute, scrape, or
              commercially re-package open repository assets through automated
              tooling that violates fair access thresholds.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-danger" />
              4. Prohibited Conduct
            </h2>
            <p>Users of BookBuddy agree not to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted">
              <li>
                Attempt to circumvent tenant isolation barriers or access
                another institution's private catalog or patron data.
              </li>
              <li>
                Impersonate other patrons, forge institutional email domains, or
                bypass circulation desk verification.
              </li>
              <li>
                Engage in automated denial-of-service, excessive API polling, or
                unauthorized vulnerability testing.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-cyan-400" />
              5. Modifications to Service
            </h2>
            <p>
              BookBuddy reserves the right to enhance features, perform
              maintenance, and update service parameters to improve reliability
              and security. Critical platform modifications will be notified in
              advance through institutional admin channels.
            </p>
          </section>

          <section className="pt-6 border-t border-edge">
            <p className="text-sm text-muted">
              Questions regarding these Terms of Service should be directed to{" "}
              <a
                href="mailto:legal@bookbuddy.app"
                className="text-ember hover:underline"
              >
                legal@bookbuddy.app
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermsOfService;
