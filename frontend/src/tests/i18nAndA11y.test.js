import { describe, it, expect, beforeEach } from "vitest";
import i18n from "../i18n/config";

describe("F8.6 & F8.7 — react-i18next & Language Switcher Integration", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders default English translation keys", () => {
    expect(i18n.t("app.title")).toBe("BookBuddy Library");
    expect(i18n.t("app.searchPlaceholder")).toBe(
      "Search catalog by title, author, or ISBN...",
    );
    expect(i18n.t("app.offlineDownloads")).toBe("Offline Downloads");
  });

  it("Acceptance Criteria F8.7: switching language updates extracted page text immediately without page reload", async () => {
    // Switch language to Spanish ('es')
    await i18n.changeLanguage("es");

    // ACCEPTANCE CRITERIA: Extracted keys update immediately
    expect(i18n.t("app.title")).toBe("Biblioteca BookBuddy");
    expect(i18n.t("app.searchPlaceholder")).toBe(
      "Buscar catálogo por título, autor o ISBN...",
    );
    expect(i18n.t("app.offlineDownloads")).toBe("Descargas sin Conexión");

    // Switch back to English
    await i18n.changeLanguage("en");
    expect(i18n.t("app.title")).toBe("BookBuddy Library");
  });
});
