import { useEffect } from "react";

/**
 * Lightweight, zero-dependency IntersectionObserver hook
 * Observes container element children marked with `.reveal-fade-up`, `.reveal-fade-in`, or `.reveal-scale`
 * Toggles `.in-view` CSS class once visible, then unobserves to eliminate main-thread scroll listener overhead.
 */
export const useScrollObserver = (containerRef) => {
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window))
      return;

    const container = containerRef?.current || document;
    const elements = container.querySelectorAll(
      ".reveal-fade-up, .reveal-fade-in, .reveal-scale",
    );

    if (!elements || elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -50px 0px",
        threshold: 0.1,
      },
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [containerRef]);
};

export default useScrollObserver;
