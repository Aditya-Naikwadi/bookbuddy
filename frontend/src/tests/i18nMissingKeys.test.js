import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.join(__dirname, "..", "i18n", "locales");

function getLeafKeys(obj, prefix = "") {
  let keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys = keys.concat(getLeafKeys(value, fullPath));
    } else {
      keys.push({ path: fullPath, value });
    }
  }
  return keys;
}

function getNestedValue(obj, pathStr) {
  const parts = pathStr.split(".");
  let curr = obj;
  for (const part of parts) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[part];
  }
  return curr;
}

describe("Feature 1: Vernacular i18n Key Parity & Missing-Key Prevention", () => {
  const enRaw = fs.readFileSync(path.join(localesDir, "en.json"), "utf8");
  const en = JSON.parse(enRaw);
  const enLeaves = getLeafKeys(en);

  it("1. en.json contains all required top-level domain sections", () => {
    expect(en).toHaveProperty("app");
    expect(en).toHaveProperty("nav");
    expect(en).toHaveProperty("landing");
    expect(en).toHaveProperty("general");
    expect(en).toHaveProperty("student");
    expect(en).toHaveProperty("common");
    expect(enLeaves.length).toBeGreaterThan(150);
  });

  it("2. hi.json (Hindi) has 100% key parity with en.json without missing or empty strings", () => {
    const hiRaw = fs.readFileSync(path.join(localesDir, "hi.json"), "utf8");
    const hi = JSON.parse(hiRaw);

    const missingKeys = [];
    const emptyKeys = [];

    for (const { path: keyPath } of enLeaves) {
      const val = getNestedValue(hi, keyPath);
      if (val === undefined) {
        missingKeys.push(keyPath);
      } else if (typeof val === "string" && val.trim() === "") {
        emptyKeys.push(keyPath);
      }
    }

    expect(
      missingKeys,
      `Missing keys in hi.json: ${missingKeys.join(", ")}`,
    ).toEqual([]);
    expect(emptyKeys, `Empty keys in hi.json: ${emptyKeys.join(", ")}`).toEqual(
      [],
    );
  });

  it("3. mr.json (Marathi) has 100% key parity with en.json without missing or empty strings", () => {
    const mrRaw = fs.readFileSync(path.join(localesDir, "mr.json"), "utf8");
    const mr = JSON.parse(mrRaw);

    const missingKeys = [];
    const emptyKeys = [];

    for (const { path: keyPath } of enLeaves) {
      const val = getNestedValue(mr, keyPath);
      if (val === undefined) {
        missingKeys.push(keyPath);
      } else if (typeof val === "string" && val.trim() === "") {
        emptyKeys.push(keyPath);
      }
    }

    expect(
      missingKeys,
      `Missing keys in mr.json: ${missingKeys.join(", ")}`,
    ).toEqual([]);
    expect(emptyKeys, `Empty keys in mr.json: ${emptyKeys.join(", ")}`).toEqual(
      [],
    );
  });

  it("4. es.json (Spanish) has 100% key parity with en.json", () => {
    const esRaw = fs.readFileSync(path.join(localesDir, "es.json"), "utf8");
    const es = JSON.parse(esRaw);

    const missingKeys = [];
    for (const { path: keyPath } of enLeaves) {
      const val = getNestedValue(es, keyPath);
      if (val === undefined) {
        missingKeys.push(keyPath);
      }
    }

    expect(
      missingKeys,
      `Missing keys in es.json: ${missingKeys.join(", ")}`,
    ).toEqual([]);
  });

  it("5. Intentionally missing key test: a missing key in a test object triggers failure", () => {
    const mockHiMissingKey = { ...en };
    delete mockHiMissingKey.landing.heroBadge;

    const missingKeys = [];
    for (const { path: keyPath } of enLeaves) {
      const val = getNestedValue(mockHiMissingKey, keyPath);
      if (val === undefined) {
        missingKeys.push(keyPath);
      }
    }
    expect(missingKeys).toContain("landing.heroBadge");
  });
});
