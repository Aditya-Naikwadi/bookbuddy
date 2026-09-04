import { useState, useEffect } from "react";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, RefreshCw, ShieldCheck, UserCheck } from "lucide-react";

export default function DigitalLibraryCard() {
  const [cardData, setCardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function loadCardToken() {
      try {
        const res = await axios.get("/api/v1/digital-card/token");
        if (!ignore) setCardData(res.data);
      } catch (err) {
        console.error("Failed to fetch digital library card QR token:", err);
      } finally {
        if (!ignore) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    loadCardToken();
    const interval = setInterval(loadCardToken, 240000); // refresh every 4 mins

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [reloadToken]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setReloadToken((t) => t + 1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!cardData) return null;

  const { token, user } = cardData;

  return (
    <div className="max-w-md mx-auto bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-2xl border border-indigo-500/20 space-y-6 relative overflow-hidden">
      {/* Decorative background circle */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-indigo-500/20 pb-4">
        <div className="flex items-center space-x-2">
          <QrCode className="w-6 h-6 text-indigo-400" />
          <span className="font-extrabold tracking-wide text-lg text-indigo-100">
            BOOKBUDDY
          </span>
        </div>
        <span className="text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center">
          <UserCheck className="w-3 h-3 mr-1" /> Active Patron
        </span>
      </div>

      {/* QR Code Container */}
      <div className="bg-white p-4 rounded-xl shadow-inner flex flex-col items-center justify-center space-y-2 max-w-[220px] mx-auto">
        <QRCodeSVG value={token} size={180} level="H" includeMargin={false} />
        <span className="text-[10px] text-slate-400 font-mono">
          Scan for Desk Check-In
        </span>
      </div>

      {/* Student Details */}
      <div className="space-y-1 text-center">
        <h3 className="text-xl font-bold text-slate-100">{user.name}</h3>
        <p className="text-xs text-indigo-300">
          Roll No: {user.rollNumber} • Dept: {user.department}
        </p>
        <p className="text-[11px] text-slate-400">{user.email}</p>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-indigo-500/20 text-xs text-slate-400">
        <span className="flex items-center text-[10px] text-indigo-300">
          <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Dynamic Signed QR Token
        </span>
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center text-xs text-indigo-300 hover:text-white transition-colors"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? "animate-spin" : ""}`}
          />{" "}
          Refresh
        </button>
      </div>
    </div>
  );
}
