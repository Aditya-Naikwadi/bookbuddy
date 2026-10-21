import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import es from "./locales/es.json";
import hi from "./locales/hi.json";
import mr from "./locales/mr.json";

const savedLanguage =
  typeof localStorage !== "undefined"
    ? localStorage.getItem("language") || "en"
    : "en";

if (typeof document !== "undefined") {
  document.documentElement.lang = savedLanguage;
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    hi: { translation: hi },
    mr: { translation: mr },
  },
  lng: savedLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (lng) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("language", lng);
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
});

export default i18n;
