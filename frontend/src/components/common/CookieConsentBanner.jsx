import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, ShieldCheck } from "lucide-react";
import { Button } from "../ui/Button";

/**
 * CookieConsentBanner
 * Compliant with GDPR/ePrivacy: notifies users of essential cookies (session auth)
 * and requests explicit consent for performance analytics with no PII.
 */
export const CookieConsentBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existingConsent = localStorage.getItem("bookbuddy_cookie_consent");
    if (!existingConsent) {
      // Delay display slightly to not interfere with initial page paint
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleConsent = (level) => {
    localStorage.setItem("bookbuddy_cookie_consent", level);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie and Privacy Notice"
      className="fixed bottom-4 left-4 right-4 md:left-6 md:right-auto md:max-w-lg z-[150] p-5 rounded-2xl bg-surface/95 border border-edge/80 shadow-2xl backdrop-blur-xl animate-fade-in text-ink text-sm"
    >
      <div className="flex items-start gap-3.5 mb-3.5">
        <div className="w-9 h-9 rounded-xl bg-ember/10 border border-ember/20 text-ember flex items-center justify-center shrink-0">
          <Cookie className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-semibold text-ink text-sm flex items-center gap-1.5">
            Your Privacy & Cookies
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </h4>
          <p className="text-muted text-xs leading-relaxed mt-1">
            We use essential cookies to maintain secure library sessions and
            anonymous metrics to track platform uptime. We never sell student
            data or reading histories. Review our{" "}
            <Link to="/privacy" className="text-ember hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link to="/terms" className="text-ember hover:underline">
              Terms
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleConsent("essential")}
          className="text-xs border-white/10 hover:border-white/20"
        >
          Essential Only
        </Button>
        <Button
          size="sm"
          onClick={() => handleConsent("accepted")}
          className="text-xs shadow-md shadow-ember/20"
        >
          Accept All
        </Button>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
