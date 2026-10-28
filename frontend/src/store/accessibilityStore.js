import { create } from "zustand";
import apiClient from "../api/client";

const isBrowser = typeof window !== "undefined";

const checkSpeechSupport = () => {
  return (
    isBrowser &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
};

const getStorageKey = (userId) => {
  return `bookbuddy_a11y_${userId || "guest"}`;
};

const loadStoredPreferences = (userId) => {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveStoredPreferences = (userId, prefs) => {
  if (!isBrowser) return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(prefs));
  } catch {
    // Ignore storage write errors
  }
};

const applyDomClasses = ({ dyslexiaFont, highContrast }) => {
  if (!isBrowser) return;

  if (dyslexiaFont) {
    document.body.classList.add("dyslexia-font");
  } else {
    document.body.classList.remove("dyslexia-font");
  }

  if (highContrast) {
    document.documentElement.classList.add("high-contrast");
    document.body.classList.add("high-contrast");
  } else {
    document.documentElement.classList.remove("high-contrast");
    document.body.classList.remove("high-contrast");
  }
};

export const useAccessibilityStore = create((set, get) => {
  const isSpeechSupported = checkSpeechSupport();
  const initialPrefs = loadStoredPreferences("guest") || {};

  // Apply initial DOM classes
  applyDomClasses({
    dyslexiaFont: !!initialPrefs.dyslexiaFont,
    highContrast: !!initialPrefs.highContrast,
  });

  return {
    // State
    currentUserId: "guest",
    dyslexiaFont: !!initialPrefs.dyslexiaFont,
    highContrast: !!initialPrefs.highContrast,
    textToSpeech: !!initialPrefs.textToSpeech,
    ttsRate: initialPrefs.ttsRate || 1.0,
    ttsPitch: initialPrefs.ttsPitch || 1.0,
    isSpeaking: false,
    isPaused: false,
    isSpeechSupported,
    speechNotice: !isSpeechSupported
      ? "Text-to-speech is not supported by your current browser. Please use Google Chrome or a modern browser with Web Speech API support."
      : null,
    isToolbarOpen: false,

    // Actions
    setUserId: (userId) => {
      const activeUserId = userId || "guest";
      const stored = loadStoredPreferences(activeUserId) || {};
      const newPrefs = {
        currentUserId: activeUserId,
        dyslexiaFont: !!stored.dyslexiaFont,
        highContrast: !!stored.highContrast,
        textToSpeech: !!stored.textToSpeech,
        ttsRate: stored.ttsRate || 1.0,
        ttsPitch: stored.ttsPitch || 1.0,
      };
      set(newPrefs);
      applyDomClasses(newPrefs);
    },

    toggleDyslexiaFont: () => {
      const state = get();
      const updated = !state.dyslexiaFont;
      const nextState = { dyslexiaFont: updated };
      set(nextState);
      applyDomClasses({
        dyslexiaFont: updated,
        highContrast: state.highContrast,
      });

      const fullPrefs = {
        dyslexiaFont: updated,
        highContrast: state.highContrast,
        textToSpeech: state.textToSpeech,
        ttsRate: state.ttsRate,
        ttsPitch: state.ttsPitch,
      };
      saveStoredPreferences(state.currentUserId, fullPrefs);
      get().syncWithServer(fullPrefs);
    },

    toggleHighContrast: () => {
      const state = get();
      const updated = !state.highContrast;
      const nextState = { highContrast: updated };
      set(nextState);
      applyDomClasses({
        dyslexiaFont: state.dyslexiaFont,
        highContrast: updated,
      });

      const fullPrefs = {
        dyslexiaFont: state.dyslexiaFont,
        highContrast: updated,
        textToSpeech: state.textToSpeech,
        ttsRate: state.ttsRate,
        ttsPitch: state.ttsPitch,
      };
      saveStoredPreferences(state.currentUserId, fullPrefs);
      get().syncWithServer(fullPrefs);
    },

    toggleTextToSpeech: () => {
      const state = get();
      const updated = !state.textToSpeech;
      if (!updated && state.isSpeaking) {
        get().stopSpeech();
      }
      set({ textToSpeech: updated, isSpeechSupported: checkSpeechSupport() });

      const fullPrefs = {
        dyslexiaFont: state.dyslexiaFont,
        highContrast: state.highContrast,
        textToSpeech: updated,
        ttsRate: state.ttsRate,
        ttsPitch: state.ttsPitch,
      };
      saveStoredPreferences(state.currentUserId, fullPrefs);
      get().syncWithServer(fullPrefs);
    },

    setTtsRate: (rate) => {
      const state = get();
      set({ ttsRate: rate });
      const fullPrefs = {
        dyslexiaFont: state.dyslexiaFont,
        highContrast: state.highContrast,
        textToSpeech: state.textToSpeech,
        ttsRate: rate,
        ttsPitch: state.ttsPitch,
      };
      saveStoredPreferences(state.currentUserId, fullPrefs);
      get().syncWithServer(fullPrefs);
    },

    toggleToolbar: () => {
      set((state) => ({ isToolbarOpen: !state.isToolbarOpen }));
    },

    closeToolbar: () => {
      set({ isToolbarOpen: false });
    },

    openToolbar: () => {
      set({ isToolbarOpen: true });
    },

    resetPreferences: () => {
      const state = get();
      const resetPrefs = {
        dyslexiaFont: false,
        highContrast: false,
        textToSpeech: false,
        ttsRate: 1.0,
        ttsPitch: 1.0,
      };
      get().stopSpeech();
      set(resetPrefs);
      applyDomClasses(resetPrefs);
      saveStoredPreferences(state.currentUserId, resetPrefs);
      get().syncWithServer(resetPrefs);
    },

    // Speech Controls
    checkSupport: () => {
      const supported = checkSpeechSupport();
      set({ isSpeechSupported: supported });
      return supported;
    },

    speakText: (text) => {
      if (!isBrowser) return;

      const supported = checkSpeechSupport();
      if (!supported) {
        set({
          isSpeechSupported: false,
          speechNotice:
            "Text-to-speech is not supported by your current browser. Please use Google Chrome or a modern browser with Web Speech API support.",
        });
        return;
      }
      set({ isSpeechSupported: true });

      window.speechSynthesis.cancel();

      if (!text || typeof text !== "string" || text.trim() === "") {
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.rate = get().ttsRate || 1.0;
      utterance.pitch = get().ttsPitch || 1.0;

      utterance.onstart = () => {
        set({
          isSpeaking: true,
          isPaused: false,
          speechNotice: "Reading content aloud...",
        });
      };

      utterance.onend = () => {
        set({ isSpeaking: false, isPaused: false, speechNotice: null });
      };

      utterance.onpause = () => {
        set({ isPaused: true, speechNotice: "Speech paused" });
      };

      utterance.onresume = () => {
        set({ isPaused: false, speechNotice: "Reading content aloud..." });
      };

      utterance.onerror = (e) => {
        if (e.error !== "canceled" && e.error !== "interrupted") {
          set({
            isSpeaking: false,
            isPaused: false,
            speechNotice: "An error occurred while generating speech.",
          });
        } else {
          set({ isSpeaking: false, isPaused: false, speechNotice: null });
        }
      };

      window.speechSynthesis.speak(utterance);
    },

    readCurrentPage: () => {
      if (!isBrowser) return;

      const mainEl =
        document.getElementById("main-content") ||
        document.querySelector("main") ||
        document.querySelector("article");

      const text = mainEl ? mainEl.innerText : document.body.innerText;
      get().speakText(text);
    },

    pauseSpeech: () => {
      if (isBrowser && checkSpeechSupport()) {
        window.speechSynthesis.pause();
        set({ isPaused: true });
      }
    },

    resumeSpeech: () => {
      if (isBrowser && checkSpeechSupport()) {
        window.speechSynthesis.resume();
        set({ isPaused: false });
      }
    },

    stopSpeech: () => {
      if (isBrowser && checkSpeechSupport()) {
        window.speechSynthesis.cancel();
        set({ isSpeaking: false, isPaused: false, speechNotice: null });
      }
    },

    // Sync with backend API
    syncWithServer: async (prefs) => {
      const state = get();
      if (!state.currentUserId || state.currentUserId === "guest") return;

      try {
        await apiClient.patch("/users/me/accessibility", prefs);
      } catch {
        // Silent catch: offline or feature flag off falls back to local storage
      }
    },
  };
});
