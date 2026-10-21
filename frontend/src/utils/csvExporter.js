/**
 * Utility function to export array of JSON objects as a downloadable CSV file.
 * @param {Array<Object>} data - Array of data objects
 * @param {String} filename - Output CSV filename
 */
export function exportToCSV(data, filename = "export.csv") {
  if (!data || !data.length) {
    alert("No data available to export.");
    return;
  }

  // Extract headers
  const headers = Object.keys(data[0]);

  // Convert objects to CSV rows
  const csvRows = [];
  csvRows.push(headers.join(","));

  for (const row of data) {
    const values = headers.map((header) => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      let rawStr = typeof val === "object" ? JSON.stringify(val) : String(val);

      // P0 Anti-Formula Injection Defense: Neutralize dangerous spreadsheet execution prefixes (=, +, -, @, \t, \r)
      if (/^[=+\-@\t\r]/.test(rawStr)) {
        rawStr = `'` + rawStr;
      }

      return `"${rawStr.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }

  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
