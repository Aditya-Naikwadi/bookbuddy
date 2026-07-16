import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, RefreshCw, Smartphone } from 'lucide-react';

export const CardBack = ({ profile, isOnline }) => {
  const { studentId = 'N/A' } = profile || {};
  const [secondsLeft, setSecondsLeft] = useState(30);

  // Security rotation timer loop
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Simulated rotating verification signature
  const timeBlock = Math.floor(Date.now() / 30000);
  const signature = `${studentId.substring(0, 4)}-${timeBlock.toString(16).toUpperCase()}`;

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden relative shadow-xl border border-indigo-500/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-deep p-6 sm:p-8 flex flex-col justify-between select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-edge/10 pb-2">
        <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
          <ShieldCheck className="text-ember" size={14} />
          Scan Verification
        </h4>
        <div className="flex items-center gap-1 text-[10px] text-muted">
          <Smartphone size={10} />
          <span>Mobile Ready</span>
        </div>
      </div>

      {/* Scannable Area */}
      <div className="flex items-center gap-6 my-auto">
        {/* High-Contrast QR Code container forced on white for scanners */}
        <div 
          className="bg-white p-3 rounded-2xl shadow-md shrink-0 flex items-center justify-center border border-white"
          role="img"
          aria-label={`Verification QR code representing Student Card ID: ${studentId}`}
        >
          <QRCodeSVG
            value={studentId}
            size={100}
            level="H"
            includeMargin={false}
            fgColor="#0d111a"
            bgColor="#ffffff"
          />
        </div>

        {/* Scan instructions and dynamic code info */}
        <div className="min-w-0 space-y-1.5">
          <div>
            <p className="text-[9px] text-muted uppercase font-extrabold tracking-wider">Scan Card ID</p>
            <p className="text-sm font-mono font-black text-ink select-all">{studentId}</p>
          </div>

          <div>
            <p className="text-[9px] text-muted uppercase font-extrabold tracking-wider">Rolling Sec Token</p>
            <p className="text-xs font-mono font-extrabold text-ember truncate">{signature}</p>
          </div>

          {/* Code rotation visual timer */}
          <div className="flex items-center gap-1 text-[10px] text-muted font-medium pt-1">
            <RefreshCw size={10} className="animate-spin-slow text-ember-glow" />
            <span>Rotates in {secondsLeft}s</span>
          </div>
        </div>
      </div>

      {/* Scanning Guidelines footer */}
      <div className="border-t border-edge/10 pt-3 flex justify-between items-center text-[9px] text-muted">
        <span>A11y: Code printed as plain text above</span>
        <span>Tips: Raise screen brightness</span>
      </div>
    </div>
  );
};
