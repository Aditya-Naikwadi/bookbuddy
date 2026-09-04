import { Type, Check, Volume2, VolumeX, Eye } from "lucide-react";

export const ReaderThemeControls = ({
  fontSize,
  onChangeFontSize,
  activeTheme,
  onChangeTheme,
  isDyslexicFont,
  onToggleDyslexicFont,
  onReadAloud,
  isSpeaking,
}) => {
  const themes = [
    {
      id: "light",
      name: "Light",
      bg: "bg-[#fdfcf8]",
      text: "text-slate-900",
      border: "border-slate-200",
    },
    {
      id: "sepia",
      name: "Sepia",
      bg: "bg-[#f4ecd8]",
      text: "text-[#433422]",
      border: "border-[#d4cbb3]",
    },
    {
      id: "dark",
      name: "Dark",
      bg: "bg-[#0f172a]",
      text: "text-slate-100",
      border: "border-slate-800",
    },
    {
      id: "high-contrast",
      name: "High Contrast",
      bg: "bg-black",
      text: "text-yellow-400",
      border: "border-yellow-400/50",
    },
  ];

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xl w-72 space-y-4 text-slate-900">
      {/* Font Size controls */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Type size={14} />
          Font Size & Typography
        </h4>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => onChangeFontSize(Math.max(80, fontSize - 10))}
            disabled={fontSize <= 80}
            className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            aria-label="Decrease font size"
          >
            A-
          </button>

          <span
            className="text-sm font-bold text-slate-900 font-mono"
            aria-live="polite"
            aria-atomic="true"
          >
            {fontSize}%
          </span>

          <button
            onClick={() => onChangeFontSize(Math.min(200, fontSize + 10))}
            disabled={fontSize >= 200}
            className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            aria-label="Increase font size"
          >
            A+
          </button>
        </div>
      </div>

      {/* Dyslexia-Friendly Font Toggle */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <Eye size={14} className="text-indigo-500" />
          Dyslexia Font Mode
        </span>
        <button
          onClick={onToggleDyslexicFont}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
            isDyslexicFont
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {isDyslexicFont ? "ON" : "OFF"}
        </button>
      </div>

      {/* Text-to-Speech (TTS) Read Aloud Button */}
      <div className="pt-2 border-t border-slate-100">
        <button
          onClick={onReadAloud}
          className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            isSpeaking
              ? "bg-rose-500 text-white animate-pulse"
              : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200"
          }`}
        >
          {isSpeaking ? (
            <>
              <VolumeX size={16} /> Stop Reading Aloud
            </>
          ) : (
            <>
              <Volume2 size={16} /> Read Page Aloud (TTS)
            </>
          )}
        </button>
      </div>

      <hr className="border-slate-100" />

      {/* Reading Theme controls */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Contrast Theme
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => onChangeTheme(t.id)}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold text-center focus:ring-2 focus:ring-indigo-600 focus:outline-none ${t.bg} ${t.text} ${t.border} ${
                activeTheme === t.id
                  ? "ring-2 ring-indigo-600 scale-[1.03] shadow-md"
                  : "hover:scale-[1.01] hover:shadow-sm"
              }`}
              aria-label={`Switch reading theme to ${t.name}`}
            >
              <div className="flex items-center gap-1">
                {activeTheme === t.id && <Check size={12} />}
                <span>{t.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReaderThemeControls;
