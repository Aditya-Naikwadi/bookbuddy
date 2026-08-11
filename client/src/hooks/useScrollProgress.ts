import { useState, useEffect, useRef } from "react";

export function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  const lastProgressRef = useRef(0);
  const windowHeightRef = useRef(1);

  useEffect(() => {
    let ticking = false;

    const updateMaxScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      windowHeightRef.current = Math.max(1, scrollHeight - clientHeight);
    };

    updateMaxScroll();
    window.addEventListener("resize", updateMaxScroll, { passive: true });

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const totalScroll = window.scrollY || document.documentElement.scrollTop;
          const newProgress = Math.min(1, Math.max(0, totalScroll / windowHeightRef.current));

          // Prevent unnecessary state updates if change is minimal
          if (Math.abs(newProgress - lastProgressRef.current) > 0.002) {
            lastProgressRef.current = newProgress;
            setProgress(newProgress);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateMaxScroll);
    };
  }, []);

  return progress;
}
