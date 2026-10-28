/**
 * Script to verify 100% key parity across translation files.
 * Fails the build with exit code 1 if any key in en.json is missing or empty in hi.json, mr.json, or es.json.
 */
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const languages = ['hi', 'mr', 'es'];

function loadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to load JSON file at ${filePath}:`, err.message);
    process.exit(1);
  }
}

function getLeafKeys(obj, prefix = '') {
  let keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys = keys.concat(getLeafKeys(value, fullPath));
    } else {
      keys.push({ path: fullPath, value });
    }
  }
  return keys;
}

function getNestedValue(obj, pathStr) {
  const parts = pathStr.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[part];
  }
  return curr;
}

const enPath = path.join(localesDir, 'en.json');
const enData = loadJson(enPath);
const enLeaves = getLeafKeys(enData);

console.log(`[i18n-check] Validating key parity against English (${enLeaves.length} keys)...`);

let hasErrors = false;

for (const lang of languages) {
  const targetPath = path.join(localesDir, `${lang}.json`);
  if (!fs.existsSync(targetPath)) {
    console.error(`[i18n-check] FATAL: Missing locale file: ${targetPath}`);
    hasErrors = true;
    continue;
  }

  const targetData = loadJson(targetPath);
  const missingKeys = [];
  const emptyKeys = [];

  for (const { path: keyPath } of enLeaves) {
    const val = getNestedValue(targetData, keyPath);
    if (val === undefined) {
      missingKeys.push(keyPath);
    } else if (typeof val === 'string' && val.trim() === '') {
      emptyKeys.push(keyPath);
    }
  }

  if (missingKeys.length > 0 || emptyKeys.length > 0) {
    hasErrors = true;
    console.error(`\n[i18n-check] ERROR: Parity failure for locale '${lang}':`);
    if (missingKeys.length > 0) {
      console.error(`  Missing (${missingKeys.length} keys):`);
      missingKeys.slice(0, 10).forEach(k => console.error(`    - ${k}`));
      if (missingKeys.length > 10) console.error(`    ... and ${missingKeys.length - 10} more`);
    }
    if (emptyKeys.length > 0) {
      console.error(`  Empty string (${emptyKeys.length} keys):`);
      emptyKeys.slice(0, 10).forEach(k => console.error(`    - ${k}`));
      if (emptyKeys.length > 10) console.error(`    ... and ${emptyKeys.length - 10} more`);
    }
  } else {
    console.log(`[i18n-check] [OK] Locale '${lang}' has 100% key parity with English (${enLeaves.length} keys).`);
  }
}

if (hasErrors) {
  console.error('\n[i18n-check] BUILD FAILED: Missing i18n translation keys detected.');
  process.exit(1);
} else {
  console.log('[i18n-check] SUCCESS: All locale files verified.\n');
  process.exit(0);
}

