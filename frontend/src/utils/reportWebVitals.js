import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals";

/**
 * Report Core Web Vitals (LCP, CLS, INP, FCP, TTFB)
 * Transmits real-user performance metrics to analytics endpoints or console.
 */
export function reportWebVitals(onPerfEntry) {
  if (onPerfEntry && typeof onPerfEntry === "function") {
    onCLS(onPerfEntry);
    onINP(onPerfEntry);
    onLCP(onPerfEntry);
    onFCP(onPerfEntry);
    onTTFB(onPerfEntry);
  } else {
    const logMetric = (metric) => {
      if (typeof window !== "undefined" && window.va) {
        window.va("event", {
          name: `web_vital_${metric.name.toLowerCase()}`,
          data: {
            value: Math.round(metric.value),
            rating: metric.rating,
          },
        });
      } else if (import.meta.env.DEV) {
        console.debug(
          `[Web Vital] ${metric.name}: ${Math.round(metric.value)} (rating: ${metric.rating})`,
        );
      }
    };

    onCLS(logMetric);
    onINP(logMetric);
    onLCP(logMetric);
    onFCP(logMetric);
    onTTFB(logMetric);
  }
}

export default reportWebVitals;
