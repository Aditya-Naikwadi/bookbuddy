import React, { useEffect, useState } from "react";
import { useInView } from "../../hooks/useInView";
import { useReducedMotion } from "../../hooks/useReducedMotion";

export const StatCounter: React.FC<{
  end: number;
  suffix?: string;
  label: string;
}> = ({ end, suffix = "", label }) => {
  const { ref, isInView } = useInView({ threshold: 0.1 });
  const reducedMotion = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (isInView) {
      if (reducedMotion) {
        setCount(end);
        return;
      }

      let start = 0;
      const duration = 2000;
      const startTime = performance.now();

      const update = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutQuart
        const ease = 1 - Math.pow(1 - progress, 4);
        setCount(Math.floor(ease * end));

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          setCount(end);
        }
      };
      requestAnimationFrame(update);
    }
  }, [isInView, end, reducedMotion]);

  return (
    <div ref={ref} className="text-center" aria-live="polite">
      <div className="text-4xl md:text-5xl font-serif text-ink mb-2">
        {count.toLocaleString()}
        {suffix}
      </div>
      <div className="text-sm font-semibold text-muted tracking-wider uppercase">
        {label}
      </div>
    </div>
  );
};
