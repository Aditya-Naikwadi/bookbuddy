/* eslint-none */
// Web Worker for non-blocking CSV parsing & client-side validation

self.onmessage = function (e) {
  const { fileContent } = e.data;
  if (!fileContent || typeof fileContent !== 'string') {
    self.postMessage({ type: 'ERROR', message: 'Empty or invalid file content provided.' });
    return;
  }

  try {
    const lines = parseCSV(fileContent);
    if (lines.length < 2) {
      self.postMessage({
        type: 'ERROR',
        message: 'File must contain a header row and at least one student data row.',
      });
      return;
    }

    const headers = lines[0].map((h) => h.trim().toLowerCase());
    const dataRows = lines.slice(1).filter((r) => r.some((cell) => cell.trim() !== ''));

    // Map column headers
    const getColumnIndex = (possibleNames) =>
      headers.findIndex((h) => possibleNames.some((p) => h.includes(p)));

    const idIdx = getColumnIndex(['student id', 'studentid', 'id']);
    const nameIdx = getColumnIndex(['full name', 'name', 'student name']);
    const emailIdx = getColumnIndex(['email', 'mail']);
    const deptIdx = getColumnIndex(['department', 'dept', 'major']);
    const yearIdx = getColumnIndex(['year', 'batch', 'class']);
    const labIdx = getColumnIndex(['lab', 'seat', 'preferred lab']);
    const houseIdx = getColumnIndex(['house', 'guild']);

    const seenIds = new Set();
    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    const parsedRows = dataRows.map((row, index) => {
      const rowId = index + 1;
      const rawId = (row[idIdx] || '').trim();
      const rawName = (row[nameIdx] || '').trim();
      const rawEmail = (row[emailIdx] || '').trim();
      const rawDept = deptIdx !== -1 ? (row[deptIdx] || '').trim() : '';
      const rawYear = yearIdx !== -1 ? (row[yearIdx] || '').trim() : '';
      const rawLab = labIdx !== -1 ? (row[labIdx] || '').trim() : '';
      const rawHouse = houseIdx !== -1 ? (row[houseIdx] || '').trim() : '';

      const errors = [];
      const warnings = [];

      // Validation Rules
      if (!rawId) {
        errors.push('Missing Student ID');
      } else if (seenIds.has(rawId.toUpperCase())) {
        errors.push(`Duplicate Student ID inside file (${rawId})`);
      } else {
        seenIds.add(rawId.toUpperCase());
      }

      if (!rawName) {
        errors.push('Missing Full Name');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!rawEmail) {
        errors.push('Missing Email Address');
      } else if (!emailRegex.test(rawEmail)) {
        errors.push(`Invalid email format (${rawEmail})`);
      }

      if (!rawDept) {
        warnings.push('Department not specified');
      }

      let status = 'valid';
      if (errors.length > 0) {
        status = 'error';
        errorCount++;
      } else if (warnings.length > 0) {
        status = 'warning';
        warningCount++;
      } else {
        validCount++;
      }

      return {
        rowId,
        studentId: rawId,
        name: rawName,
        email: rawEmail,
        department: rawDept,
        year: rawYear,
        preferredLab: rawLab,
        house: rawHouse,
        status,
        errors,
        warnings,
      };
    });

    self.postMessage({
      type: 'COMPLETE',
      rows: parsedRows,
      summary: {
        total: parsedRows.length,
        valid: validCount,
        warning: warningCount,
        error: errorCount,
      },
    });
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      message: err.message || 'Failed to parse CSV file content.',
    });
  }
};

// Utility to parse CSV considering quoted values
function parseCSV(text) {
  const result = [];
  let row = [];
  let inQuotes = false;
  let currentToken = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentToken += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentToken);
      currentToken = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentToken);
      currentToken = '';
      if (row.some((cell) => cell.trim() !== '')) {
        result.push(row);
      }
      row = [];
    } else {
      currentToken += char;
    }
  }

  if (currentToken || row.length > 0) {
    row.push(currentToken);
    if (row.some((cell) => cell.trim() !== '')) {
      result.push(row);
    }
  }

  return result;
}
