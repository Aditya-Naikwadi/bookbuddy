import { useState } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Send,
} from "lucide-react";

export default function StudentUploadPage() {
  const [, setFile] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [validationReport, setValidationReport] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Template Download
  const handleDownloadSampleCsv = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      encodeURIComponent(
        "StudentId,Name,Email,Program,Year\n" +
          "STU-2026-001,Arthur Pendelton,arthur@college.edu,Computer Science,Year 1\n" +
          "STU-2026-002,Beatrix Potter,beatrix@college.edu,English Literature,Year 2\n" +
          "STU-2026-003,Charles Xavier,charles@college.edu,Physics,Year 3\n",
      );
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "bookbuddy_roster_upload_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportRoster = () => {
    window.location.href = "/api/admin/students/export";
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      setFile(selectedFile);
      uploadAndValidateFile(selectedFile);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      uploadAndValidateFile(selectedFile);
    }
  };

  // Step 1: DRY RUN VALIDATION
  const uploadAndValidateFile = async (uploadFile) => {
    setIsValidating(true);
    setError(null);
    setValidationReport(null);
    setCommitResult(null);

    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const res = await fetch("/api/admin/students/upload/validate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to validate file.");
      }

      setValidationReport(data);
    } catch (err) {
      setError(err.message || "An error occurred during file validation.");
    } finally {
      setIsValidating(false);
    }
  };

  // Step 2: COMMIT ROSTER
  const handleConfirmCommit = async () => {
    if (!validationReport?.batchId || !validationReport?.validRowsPayload) {
      setError("No valid dry-run report found to commit.");
      return;
    }

    setIsCommitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/students/upload/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: validationReport.batchId,
          validRows: validationReport.validRowsPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to commit roster upload.");
      }

      setCommitResult(data);
      setValidationReport(null);
      setFile(null);
    } catch (err) {
      setError(err.message || "An error occurred while committing roster.");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/college-admin"
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Console</span>
        </Link>
      </div>

      {/* Hero Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs uppercase tracking-wider mb-1">
            <UploadCloud className="w-4 h-4" />
            <span>Patron Provisioning & Data Intake</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Bulk Student Roster Import (CSV / Excel)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
            Two-step secure upload: Dry-run validation checks formatting and
            duplicate IDs before writing data. Created students receive
            single-use activation links via email.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleDownloadSampleCsv}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>Template CSV</span>
          </button>
          <button
            onClick={handleExportRoster}
            className="px-4 py-2.5 rounded-xl border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 font-bold text-xs flex items-center gap-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
            <span>Export Roster CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Commitment Banner */}
      {commitResult && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-3 text-left">
          <div className="flex items-center gap-3 text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Roster Import Committed!
              </h3>
              <p className="text-xs text-emerald-300">{commitResult.message}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 text-xs font-mono">
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-slate-400 block">Accounts Created</span>
              <span className="text-base font-bold text-emerald-400">
                {commitResult.summary.createdCount}
              </span>
            </div>
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-slate-400 block">Records Updated</span>
              <span className="text-base font-bold text-indigo-400">
                {commitResult.summary.updatedCount}
              </span>
            </div>
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-slate-400 block">Total Processed</span>
              <span className="text-base font-bold text-slate-200">
                {commitResult.summary.totalCommitted}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Upload Drop Zone (Step 1) */}
      {!validationReport && !isValidating && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all bg-slate-900/60 ${
            dragActive
              ? "border-indigo-500 bg-indigo-950/20"
              : "border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            Drag and drop roster CSV/Excel here
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            Supports CSV, .XLSX, and .XLS files up to 5MB (max 5,000 rows)
          </p>

          <label className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 cursor-pointer transition">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Select File to Validate</span>
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      )}

      {isValidating && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-2xl">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto" />
            <span className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping" />
          </div>
          <h3 className="text-base font-bold text-slate-100">
            Running Dry-Run File Validation & Offloaded Parsing...
          </h3>
          <p className="text-xs text-slate-400 max-w-md">
            Parsing CSV rows in Web Worker thread to keep main UI smooth,
            checking formatting, and validating student IDs.
          </p>
          <div className="w-full max-w-xs bg-slate-950 border border-slate-800 rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full w-3/4 rounded-full animate-pulse" />
          </div>
        </div>
      )}

      {/* Validation Dry-Run Report (Step 2 Preview) */}
      {validationReport && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono text-indigo-400 uppercase tracking-wider">
                  Step 1 Complete — Dry-Run Audit
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">
                  {validationReport.fileName}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setValidationReport(null);
                    setFile(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
                >
                  Cancel / Re-upload
                </button>

                <button
                  onClick={handleConfirmCommit}
                  disabled={
                    isCommitting ||
                    validationReport.summary.validRowsCount === 0
                  }
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isCommitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Committing Roster...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        Confirm & Commit Roster (
                        {validationReport.summary.validRowsCount} Rows)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block mb-1">Total Rows</span>
                <span className="text-lg font-bold text-slate-100">
                  {validationReport.summary.totalRows}
                </span>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block mb-1">Valid Rows</span>
                <span className="text-lg font-bold text-emerald-400">
                  {validationReport.summary.validRowsCount}
                </span>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block mb-1">New Accounts</span>
                <span className="text-lg font-bold text-indigo-400">
                  +{validationReport.summary.toCreateCount}
                </span>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block mb-1">Row Errors</span>
                <span className="text-lg font-bold text-rose-400">
                  {validationReport.summary.failedRowsCount}
                </span>
              </div>
            </div>

            {/* Errors List if any */}
            {validationReport.errors && validationReport.errors.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  <span>
                    Validation Errors ({validationReport.errors.length} Rows
                    Excluded)
                  </span>
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2 bg-slate-950 p-4 rounded-2xl border border-rose-900/30 font-mono text-xs">
                  {validationReport.errors.map((err, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-rose-300 py-1 border-b border-rose-950 last:border-none"
                    >
                      <span>
                        Row {err.rowNumber}:{" "}
                        <strong className="text-slate-200">
                          {err.studentId || "N/A"}
                        </strong>{" "}
                        ({err.email || "no email"})
                      </span>
                      <span className="text-rose-400">{err.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Valid Rows Preview Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Validated Rows Preview</span>
              </h4>

              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Row #</th>
                      <th className="p-3">Student ID</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Program</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {validationReport.previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="p-3 text-slate-500">{row.rowNumber}</td>
                        <td className="p-3 font-bold text-indigo-300">
                          {row.studentId}
                        </td>
                        <td className="p-3 font-semibold text-slate-200">
                          {row.name}
                        </td>
                        <td className="p-3 text-slate-400">{row.email}</td>
                        <td className="p-3 text-slate-400">
                          {row.program || "—"}
                        </td>
                        <td className="p-3">
                          {row.action === "create" ? (
                            <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px]">
                              Create
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
                              Update
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
