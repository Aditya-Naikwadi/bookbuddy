import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { usePatronCard } from "../../../hooks/usePatronCard";

export const CardBack = ({ profile }) => {
  const { studentId = "N/A" } = profile || {};
  const { rotatingToken, expiresAt } = usePatronCard();
  const [secondsLeft, setSecondsLeft] = useState(30);

  // Dynamic countdown timer based on server token expiration timestamp
  useEffect(() => {
    const updateCountdown = () => {
      if (expiresAt) {
        const remaining = Math.max(
          0,
          Math.ceil((expiresAt - Date.now()) / 1000),
        );
        setSecondsLeft(remaining <= 0 ? 30 : remaining);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const qrValue = rotatingToken || studentId;
  const signatureDisplay =
    qrValue.length > 20 ? `${qrValue.substring(0, 12)}...` : qrValue;

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative shadow-xl border border-indigo-500/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-deep p-6 sm:p-8 flex flex-col justify-between select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-edge/10 pb-2">
        <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
          <ShieldCheck className="text-ember" size={14} />
          Scan Verification
        </h4>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>LIVE ROTATING TOKEN</span>
        </div>
      </div>

      {/* Scannable Area */}
      <div className="flex items-center gap-6 my-auto">
        <div
          className="bg-white p-3 rounded-2xl shadow-md shrink-0 flex items-center justify-center border border-white"
          role="img"
          aria-label={`Verification QR code for Student: ${studentId}`}
        >
          <QRCodeSVG
            value={qrValue}
            size={100}
            level="H"
            includeMargin={false}
            fgColor="#0d111a"
            bgColor="#ffffff"
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <div>
            <p className="text-[9px] text-muted uppercase font-extrabold tracking-wider">
              Student ID
            </p>
            <p className="text-sm font-mono font-black text-ink select-all">
              {studentId}
            </p>
          </div>

          <div>
            <p className="text-[9px] text-muted uppercase font-extrabold tracking-wider">
              Backend Token Signature
            </p>
            <p className="text-xs font-mono font-extrabold text-ember truncate">
              {signatureDisplay}
            </p>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-muted font-medium pt-1">
            <RefreshCw size={10} className="animate-spin text-ember-glow" />
            <span>
              Refreshes in{" "}
              <strong className="text-white font-mono">{secondsLeft}s</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Scanning Guidelines footer */}
      <div className="border-t border-edge/10 pt-3 flex justify-between items-center text-[9px] text-muted">
        <span>Screenshots are invalid</span>
        <span>Tips: Raise screen brightness</span>
      </div>
    </div>
  );
};
