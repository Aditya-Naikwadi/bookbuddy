import { useState } from "react";
import {
  Copy,
  Check,
  QrCode,
  X,
  Share2,
  Info,
  ExternalLink,
} from "lucide-react";

export default function ShareableRegistrationUrlModal({
  collegeSlug = "stanford-univ",
  collegeName = "Stanford University",
  isOpen,
  onClose,
}) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen) return null;

  const registrationUrl = `${window.location.origin}/register/${collegeSlug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(registrationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const drawSimpleQr = () => {
    setShowQr(!showQr);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200/80 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-slate-900 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Student Registration Portal Link
            </h3>
            <p className="text-xs text-slate-500 font-medium">{collegeName}</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900 flex items-start gap-3">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">
              How Student Self-Registration Works:
            </p>
            <p className="text-indigo-800 leading-relaxed">
              Share this dedicated URL with students during orientation or post
              it on your library board. Students signing up through this link
              are automatically linked to <strong>{collegeName}</strong>.
            </p>
          </div>
        </div>

        {/* Copy Box */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Shareable URL
          </label>
          <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
            <input
              type="text"
              readOnly
              value={registrationUrl}
              className="bg-transparent border-none text-xs font-mono text-indigo-700 font-medium w-full px-3 focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className={`px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all shrink-0 shadow-xs ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy URL</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <a
            href={registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline"
          >
            <span>Open Link in New Tab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={drawSimpleQr}
            className="py-2 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors"
          >
            <QrCode className="w-4 h-4 text-indigo-600" />
            <span>{showQr ? "Hide QR Code" : "Show QR Code"}</span>
          </button>
        </div>

        {/* Simple QR Code Display */}
        {showQr && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center animate-in fade-in duration-150">
            <div className="w-36 h-36 mx-auto bg-white border border-slate-200 rounded-xl flex items-center justify-center p-2 shadow-xs">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(registrationUrl)}`}
                alt="Registration QR Code"
                className="w-full h-full rounded"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-medium">
              Scan with phone camera to open registration page
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

