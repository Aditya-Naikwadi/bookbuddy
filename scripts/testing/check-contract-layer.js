#!/usr/bin/env node

/**
 * CI Enforcement Script: check-contract-layer.js
 *
 * Enforces the Single Source of Truth architectural rule for API contracts:
 * Every backend route using validate() MUST import its schema from `@bookbuddy/shared`.
 *
 * Rules checked:
 * 1. Prohibits inline schema declarations in validate() (e.g., validate(z.object(...))).
 * 2. Prohibits local schema imports from `../validations/*` or local files.
 * 3. Requires all validate() arguments to be imported directly from `@bookbuddy/shared`.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const routesDir = path.join(projectRoot, 'backend/src/routes');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const routeFiles = getFiles(routesDir);
const violations = [];
let totalValidatedEndpoints = 0;

for (const file of routeFiles) {
  const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  // Collect all imported symbols from @bookbuddy/shared
  const sharedSymbols = new Set();
  const nonSharedValidationImports = [];

  // Parse require statements (handles multi-line and single-line requires)
  const requireRegex = /const\s+(?:{([^}]+)}|([a-zA-Z0-9_]+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let requireMatch;
  while ((requireMatch = requireRegex.exec(content)) !== null) {
    const destructure = requireMatch[1];
    const singleVar = requireMatch[2];
    const modulePath = requireMatch[3];

    const isShared = modulePath.startsWith('@bookbuddy/shared') || modulePath.startsWith('@shared');

    if (isShared) {
      if (destructure) {
        destructure.split(',').forEach((sym) => {
          const trimmed = sym.trim();
          if (trimmed) sharedSymbols.add(trimmed);
        });
      } else if (singleVar) {
        sharedSymbols.add(singleVar.trim());
      }
    } else if (modulePath.includes('validation')) {
      nonSharedValidationImports.push({ line: content.slice(0, requireMatch.index).split('\n').length, path: modulePath });
    }
  }

  // Flag any non-shared validation imports
  if (nonSharedValidationImports.length > 0) {
    for (const badImport of nonSharedValidationImports) {
      violations.push({
        file: relPath,
        line: badImport.line,
        issue: `Prohibited local validation import from "${badImport.path}". All contract schemas must be imported from "@bookbuddy/shared".`,
      });
    }
  }

  // Scan for validate(...) invocations
  const validateRegex = /validate\s*\(\s*([^)]+)\s*\)/g;
  let valMatch;
  while ((valMatch = validateRegex.exec(content)) !== null) {
    totalValidatedEndpoints++;
    const schemaArg = valMatch[1].trim();
    const lineIndex = content.slice(0, valMatch.index).split('\n').length;

    // Rule 1: Inline schema detection
    if (schemaArg.includes('z.') || schemaArg.includes('zod') || schemaArg.includes('{')) {
      violations.push({
        file: relPath,
        line: lineIndex,
        issue: `Inline Zod schema in validate(${schemaArg.slice(0, 30)}...). Schemas must be imported from "@bookbuddy/shared".`,
      });
      continue;
    }

    // Rule 2: Must be an imported symbol from @bookbuddy/shared
    if (!sharedSymbols.has(schemaArg)) {
      violations.push({
        file: relPath,
        line: lineIndex,
        issue: `Schema "${schemaArg}" passed to validate() is not imported from "@bookbuddy/shared".`,
      });
    }
  }
}

console.log('--- CI Structural Contract Layer Enforcement ---');
console.log(`Scanned ${routeFiles.length} route files across backend.`);
console.log(`Total validate() endpoints checked: ${totalValidatedEndpoints}`);

if (violations.length > 0) {
  console.error('\n❌ Architectural Contract Violations Detected:');
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} -> ${v.issue}`);
  }
  console.error('\nFAIL: All route validations must import schemas from @bookbuddy/shared to prevent API contract drift.\n');
  process.exit(1);
}

console.log('✅ PASS: All route validations strictly import from @bookbuddy/shared. Zero inline or local drift detected.\n');
process.exit(0);
