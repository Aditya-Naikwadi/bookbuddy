/**
 * Static Analysis Script: Check-Then-Act Race Condition Detector
 *
 * Heuristically detects the unsafe check-then-act pattern in backend/src:
 * 1. Reads a document via Model.findOne(...) / Model.findById(...).
 * 2. Branches on document fields (if (doc.status ...), if (doc.count ...)).
 * 3. Later saves via doc.save() instead of an atomic update.
 *
 * Suggests refactoring to atomicConditionalUpdate from src/utils/atomicUpdateHelper.js.
 */

const fs = require('fs');
const path = require('path');
const espree = require('espree');

const ROOT_DIR = path.resolve(__dirname, '../../backend/src');
const EXCLUDE_DIRS = ['tests', 'node_modules'];

const QUERY_METHODS = new Set(['findOne', 'findById', 'find']);
const SUSPICIOUS_FIELD_PATTERNS = [
  'status',
  'count',
  'capacity',
  'available',
  'amount',
  'balance',
  'freezes',
  'quota',
  'coupon',
];

const warnings = [];

function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        results = results.concat(getAllJsFiles(filePath));
      }
    } else if (file.endsWith('.js')) {
      results.push(filePath);
    }
  });
  return results;
}

function traverse(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach((c) => traverse(c, visitor));
    } else if (child && typeof child === 'object') {
      traverse(child, visitor);
    }
  }
}

function analyzeFile(filePath) {
  const relPath = path.relative(ROOT_DIR, filePath);
  const code = fs.readFileSync(filePath, 'utf8');

  let ast;
  try {
    ast = espree.parse(code, {
      ecmaVersion: 'latest',
      loc: true,
      sourceType: 'script',
    });
  } catch (_e) {
    try {
      ast = espree.parse(code, {
        ecmaVersion: 'latest',
        loc: true,
        sourceType: 'module',
      });
    } catch (_parseErr) {
      return;
    }
  }

  // Traverse functions to check for read -> branch -> save patterns
  traverse(ast, (node) => {
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression'
    ) {
      const docVars = new Map(); // varName -> declarationLine

      traverse(node.body, (innerNode) => {
        // Track: const doc = await Model.findOne(...)
        if (innerNode.type === 'VariableDeclarator' && innerNode.id && innerNode.id.type === 'Identifier') {
          const varName = innerNode.id.name;
          let init = innerNode.init;
          if (init && init.type === 'AwaitExpression') {
            init = init.argument;
          }
          if (init && init.type === 'CallExpression' && init.callee && init.callee.type === 'MemberExpression') {
            const propName = init.callee.property && init.callee.property.name;
            if (QUERY_METHODS.has(propName)) {
              docVars.set(varName, { line: innerNode.loc.start.line, checked: false });
            }
          }
        }

        // Track: if (doc.status === ...)
        if (innerNode.type === 'IfStatement') {
          traverse(innerNode.test, (testNode) => {
            if (testNode.type === 'MemberExpression' && testNode.object && testNode.object.type === 'Identifier') {
              const varName = testNode.object.name;
              if (docVars.has(varName)) {
                const prop = testNode.property && testNode.property.name;
                if (prop && SUSPICIOUS_FIELD_PATTERNS.some((p) => prop.toLowerCase().includes(p))) {
                  const info = docVars.get(varName);
                  info.checked = true;
                  info.field = prop;
                  info.branchLine = testNode.loc.start.line;
                }
              }
            }
          });
        }

        // Track: await doc.save()
        if (innerNode.type === 'CallExpression' && innerNode.callee && innerNode.callee.type === 'MemberExpression') {
          const propName = innerNode.callee.property && innerNode.callee.property.name;
          if (propName === 'save' && innerNode.callee.object && innerNode.callee.object.type === 'Identifier') {
            const varName = innerNode.callee.object.name;
            const info = docVars.get(varName);
            if (info && info.checked) {
              warnings.push({
                file: relPath,
                readQueryLine: info.line,
                branchLine: info.branchLine,
                saveLine: innerNode.loc.start.line,
                variable: varName,
                field: info.field,
              });
            }
          }
        }
      });
    }
  });
}

function run() {
  console.log('--- Check-Then-Act Race Condition Scanner ---');
  console.log(`Scanning: ${ROOT_DIR}\n`);

  const files = getAllJsFiles(ROOT_DIR);
  files.forEach(analyzeFile);

  console.log(`Scanned ${files.length} files.`);
  if (warnings.length === 0) {
    console.log('[PASS] Zero unmitigated check-then-act patterns detected on sensitive resource fields.\n');
    process.exit(0);
  } else {
    console.log(`[INFO] Found ${warnings.length} candidate check-then-act pattern(s) for manual review:\n`);
    warnings.forEach((w, idx) => {
      console.log(`  ${idx + 1}. ${w.file} (variable: "${w.variable}", field: "${w.field}")`);
      console.log(`     - Read at line ${w.readQueryLine}`);
      console.log(`     - Branch at line ${w.branchLine}`);
      console.log(`     - Save at line ${w.saveLine}`);
      console.log('     -> Recommendation: Consider atomicConditionalUpdate if field is shared/contended.\n');
    });
    // Exit cleanly as this is a heuristic advisor
    process.exit(0);
  }
}

run();
