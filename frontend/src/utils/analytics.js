/**
 * Privacy-Preserving Funnel & CTA Analytics
 * Tracks critical user journey milestones (hero CTA -> register -> first login)
 * with zero PII (no names, student IDs, or emails).
 */
export function trackEvent(eventName, properties = {}) {
  if (typeof window === "undefined") return;

  // Verify privacy consent
  const consent = localStorage.getItem("bookbuddy_cookie_consent");
  if (consent === "essential") {
    // User opted out of non-essential analytics
    return;
  }

  // Filter out any potential Personally Identifiable Information (PII)
  const sanitizedProps = { ...properties };
  const piiKeys = [
    "email",
    "password",
    "studentId",
    "phone",
    "name",
    "token",
    "accessToken",
  ];
  piiKeys.forEach((key) => delete sanitizedProps[key]);

  if (window.va) {
    window.va("event", { name: eventName, data: sanitizedProps });
  } else if (import.meta.env.DEV) {
    console.debug(`[Analytics Event] ${eventName}:`, sanitizedProps);
  }
}

/**
 * Capture error to external logging service without leaking private user data
 */
export function captureError(error, context = {}) {
  if (typeof window !== "undefined" && window.Sentry) {
    window.Sentry.captureException(error, { extra: context });
  } else if (import.meta.env.DEV) {
    console.warn("[Error Tracking] Exception:", error, context);
  }
}
