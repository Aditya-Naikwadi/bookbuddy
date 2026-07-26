import { useState, useRef } from 'react';
import { Copy, Check, QrCode, X, Share2, Info, ExternalLink } from 'lucide-react';

export default function ShareableRegistrationUrlModal({ collegeSlug = 'stanford-univ', collegeName = 'Stanford University', isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qrCanvasRef = useRef(null);

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
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Student Registration Portal Link</h3>
            <p className="text-xs text-slate-400">{collegeName}</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 flex items-start gap-3">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">How Student Self-Registration Works:</p>
            <p className="text-indigo-300/90 leading-relaxed">
              Share this dedicated URL with students during orientation or post it on your library board. Students signing up through this link are automatically linked to <strong>{collegeName}</strong>.
            </p>
          </div>
        </div>

        {/* Copy Box */}
        <div className="mb-6">
          <label className="block text-xs font-mono font-bold uppercase text-slate-400 mb-2">
            Shareable URL
          </label>
          <div className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-2xl">
            <input
              type="text"
              readOnly
              value={registrationUrl}
              className="bg-transparent border-none text-xs font-mono text-indigo-300 w-full px-3 focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 ${
                copied
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
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

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={drawSimpleQr}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <QrCode className="w-4 h-4 text-indigo-400" />
            <span>{showQr ? 'Hide QR Code' : 'Generate Poster QR'}</span>
          </button>
          <a
            href={registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <span>Preview Portal</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>

        {/* QR Code Canvas Mock View */}
        {showQr && (
          <div className="mt-6 p-6 bg-white rounded-2xl text-center text-slate-900 animate-in fade-in duration-150">
            <div className="w-36 h-36 mx-auto bg-slate-900 p-3 rounded-xl border-4 border-indigo-600 flex items-center justify-center text-white">
              <div className="grid grid-cols-5 gap-1.5 w-full h-full p-2 bg-slate-950 rounded">
                <div className="bg-white col-span-2 row-span-2 rounded-sm"></div>
                <div className="bg-indigo-400 col-span-1"></div>
                <div className="bg-white col-span-2 row-span-2 rounded-sm"></div>
                <div className="bg-white col-span-1"></div>
                <div className="bg-indigo-500 col-span-2"></div>
                <div className="bg-white col-span-2 row-span-2 rounded-sm"></div>
                <div className="bg-white col-span-1"></div>
              </div>
            </div>
            <p className="font-bold text-sm mt-3">{collegeName}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">Scan to register for Library Portal</p>
          </div>
        )}
      </div>
    </div>
  );
}
