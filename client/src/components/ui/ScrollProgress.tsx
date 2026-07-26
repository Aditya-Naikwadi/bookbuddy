import React from "react";
import { useScrollProgress } from "../../hooks/useScrollProgress";
import { useReducedMotion } from "../../hooks/useReducedMotion";

export const ScrollProgress = () => {
  const progress = useScrollProgress();
  const reducedMotion = useReducedMotion();

  if (reducedMotion) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-1 bg-void z-[100]">
      <div
        className="h-full bg-ember origin-left transition-transform duration-100 ease-out"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
};
