import { useState, useEffect } from "react";
import { Navbar } from "../../components/layout/Navbar";
import { Footer } from "../../components/layout/Footer";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { Button } from "../../components/ui/Button";
import { Mail, Headphones, Building2, CheckCircle2 } from "lucide-react";

const ContactSupport = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "Student Circulation Support",
    message: "",
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    setSubmitted(true);
  };

  return (
    <div className="bg-void text-ink min-h-screen flex flex-col font-sans selection:bg-ember/30 selection:text-ember-100">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-6 md:px-12 py-32 md:py-40">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <SectionLabel className="mx-auto">WE'RE HERE TO HELP</SectionLabel>
          <h1 className="font-serif text-4xl md:text-5xl text-ink mt-3 mb-4">
            Contact & Support
          </h1>
          <p className="text-muted text-base md:text-lg">
            Have questions about book reservations, reading streaks, fine
            resolutions, or institutional onboarding? Reach out anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          <div className="glass-panel p-6 rounded-2xl border border-edge bg-surface/30 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-ink mb-1">
              Email Support
            </h3>
            <p className="text-muted text-sm mb-3">
              Direct response within 24 hours
            </p>
            <a
              href="mailto:support@bookbuddy.app"
              className="text-ember text-sm font-medium hover:underline"
            >
              support@bookbuddy.app
            </a>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-edge bg-surface/30 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-ember/10 border border-ember/20 text-ember flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-ink mb-1">
              Institutional Inquiries
            </h3>
            <p className="text-muted text-sm mb-3">
              For colleges & university libraries
            </p>
            <a
              href="mailto:institutions@bookbuddy.app"
              className="text-ember text-sm font-medium hover:underline"
            >
              institutions@bookbuddy.app
            </a>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-edge bg-surface/30 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <Headphones className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-ink mb-1">
              Help Desk Hours
            </h3>
            <p className="text-muted text-sm mb-3">Monday – Friday</p>
            <span className="text-ink text-sm font-medium">
              8:00 AM – 8:00 PM EST
            </span>
          </div>
        </div>

        {/* Contact Form */}
        <div className="glass-panel p-8 md:p-12 rounded-3xl border border-edge bg-surface/40 max-w-2xl mx-auto">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-success/10 border border-success/30 text-success flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="font-serif text-3xl text-ink mb-2">
                Message Sent!
              </h2>
              <p className="text-muted text-base max-w-md mx-auto mb-6">
                Thank you for reaching out. A support specialist from the
                BookBuddy team will respond to your inquiry shortly.
              </p>
              <Button onClick={() => setSubmitted(false)}>
                Send Another Message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <h2 className="font-serif text-2xl text-ink mb-4">
                Send us a message
              </h2>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Your full name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full bg-void border border-edge rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-ember transition-colors placeholder:text-muted/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="student@college.edu"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full bg-void border border-edge rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-ember transition-colors placeholder:text-muted/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                  Inquiry Topic
                </label>
                <select
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  className="w-full bg-void border border-edge rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-ember transition-colors"
                >
                  <option value="Student Circulation Support">
                    Student Circulation / Reserve Support
                  </option>
                  <option value="Fine and Payment Inquiry">
                    Fine and Payment Inquiry
                  </option>
                  <option value="Institutional Onboarding">
                    College / Institutional Onboarding
                  </option>
                  <option value="Bug or Issue Report">
                    Report a Platform Issue
                  </option>
                  <option value="General Feedback">General Feedback</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                  Message
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="How can we help you?"
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  className="w-full bg-void border border-edge rounded-xl px-4 py-3 text-ink focus:outline-none focus:border-ember transition-colors placeholder:text-muted/60"
                />
              </div>

              <Button type="submit" size="lg" className="w-full justify-center">
                Send Inquiry
              </Button>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ContactSupport;
