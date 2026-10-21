import React from "react";
import { cn } from "../../utils/cn";

export const SectionLabel: React.FC<
  React.HTMLAttributes<HTMLParagraphElement>
> = ({ className, ...props }) => {
  return (
    <p
      className={cn(
        "text-xs font-bold text-ember uppercase tracking-wider mb-2 transition-all duration-300 hover:text-ember-glow hover:tracking-widest cursor-default select-none",
        className,
      )}
      {...props}
    />
  );
};
