import { onLCP, onCLS, onINP } from "web-vitals";

export const initWebVitalsTelemetry = (pageName = "GeneralDashboard") => {
  try {
    const isTest =
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.MODE === "test";
    const reportMetric = (metric) => {
      if (!isTest) {
        console.log(
          `[Web Vitals - ${pageName}] ${metric.name}: ${Math.round(metric.value)}ms (Rating: ${metric.rating})`,
        );
      }
    };

    onLCP(reportMetric);
    onCLS(reportMetric);
    onINP(reportMetric);
  } catch (err) {
    // Graceful fallback if Web Vitals observation is unavailable
    console.debug("Web Vitals observation skipped:", err);
  }
};
