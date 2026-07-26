import React, { useState } from "react";
import { BookOpen } from "lucide-react";

/**
 * Reusable, lazy-loaded Book Cover Image component with defined fallback placeholder
 * when coverUrl is missing or fails to load.
 */
export const BookCoverImage = ({
  src,
  alt = "Book cover",
  className = "",
  aspectRatio = "aspect-[3/4]",
  fallbackTitle = "",
  fallbackCategory = "",
}) => {
  const [hasError, setHasError] = useState(false);

  // If no URL provided or error occurred loading image, render stylized fallback cover
  if (!src || hasError) {
    return (
      <div
        className={`w-full ${aspectRatio} bg-gradient-to-br from-indigo-900 via-slate-800 to-slate-900 rounded-xl p-3 flex flex-col justify-between relative overflow-hidden border border-white/10 ${className}`}
      >
        <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-200 bg-indigo-950/80 px-2 py-0.5 rounded-md self-start border border-indigo-500/20 backdrop-blur-xs">
          {fallbackCategory || "Catalog"}
        </span>

        <div className="my-auto text-center px-1">
          <BookOpen className="w-6 h-6 text-indigo-400/80 mx-auto mb-1" />
          {fallbackTitle && (
            <p className="text-[11px] font-bold text-white line-clamp-2 leading-tight drop-shadow-xs">
              {fallbackTitle}
            </p>
          )}
        </div>

        <div className="w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full opacity-80" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setHasError(true)}
      className={`w-full ${aspectRatio} object-cover rounded-xl shadow-xs transition-opacity duration-300 ${className}`}
    />
  );
};

export default BookCoverImage;
