import { useState, useRef } from "react";
import { usePatronCard } from "../../../hooks/usePatronCard";
import { CardFront } from "./CardFront";
import { CardBack } from "./CardBack";
import { EnlargeModal } from "./EnlargeModal";
import { PatronCardSkeleton } from "./PatronCardSkeleton";
import { useReducedMotion } from "../../../hooks/useReducedMotion";
import {
  AlertTriangle,
  WifiOff,
  Maximize2,
  Download,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "../../ui/Button";

export const PatronCardContainer = () => {
  const { profile, isLoading, isError, isOnline, cachedAt } = usePatronCard();
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEnlargeOpen, setIsEnlargeOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const cardRef = useRef(null);
  const flipBtnRef = useRef(null);
  const enlargeBtnRef = useRef(null);

  const prefersReducedMotion = useReducedMotion();

  // Handle keyboard inputs on the card container
  const handleKeyDown = (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      setIsFlipped(!isFlipped);
    }
  };

  // Canvas Card Image exporter
  const handleExportImage = () => {
    if (!profile) return;
    setIsExporting(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");

      // 1. Background Gradient
      const grad = ctx.createLinearGradient(0, 0, 800, 500);
      if (profile.membershipStatus === "expired") {
        grad.addColorStop(0, "#111827");
        grad.addColorStop(1, "#374151");
      } else if (profile.membershipStatus === "suspended") {
        grad.addColorStop(0, "#111827");
        grad.addColorStop(1, "#991b1b");
      } else {
        grad.addColorStop(0, "#020617");
        grad.addColorStop(0.5, "#1e1b4b");
        grad.addColorStop(1, "#020617");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 500);

      // 2. Decorative elements
      ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
      ctx.beginPath();
      ctx.arc(800, 0, 300, 0, Math.PI * 2);
      ctx.fill();

      // 3. Header Logo text
      ctx.fillStyle = "#e66525"; // Ember color
      ctx.beginPath();
      ctx.roundRect(40, 40, 50, 50, 12);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
      ctx.fillText("B", 53, 76);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 36px Georgia, serif";
      ctx.fillText("BookBuddy", 105, 77);

      ctx.fillStyle = "#9ba3b5";
      ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
      ctx.fillText("DIGITAL LIBRARY PASS", 40, 125);

      // 4. Student Name & Major
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 44px Georgia, serif";
      ctx.fillText(profile.name || "Library Student", 40, 240);

      ctx.fillStyle = "#9ba3b5";
      ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`Major: ${profile.major || "N/A"}`, 40, 290);

      // 5. Card ID and Expiry
      ctx.font = '14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText("STUDENT CARD ID", 40, 395);
      ctx.font = "bold 24px monospace";
      ctx.fillText(profile.studentId || "N/A", 40, 430);

      ctx.fillStyle = "#9ba3b5";
      ctx.font = '14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText("VALID THRU", 620, 395);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px monospace";
      const expDate = profile.validTill
        ? new Date(profile.validTill).toLocaleDateString(undefined, {
            month: "2-digit",
            year: "numeric",
          })
        : "N/A";
      ctx.fillText(expDate, 620, 430);

      // 6. Status Badge
      ctx.fillStyle =
        profile.membershipStatus === "expired"
          ? "rgba(245, 158, 11, 0.2)"
          : profile.membershipStatus === "suspended"
            ? "rgba(239, 68, 68, 0.2)"
            : "rgba(16, 185, 129, 0.2)";
      ctx.beginPath();
      ctx.roundRect(40, 315, 180, 40, 20);
      ctx.fill();

      ctx.strokeStyle =
        profile.membershipStatus === "expired"
          ? "#f59e0b"
          : profile.membershipStatus === "suspended"
            ? "#ef4444"
            : "#10b981";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        (profile.membershipStatus || "active").toUpperCase() + " MEMBER",
        60,
        340,
      );

      // Trigger download
      const link = document.createElement("a");
      link.download = `BookBuddy_Card_${profile.studentId || "Pass"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Failed to export card image", e);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return <PatronCardSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center max-w-sm mx-auto">
        <AlertTriangle className="text-danger mb-2" size={32} />
        <h4 className="font-bold text-ink">Cannot load card</h4>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Verify your connection or login again to reload your digital card
          credentials.
        </p>
      </div>
    );
  }

  const isBlock =
    profile?.membershipStatus === "expired" ||
    profile?.membershipStatus === "suspended";

  return (
    <div className="w-full flex flex-col items-center space-y-6">
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="w-full max-w-md p-3.5 border border-amber-500/20 bg-amber-500/5 rounded-2xl flex items-center gap-3">
          <WifiOff
            className="text-amber-500 shrink-0 animate-pulse"
            size={18}
          />
          <div className="text-[11px] text-muted leading-tight">
            <span className="font-bold text-ink block">Offline Mode</span>
            Showing cached card details verified on {cachedAt || "N/A"}.
          </div>
        </div>
      )}

      {/* 3D Card Flipping Container */}
      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={() => setIsFlipped(!isFlipped)}
        aria-label={`Student ID Library Card for ${profile?.name || "Student"}. Active status: ${profile?.membershipStatus || "Active"}. Click or press Space or Enter to reveal scan codes on back.`}
        className="w-full max-w-md h-[260px] sm:h-[280px] cursor-pointer focus:outline-none select-none rounded-3xl"
        style={{ perspective: "1000px" }}
      >
        <div
          className="relative w-full h-full"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: prefersReducedMotion
              ? "none"
              : "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* Card Front Side */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{ backfaceVisibility: "hidden" }}
          >
            <CardFront profile={profile} isOnline={isOnline} />
          </div>

          {/* Card Back Side (Rotated 180deg) */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <CardBack profile={profile} isOnline={isOnline} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full max-w-md flex flex-col items-center space-y-4">
        <div className="w-full grid grid-cols-2 gap-3">
          {/* Flip trigger Button */}
          <Button
            ref={flipBtnRef}
            variant="ghost"
            onClick={() => setIsFlipped(!isFlipped)}
            className="h-10 text-xs font-bold flex items-center justify-center gap-1.5 focus:ring-2 focus:ring-ember"
            aria-label="Flip library card"
          >
            <ArrowRightLeft size={14} />
            {isFlipped ? "Show Info (Front)" : "Show Barcode (Back)"}
          </Button>

          {/* Enlarge scan code Button */}
          <Button
            ref={enlargeBtnRef}
            variant="primary"
            disabled={isBlock}
            onClick={() => setIsEnlargeOpen(true)}
            className="h-10 text-xs font-bold flex items-center justify-center gap-1.5 focus:ring-2 focus:ring-ember disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Enlarge card QR code for desk scanning"
          >
            <Maximize2 size={14} />
            Enlarge Scan
          </Button>
        </div>

        {/* Caching/Scan guidelines description */}
        <p className="text-center text-[10px] text-muted max-w-xs leading-relaxed">
          {isFlipped
            ? "Rotate your device horizontally if the desk laser scanner has trouble reading the QR code."
            : "Click the card or use Space/Enter to view the scannable validation codes."}
        </p>

        {/* Export / Download button shortcut */}
        <button
          disabled={isExporting}
          onClick={handleExportImage}
          className="text-indigo hover:text-indigo-600 font-bold text-xs flex items-center gap-1.5 py-1.5 transition-colors focus:outline-none focus:underline disabled:opacity-50"
        >
          <Download size={14} />
          {isExporting ? "Generating PNG..." : "Save Card as PNG Image"}
        </button>
      </div>

      {/* Enlarged scanner fullscreen Modal */}
      <EnlargeModal
        isOpen={isEnlargeOpen}
        onClose={() => setIsEnlargeOpen(false)}
        studentId={profile?.studentId || "N/A"}
        name={profile?.name || "Student"}
        triggerRef={enlargeBtnRef}
      />
    </div>
  );
};
