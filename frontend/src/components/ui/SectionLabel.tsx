import React from "react";
import { cn } from "../../utils/cn";

export const SectionLabel: React.FC<
  React.HTMLAttributes<HTMLParagraphElement>
> = ({ className, ...props }) => {
  return (
    <p
      className={cn(
        "text-xs font-bold text-ember uppercase tracking-wider mb-2",
        className,
      )}
      {...props}
    />
  );
};
