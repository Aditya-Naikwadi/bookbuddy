const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../src');
const esmDir = path.resolve(__dirname, '../esm');

function convertCjsToEsm(content) {
  let result = content;

  // Replace require('zod')
  result = result.replace(/const\s+\{\s*([^}]+)\s*\}\s*=\s*require\(['"]zod['"]\);?/g, "import { $1 } from 'zod';");

  // Replace local relative destructure requires
  result = result.replace(/const\s+\{\s*([^}]+)\s*\}\s*=\s*require\(['"]([^'"]+)['"]\);?/g, (match, imports, relPath) => {
    const ext = relPath.endsWith('.js') ? '' : '.js';
    return `import { ${imports} } from '${relPath}${ext}';`;
  });

  // Replace default/whole module require: const foo = require('./foo');
  result = result.replace(/const\s+([a-zA-Z0-9_]+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g, (match, varName, relPath) => {
    const ext = relPath.endsWith('.js') ? '' : '.js';
    return `import * as ${varName} from '${relPath}${ext}';`;
  });

  // Replace module.exports = { ... };
  result = result.replace(/module\.exports\s*=\s*\{([^}]+)\};?/g, (match, exportsList) => {
    const rawTokens = exportsList
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const namedExports = rawTokens.map((t) => {
      if (t.includes(':')) {
        const [alias, source] = t.split(':').map((s) => s.trim());
        return `${source} as ${alias}`;
      }
      return t;
    });

    const defaultExports = rawTokens.map((t) => t);

    return `export {\n  ${namedExports.join(',\n  ')},\n};\nexport default {\n  ${defaultExports.join(',\n  ')},\n};`;
  });

  return result;
}

function processDirectory(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const tgtPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      processDirectory(srcPath, tgtPath);
    } else if (entry.name.endsWith('.js')) {
      if (entry.name === 'index.js' && source === srcDir) {
        // Canonical ESM root barrel
        const esmIndexContent = `export * from './schemas/common.js';
export * from './schemas/moderation.js';
export * from './schemas/auth.js';
export * from './schemas/joinRequests.js';
export * from './schemas/facilities.js';
export * from './schemas/payments.js';
export * from './schemas/admin.js';
export * from './schemas/library.js';
export * from './schemas/personalization.js';
export * from './constants/roles.js';
export * from './utils/normalization.js';
export * from './utils/url.js';
`;
        fs.writeFileSync(tgtPath, esmIndexContent, 'utf8');
      } else {
        const cjsContent = fs.readFileSync(srcPath, 'utf8');
        const esmContent = convertCjsToEsm(cjsContent);
        fs.writeFileSync(tgtPath, esmContent, 'utf8');
      }
    }
  }
}

processDirectory(srcDir, esmDir);
console.log('✅ Successfully built @bookbuddy/shared ESM modules in shared/esm/');
