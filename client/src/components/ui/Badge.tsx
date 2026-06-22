
import React from 'react';
import { cn } from '../../utils/cn';

export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className, ...props }) => {
  return <span className={cn("inline-flex items-center rounded-full bg-ember/10 px-2.5 py-0.5 text-xs font-semibold text-ember", className)} {...props} />;
}
