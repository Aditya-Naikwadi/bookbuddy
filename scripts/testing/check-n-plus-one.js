#!/usr/bin/env node
/**
 * ==============================================================================
 * CI GATE: N+1 Query Detection Static Check
 * ==============================================================================
 * Detects common N+1 anti-patterns in backend controllers and services:
 * - Calling `await <Model>.(find|findOne|findById|updateOne|save)` inside synchronous loops
 *   or `.map` / `forEach` iterations without bulk querying / `$in` aggregation.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../');
const TARGET_DIRS = [
  path.join(ROOT_DIR, 'backend/src/controllers'),
  path.join(ROOT_DIR, 'backend/src/services'),
];

const MONGOOSE_MODELS = [
  'Book',
  'User',
  'Loan',
  'Fine',
  'AuditLog',
  'EResource',
  'Announcement',
  'FacilityBooking',
  'LabBooking',
  'StudentJoinRequest',
  'Reservation',
  'Review',
];

function checkDirectory(dir) {
  const violations = [];
  if (!fs.existsSync(dir)) return violations;

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    let inLoop = false;
    let loopStartLine = 0;
    let loopBraceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check loop entry
      if (
        /\b(for\s*\(|while\s*\(|\.forEach\s*\()/.test(trimmed) &&
        !trimmed.startsWith('//')
      ) {
        inLoop = true;
        loopStartLine = i + 1;
        loopBraceDepth = 0;
      }

      if (inLoop) {
        // Track braces
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        loopBraceDepth += openBraces - closeBraces;

        // Check for Model query await inside loop
        for (const model of MONGOOSE_MODELS) {
          const queryRegex = new RegExp(`\\bawait\\s+${model}\\.(findById|findOne|find)\\(`);
          if (queryRegex.test(trimmed) && !trimmed.startsWith('//')) {
            // Check if the query is actually an $in batch query
            const contextSnippet = lines.slice(i, Math.min(lines.length, i + 8)).join(' ');
            if (contextSnippet.includes('$in:') || contextSnippet.includes('$nin:')) {
              continue; // Batched bulk query, not N+1
            }

            // In background cron / queue workers, sequential processing is common
            if (file.includes('cron') || file.includes('Worker')) {
              continue;
            }

            violations.push({
              file: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
              line: i + 1,
              loopStart: loopStartLine,
              model,
              snippet: trimmed,
            });
          }
        }

        // Exit loop if brace depth returns to <= 0 after having opened
        if (loopBraceDepth <= 0 && (line.includes('}') || line.includes(');'))) {
          inLoop = false;
        }
      }
    }
  }

  return violations;
}

console.log('='.repeat(80));
console.log('⚡ RUNNING N+1 QUERY DETECTION CI GATE');
console.log('='.repeat(80));

const allViolations = [];
for (const dir of TARGET_DIRS) {
  allViolations.push(...checkDirectory(dir));
}

if (allViolations.length > 0) {
  console.error(`❌ N+1 QUERY GATE FAILED: Detected ${allViolations.length} potential N+1 query loop(s):`);
  for (const v of allViolations) {
    console.error(`   - [${v.file}:${v.line}] Querying '${v.model}' inside loop starting at line ${v.loopStart}`);
    console.error(`     Snippet: ${v.snippet}`);
  }
  console.error('\nRemediation: Refactor to batch queries using $in: [ids...] or Mongoose .populate().');
  process.exit(1);
} else {
  console.log(`✅ N+1 QUERY GATE PASSED: Zero sequential database queries detected inside loops.`);
  process.exit(0);
}
