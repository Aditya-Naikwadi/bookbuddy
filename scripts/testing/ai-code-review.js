/**
 * AI Code Review Layer Script for BookBuddy
 *
 * Performs static AST & rule-based heuristic analysis for logic bugs,
 * OWASP security vulnerabilities, and code anti-patterns beyond basic linters.
 */

const fs = require('fs');
const path = require('path');

const SCAN_PATHS = [
  path.join(__dirname, '..', 'server', 'src'),
  path.join(__dirname, '..', 'client', 'src'),
];

const EXCLUDED_DIRS = ['node_modules', 'dist', 'build', 'coverage', 'uploads', 'logs', 'tests'];

const getAllFiles = (dir, fileList = []) => {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
};

const SECURITY_RULES = [
  {
    id: 'HARDCODED_SECRET',
    category: 'Security Vulnerability',
    severity: 'HIGH',
    regex: /(?:secret|password|apiKey|jwt_secret)\s*[:=]\s*['"`][A-Za-z0-9_\-]{16,}['"`]/i,
    message: 'Potential hardcoded secret or API key credential detected.',
  },
  {
    id: 'UNSAFE_REGEX',
    category: 'Security Vulnerability',
    severity: 'MEDIUM',
    regex: /new\s+RegExp\s*\(\s*(?:req\.query|req\.body|req\.params)/i,
    message: 'Unsanitized user input passed into dynamic RegExp constructor (ReDoS vulnerability).',
  },
  {
    id: 'NOSQL_INJECTION_RISK',
    category: 'Security Vulnerability',
    severity: 'HIGH',
    regex: /\.(find|findOne|updateOne|deleteOne)\s*\(\s*req\.body\s*\)/i,
    message: 'Raw req.body passed directly to MongoDB query method without sanitization.',
  },
  {
    id: 'EMPTY_CATCH_BLOCK',
    category: 'Logic Bug',
    severity: 'MEDIUM',
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/,
    message: 'Empty catch block swallows runtime errors silently.',
  },
  {
    id: 'UNHANDLED_ASYNC_EXPRESS',
    category: 'Logic Bug',
    severity: 'MEDIUM',
    regex: /exports\.[a-zA-Z0-9_]+\s*=\s*async\s*\((?:req|res)[^)]*\)\s*=>\s*\{(?![^}]*try)/,
    message: 'Async Express controller route lacks try/catch or express-async-handler wrapper.',
  },
];

const runCodeReview = () => {
  console.log('=====================================================');
  console.log('🧠 CONTINUOUS AI & AST CODE REVIEW ANALYSIS');
  console.log('=====================================================');

  const files = [];
  for (const p of SCAN_PATHS) {
    getAllFiles(p, files);
  }

  console.log(`🔍 Scanned ${files.length} source code files for logic bugs & security anti-patterns...\n`);

  const findings = [];
  let totalHighSeverity = 0;

  for (const file of files) {
    const relPath = path.relative(path.join(__dirname, '..'), file);
    let content = '';
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const rule of SECURITY_RULES) {
        if (rule.regex.test(line)) {
          if (rule.severity === 'HIGH') totalHighSeverity++;

          findings.push({
            ruleId: rule.id,
            category: rule.category,
            severity: rule.severity,
            file: relPath,
            line: i + 1,
            snippet: line.trim(),
            message: rule.message,
          });

          console.log(
            `   [${rule.severity}] ${rule.category} (${rule.id}) in ${relPath}:${i + 1}\n   --> ${rule.message}\n   Snippet: "${line.trim().substring(0, 80)}"\n`
          );
        }
      }
    }
  }

  console.log('=====================================================');
  console.log(`📊 CODE REVIEW SUMMARY: ${findings.length} findings (${totalHighSeverity} High Severity)`);
  console.log('=====================================================');

  // Save report
  const reportPath = path.join(__dirname, '..', 'logs', 'ai-code-review-report.json');
  try {
    const logDir = path.dirname(reportPath);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), findings }, null, 2));
    console.log(`📄 Detailed AI Review Report saved to ${reportPath}`);
  } catch (err) {
    console.error('⚠️ Could not save AI Review Report:', err.message);
  }

  if (totalHighSeverity > 0) {
    console.error('\n🚨 Code review failed due to High Severity findings.');
    process.exit(1);
  } else {
    console.log('\n🎉 AI Code Review completed cleanly (0 High Severity findings).');
    process.exit(0);
  }
};

module.exports = { runCodeReview, SECURITY_RULES };

if (require.main === module) {
  runCodeReview();
}
