import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

/**
 * OfflineBanner
 * Displays a non-intrusive, accessible status alert when the user loses network connectivity.
 */
export const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[200] bg-surface/95 border border-amber-500/40 text-amber-200 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-fade-in"
    >
      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
        <WifiOff className="w-4 h-4" />
      </div>
      <div className="text-xs leading-relaxed">
        <span className="font-semibold text-amber-300 block">Offline Mode</span>
        You are currently browsing offline. Cached library reading materials
        remain accessible.
      </div>
    </aside>
  );
};

export default OfflineBanner;
