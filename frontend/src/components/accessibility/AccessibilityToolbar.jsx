import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  X,
  RotateCcw,
  Sliders,
  Type,
  SunMoon,
} from "lucide-react";
import { useAccessibilityStore } from "../../store/accessibilityStore";
import useAuthStore from "../../store/authStore";
import { useFeatureFlags } from "../../hooks/useFeatureFlags";
import { FEATURE_FLAGS } from "@bookbuddy/shared";

export function AccessibilityToolbar() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { isFeatureEnabled } = useFeatureFlags();
  const isLicensed = isFeatureEnabled(FEATURE_FLAGS.ACCESSIBILITY_MODE);

  const {
    currentUserId,
    setUserId,
    dyslexiaFont,
    highContrast,
    textToSpeech,
    ttsRate,
    isSpeaking,
    isPaused,
    isSpeechSupported,
    speechNotice,
    isToolbarOpen,
    toggleDyslexiaFont,
    toggleHighContrast,
    toggleTextToSpeech,
    setTtsRate,
    toggleToolbar,
    closeToolbar,
    resetPreferences,
    readCurrentPage,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
  } = useAccessibilityStore();

  const dialogRef = useRef(null);

  // Synchronize store userId when auth user changes
  useEffect(() => {
    const activeId = user?.id || user?._id || "guest";
    if (activeId !== currentUserId) {
      setUserId(activeId);
    }
  }, [user, currentUserId, setUserId]);

  // Keyboard navigation: Escape key closes toolbar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isToolbarOpen) {
        closeToolbar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isToolbarOpen, closeToolbar]);

  // If the college tenant has feature flag OFF, do not render toolbar for users
  if (!isLicensed) {
    return null;
  }

  return (
    <aside
      role="complementary"
      aria-label={t("accessibility.toggleMenu", "Accessibility Options")}
      className="fixed bottom-6 right-6 z-50 font-sans print:hidden"
    >
      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={toggleToolbar}
        aria-label={t("accessibility.toggleMenu", "Accessibility Options")}
        aria-expanded={isToolbarOpen}
        aria-controls="accessibility-panel"
        className="flex items-center gap-2 px-3.5 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-800 transition-all cursor-pointer font-medium text-xs border border-white/20"
      >
        <Sliders className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline">
          {t("accessibility.toggleMenu", "Accessibility")}
        </span>
      </button>

      {/* Accessibility Dialog / Drawer */}
      {isToolbarOpen && (
        <div
          id="accessibility-panel"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="a11y-panel-title"
          className="absolute bottom-16 right-0 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Sliders
                className="w-5 h-5 text-indigo-600 dark:text-indigo-400"
                aria-hidden="true"
              />
              <h2
                id="a11y-panel-title"
                className="text-sm font-bold tracking-tight"
              >
                {t("accessibility.title", "Accessibility Settings")}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeToolbar}
              aria-label="Close accessibility options"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Toggle 1: Dyslexia Font */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80">
              <div className="flex items-start gap-2.5 pr-2">
                <Type
                  className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {t("accessibility.dyslexiaFont", "Dyslexia-Friendly Font")}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    {t(
                      "accessibility.dyslexiaFontDesc",
                      "Uses OpenDyslexic typeface with enhanced letter spacing",
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={dyslexiaFont}
                aria-label={t(
                  "accessibility.dyslexiaFont",
                  "Dyslexia-Friendly Font",
                )}
                onClick={toggleDyslexiaFont}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  dyslexiaFont
                    ? "bg-indigo-600"
                    : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    dyslexiaFont ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: High Contrast Mode */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80">
              <div className="flex items-start gap-2.5 pr-2">
                <SunMoon
                  className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {t("accessibility.highContrast", "High Contrast Mode")}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    {t(
                      "accessibility.highContrastDesc",
                      "Increases contrast to WCAG AAA standards for visual clarity",
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={highContrast}
                aria-label={t(
                  "accessibility.highContrast",
                  "High Contrast Mode",
                )}
                onClick={toggleHighContrast}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  highContrast
                    ? "bg-indigo-600"
                    : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    highContrast ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Toggle 3: Text-to-Speech (TTS) Engine */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2.5 pr-2">
                  {textToSpeech ? (
                    <Volume2
                      className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <VolumeX
                      className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {t("accessibility.textToSpeech", "Text to Speech (TTS)")}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                      {t(
                        "accessibility.textToSpeechDesc",
                        "Reads on-screen content aloud using Web Speech API",
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={textToSpeech}
                  aria-label={t(
                    "accessibility.textToSpeech",
                    "Text to Speech (TTS)",
                  )}
                  onClick={toggleTextToSpeech}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    textToSpeech
                      ? "bg-indigo-600"
                      : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      textToSpeech ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* TTS Controls & Unsupported Fallback */}
              {textToSpeech && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  {!isSpeechSupported ? (
                    <div
                      role="alert"
                      className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-[11px] leading-relaxed"
                    >
                      {t(
                        "accessibility.ttsUnsupported",
                        "Text-to-speech is not supported by your current browser. Please use Google Chrome or a modern browser with Web Speech API support.",
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Read / Pause / Stop Buttons */}
                      <div className="flex items-center gap-2">
                        {!isSpeaking ? (
                          <button
                            type="button"
                            onClick={readCurrentPage}
                            aria-label={t(
                              "accessibility.ttsPlay",
                              "Read Page Aloud",
                            )}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-colors cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {t("accessibility.ttsPlay", "Read Page")}
                            </span>
                          </button>
                        ) : isPaused ? (
                          <button
                            type="button"
                            onClick={resumeSpeech}
                            aria-label={t(
                              "accessibility.ttsResume",
                              "Resume Speech",
                            )}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {t("accessibility.ttsResume", "Resume")}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={pauseSpeech}
                            aria-label={t(
                              "accessibility.ttsPause",
                              "Pause Speech",
                            )}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition-colors cursor-pointer"
                          >
                            <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{t("accessibility.ttsPause", "Pause")}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={stopSpeech}
                          disabled={!isSpeaking && !isPaused}
                          aria-label={t(
                            "accessibility.ttsStop",
                            "Stop Reading",
                          )}
                          className="flex items-center justify-center p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>

                      {/* Speed Rate Control */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>
                          {t("accessibility.ttsSpeed", "Rate")}: {ttsRate}x
                        </span>
                        <div className="flex items-center gap-1">
                          {[0.8, 1.0, 1.25, 1.5].map((speed) => (
                            <button
                              key={speed}
                              type="button"
                              onClick={() => setTtsRate(speed)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                                ttsRate === speed
                                  ? "bg-indigo-600 text-white"
                                  : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {speed}x
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Dynamic Speech Announcement Status */}
                      {speechNotice && (
                        <div
                          role="status"
                          aria-live="polite"
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium italic"
                        >
                          {speechNotice}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Reset Button */}
            <div className="pt-2 flex justify-between items-center text-[11px]">
              <span className="text-slate-400 dark:text-slate-500">
                {t("accessibility.saved", "Preferences save automatically")}
              </span>
              <button
                type="button"
                onClick={resetPreferences}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>{t("accessibility.reset", "Reset")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
