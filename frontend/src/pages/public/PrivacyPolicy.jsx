import { useEffect } from "react";
import { Navbar } from "../../components/layout/Navbar";
import { Footer } from "../../components/layout/Footer";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { Shield, Lock, Eye, Database, FileCheck } from "lucide-react";

const PrivacyPolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-void text-ink min-h-screen flex flex-col font-sans selection:bg-ember/30 selection:text-ember-100">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-6 md:px-12 py-32 md:py-40">
        <div className="mb-12">
          <SectionLabel>LEGAL & DATA COMPLIANCE</SectionLabel>
          <h1 className="font-serif text-4xl md:text-5xl text-ink mt-3 mb-4">
            Privacy Policy
          </h1>
          <p className="text-muted text-sm md:text-base">
            Last updated: October 2026 • Effective for all BookBuddy platforms
            and partner institutions.
          </p>
        </div>

        <div className="space-y-10 text-muted leading-relaxed text-base">
          <section className="glass-panel p-6 md:p-8 rounded-2xl border border-edge bg-surface/30">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-indigo-400" />
              1. Our Privacy Commitment
            </h2>
            <p>
              BookBuddy is committed to safeguarding student and patron privacy.
              We operate on a strict principle of data minimization: we only
              collect the minimum information required to deliver library
              borrowing, course reserve management, and digital reading
              services. We never sell, monetize, or trade student or
              institutional data to third-party advertisers.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
              <Database className="w-5 h-5 text-ember" />
              2. Multi-Tenant Campus Isolation
            </h2>
            <p>
              BookBuddy uses strict tenant isolation boundaries based on
              institutional identifiers (
              <code className="text-ink bg-surface px-1.5 py-0.5 rounded text-xs">
                collegeId
              </code>
              ). A student or faculty member's borrowing records, waitlist
              positions, and fine ledgers are exclusively accessible to
              authorized campus library administrators of their designated
              college.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400" />
              3. Information We Collect
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-muted">
              <li>
                <strong className="text-ink">Account Credentials:</strong> Full
                name, institutional or personal email address, campus student
                identification number, and salted password hashes.
              </li>
              <li>
                <strong className="text-ink">Circulation Records:</strong>{" "}
                Active loans, historical returns, reservation queues, and fine
                balances associated with physical library items.
              </li>
              <li>
                <strong className="text-ink">Digital Reading Progress:</strong>{" "}
                Reading streaks, chapter bookmarks, and progress indicators
                across public domain e-resources to provide continuous sync
                across devices.
              </li>
              <li>
                <strong className="text-ink">Technical Metadata:</strong>{" "}
                Browser type, IP address, and security logs collected strictly
                for account security and fraud prevention.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
              <Eye className="w-5 h-5 text-cyan-400" />
              4. FERPA & Educational Records
            </h2>
            <p>
              In educational settings, BookBuddy complies with applicable
              student record privacy standards, including the Family Educational
              Rights and Privacy Act (FERPA). Library circulation records are
              treated as confidential educational records. Student reading
              histories cannot be queried by unauthorized peers or external
              entities.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-indigo-400" />
              5. Data Retention and Erasure
            </h2>
            <p>
              Patrons maintain the right to review their circulation history and
              request account deactivation. Upon graduation or withdrawal,
              college administrators can archive or remove student records in
              accordance with their institution's document retention policies.
            </p>
          </section>

          <section className="pt-6 border-t border-edge">
            <p className="text-sm text-muted">
              For privacy-related inquiries, data access requests, or campus
              compliance verification, please contact our data privacy officer
              at{" "}
              <a
                href="mailto:privacy@bookbuddy.app"
                className="text-ember hover:underline"
              >
                privacy@bookbuddy.app
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

export default PrivacyPolicy;
