/**
 * Web Worker for Offloaded CSV / Tabular Roster Parsing
 * Parses CSV text, normalizes headers, sanitizes against formula injection,
 * detects in-file duplicates, and validates per-row structure without blocking UI thread.
 */

// Formula injection protection
const sanitizeCell = (val) => {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  if (["=", "+", "-", "@"].some((char) => trimmed.startsWith(char))) {
    return `'${trimmed}`;
  }
  return trimmed;
};

// RFC 4180 CSV parser handling quotes, escaped quotes (""), commas, and newlines
function parseCsvRows(text) {
  const rows = [];
  let currentRow = [];
  let currentVal = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentVal);
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++; // skip CRLF
      }
      currentRow.push(currentVal);
      if (currentRow.some((c) => c.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal);
    if (currentRow.some((c) => c.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeHeaderKey(header) {
  return header
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

self.onmessage = function (e) {
  const { fileContent, options: _options = {} } = e.data;

  if (!fileContent || typeof fileContent !== "string") {
    self.postMessage({
      type: "ERROR",
      message: "No valid file content provided.",
    });
    return;
  }

  try {
    const parsedRows = parseCsvRows(fileContent);

    if (parsedRows.length < 2) {
      self.postMessage({
        type: "ERROR",
        message:
          "File must contain at least a header row and one student data row.",
      });
      return;
    }

    const headers = parsedRows[0].map(normalizeHeaderKey);
    const dataRows = parsedRows.slice(1);

    // Map column indices
    const fieldIndices = {
      studentId: headers.findIndex((h) =>
        ["studentid", "rollnumber", "id", "studentno", "regno"].includes(h),
      ),
      name: headers.findIndex((h) =>
        ["name", "studentname", "fullname"].includes(h),
      ),
      email: headers.findIndex((h) =>
        ["email", "emailaddress", "studentemail"].includes(h),
      ),
      program: headers.findIndex((h) =>
        [
          "program",
          "degree",
          "course",
          "branch",
          "major",
          "department",
        ].includes(h),
      ),
      year: headers.findIndex((h) =>
        ["year", "classyear", "semester", "grade"].includes(h),
      ),
      phone: headers.findIndex((h) =>
        ["phone", "phonenumber", "mobile", "contact"].includes(h),
      ),
    };

    if (fieldIndices.studentId === -1) {
      self.postMessage({
        type: "ERROR",
        message: 'Missing required "StudentId" or "RollNumber" column header.',
      });
      return;
    }

    if (fieldIndices.name === -1) {
      self.postMessage({
        type: "ERROR",
        message: 'Missing required "Name" or "StudentName" column header.',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const errors = [];
    const validRows = [];
    const seenStudentIds = new Set();
    const seenEmails = new Set();

    const total = dataRows.length;
    let missingEmailCount = 0;

    dataRows.forEach((row, index) => {
      const rowNumber = index + 2; // Row 1 is header
      const rawStudentId = (row[fieldIndices.studentId] || "").trim();
      const rawName = (row[fieldIndices.name] || "").trim();
      const rawEmail =
        fieldIndices.email !== -1
          ? (row[fieldIndices.email] || "").trim().toLowerCase()
          : "";
      const rawProgram =
        fieldIndices.program !== -1
          ? (row[fieldIndices.program] || "").trim()
          : "";
      const rawYear =
        fieldIndices.year !== -1 ? (row[fieldIndices.year] || "").trim() : "";
      const rawPhone =
        fieldIndices.phone !== -1 ? (row[fieldIndices.phone] || "").trim() : "";

      // Validation
      if (!rawStudentId) {
        errors.push({
          rowNumber,
          studentId: "",
          name: rawName,
          email: rawEmail,
          reason: "Missing Student ID / Roll Number",
        });
        return;
      }

      if (!rawName) {
        errors.push({
          rowNumber,
          studentId: rawStudentId,
          name: "",
          email: rawEmail,
          reason: "Missing Student Name",
        });
        return;
      }

      // Check email format if present
      if (rawEmail && !emailRegex.test(rawEmail)) {
        errors.push({
          rowNumber,
          studentId: rawStudentId,
          name: rawName,
          email: rawEmail,
          reason: `Invalid email format (${rawEmail})`,
        });
        return;
      }

      // Duplicate check within file
      if (seenStudentIds.has(rawStudentId.toLowerCase())) {
        errors.push({
          rowNumber,
          studentId: rawStudentId,
          name: rawName,
          email: rawEmail,
          reason: `Duplicate Student ID (${rawStudentId}) in file`,
        });
        return;
      }

      if (rawEmail && seenEmails.has(rawEmail)) {
        errors.push({
          rowNumber,
          studentId: rawStudentId,
          name: rawName,
          email: rawEmail,
          reason: `Duplicate Email (${rawEmail}) in file`,
        });
        return;
      }

      seenStudentIds.add(rawStudentId.toLowerCase());
      if (rawEmail) {
        seenEmails.add(rawEmail);
      } else {
        missingEmailCount++;
      }

      validRows.push({
        rowNumber,
        studentId: sanitizeCell(rawStudentId),
        name: sanitizeCell(rawName),
        email: rawEmail ? sanitizeCell(rawEmail) : "",
        program: sanitizeCell(rawProgram),
        year: sanitizeCell(rawYear),
        phone: sanitizeCell(rawPhone),
        hasEmail: Boolean(rawEmail),
      });

      // Post progress every 500 rows
      if (index % 500 === 0 && index > 0) {
        self.postMessage({
          type: "PROGRESS",
          processed: index,
          total,
          percent: Math.round((index / total) * 100),
        });
      }
    });

    self.postMessage({
      type: "DONE",
      totalRows: total,
      validRowsCount: validRows.length,
      failedRowsCount: errors.length,
      missingEmailCount,
      validRows,
      errors,
    });
  } catch (err) {
    self.postMessage({
      type: "ERROR",
      message: `Worker parsing error: ${err.message}`,
    });
  }
};
