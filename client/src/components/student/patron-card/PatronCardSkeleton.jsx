import React from 'react';

export const PatronCardSkeleton = () => {
  return (
    <div className="w-full max-w-md mx-auto h-[260px] sm:h-[280px] rounded-3xl border border-edge/30 bg-surface/30 glass-panel p-6 flex flex-col justify-between shadow-lg relative overflow-hidden animate-pulse">
      {/* Top Section */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          {/* Logo skeleton */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-edge/40"></div>
            <div className="w-24 h-5 rounded bg-edge/40"></div>
          </div>
          {/* Label skeleton */}
          <div className="w-16 h-3 rounded bg-edge/30 mt-2"></div>
        </div>
        {/* Avatar skeleton */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-edge/40"></div>
      </div>

      {/* Middle Section */}
      <div className="space-y-2 my-auto">
        {/* Name skeleton */}
        <div className="w-48 h-7 rounded bg-edge/40"></div>
        {/* ID skeleton */}
        <div className="w-32 h-4 rounded bg-edge/30 font-mono"></div>
      </div>

      {/* Bottom Section */}
      <div className="flex justify-between items-end border-t border-edge/10 pt-4">
        <div className="space-y-2">
          <div className="w-12 h-2 rounded bg-edge/30"></div>
          <div className="w-16 h-4 rounded bg-edge/40 font-mono"></div>
        </div>
        {/* QR Code placeholder skeleton */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-edge/40 rounded-xl"></div>
      </div>
    </div>
  );
};
