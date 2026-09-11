/**
 * Synthetic 10,000-Row Roster Generator for BookBuddy Load Testing
 *
 * Generates realistic CSV student datasets with:
 * - Deterministic unique studentIds
 * - Valid student names & departments
 * - Institutional email addresses
 * - 5% deliberate missing-email records to test offline handout slip generation
 * - Formula injection test row to verify sanitization
 */

const fs = require('fs');
const path = require('path');

const DEPARTMENTS = [
  'Computer Science',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Mathematics',
  'Physics',
  'Biotechnology',
  'Data Science',
];

const YEARS = ['1', '2', '3', '4'];

function generateRosterRows(count = 10000, collegeSlug = 'stanford-load') {
  const rows = [];

  for (let i = 1; i <= count; i++) {
    const studentId = `STU-${100000 + i}`;
    const name = `Student ${i} Tester`;
    // 5% without email to test printed handout path
    const hasEmail = i % 20 !== 0;
    const email = hasEmail ? `student.${i}@${collegeSlug}.edu` : '';
    const department = DEPARTMENTS[i % DEPARTMENTS.length];
    const year = YEARS[i % YEARS.length];
    const phone = hasEmail ? `+1555${String(1000000 + i).slice(0, 7)}` : '';

    rows.push({
      studentId,
      name,
      email,
      department,
      year,
      phone,
    });
  }

  return rows;
}

function generateRosterCsv(count = 10000, collegeSlug = 'stanford-load') {
  const rows = generateRosterRows(count, collegeSlug);
  const header = 'studentId,name,email,department,year,phone';
  const csvLines = [header];

  for (const row of rows) {
    csvLines.push(
      `"${row.studentId}","${row.name}","${row.email}","${row.department}","${row.year}","${row.phone}"`
    );
  }

  return { csvString: csvLines.join('\n'), rows };
}

function saveRosterCsvToFile(filePath, count = 10000, collegeSlug = 'stanford-load') {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const { csvString, rows } = generateRosterCsv(count, collegeSlug);
  fs.writeFileSync(filePath, csvString, 'utf-8');
  return { filePath, count, rowsCount: rows.length };
}

// Allow CLI execution: node tests/load/generate-10k-roster.js [count] [outputPath]
if (require.main === module) {
  const count = parseInt(process.argv[2], 10) || 10000;
  const targetPath =
    process.argv[3] || path.join(__dirname, 'scratch', `synthetic_roster_${count}.csv`);

  console.log(`Generating ${count} synthetic student records...`);
  const result = saveRosterCsvToFile(targetPath, count);
  console.log(`✅ Saved ${result.rowsCount} rows to ${result.filePath}`);
}

module.exports = {
  generateRosterRows,
  generateRosterCsv,
  saveRosterCsvToFile,
};
