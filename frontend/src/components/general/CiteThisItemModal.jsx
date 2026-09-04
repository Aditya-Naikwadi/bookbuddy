import { useState } from "react";
import { X, Copy, Check, Quote } from "lucide-react";
import { generateCitation } from "../../utils/citationFormatter";

const STYLES = [
  { id: "apa7", label: "APA 7th" },
  { id: "mla9", label: "MLA 9th" },
  { id: "chicago17", label: "Chicago 17th" },
];

const CiteThisItemModal = ({ isOpen, onClose, item }) => {
  const [activeStyle, setActiveStyle] = useState("apa7");
  const [copied, setCopied] = useState(false);

  if (!isOpen || !item) return null;

  const citationText = generateCitation(item, activeStyle);

  const handleCopy = async () => {
    try {
      // Strip markdown italic asterisks for plain text clipboard
      const plainCitation = citationText.replace(/\*/g, "");
      await navigator.clipboard.writeText(plainCitation);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-800 relative animate-in fade-in zoom-in-95 duration-200 text-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-950 text-indigo-400 border border-indigo-800/60 rounded-xl">
              <Quote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Cite Academic Resource
              </h3>
              <p className="text-xs text-slate-400 line-clamp-1 max-w-xs">
                {item.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Style Selector Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 text-xs">
          {STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => setActiveStyle(style.id)}
              className={`flex-1 py-1.5 rounded-lg text-center font-bold transition-all ${
                activeStyle === style.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>

        {/* Formatted Citation Output Box */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs font-mono leading-relaxed text-slate-200 relative group">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 font-sans">
            Formatted {STYLES.find((s) => s.id === activeStyle)?.label} Entry:
          </div>
          <p className="pr-8">{citationText.replace(/\*/g, "")}</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 px-4 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Citation</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CiteThisItemModal;
