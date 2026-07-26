import React from "react";
import { cn } from "../../utils/cn";
import { useInView } from "../../hooks/useInView";

interface Props {
  label: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isActive?: boolean;
}

export const FeatureCard: React.FC<Props> = ({
  label,
  title,
  description,
  icon,
  isActive,
}) => {
  const { ref, isInView } = useInView({ threshold: 0.5 });

  return (
    <div
      ref={ref}
      className={cn(
        "p-6 rounded-2xl border transition-all duration-500",
        isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
        isActive ? "border-ember bg-surface shadow-lg" : "border-edge bg-void",
      )}
    >
      <div className="flex items-center gap-4 mb-3">
        <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-ember border border-edge">
          {icon}
        </div>
        <div>
          <span className="text-xs font-bold text-ember uppercase tracking-wider">
            {label}
          </span>
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
        </div>
      </div>
      <p className="text-muted leading-relaxed">{description}</p>
    </div>
  );
};
