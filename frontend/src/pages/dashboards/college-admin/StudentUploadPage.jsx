import { useState, useEffect, useRef } from "react";
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
  UserX,
  MailCheck,
  MailWarning,
  FileText,
} from "lucide-react";

export default function StudentUploadPage() {
  const [_file, setFile] = useState(null);
  const [isParsingWorker, setIsParsingWorker] = useState(false);
  const [workerProgress, setWorkerProgress] = useState({
    percent: 0,
    processed: 0,
    total: 0,
  });
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [batchStatusPolling, setBatchStatusPolling] = useState(false);
  const [pollingProgress, setPollingProgress] = useState(null);
  const [validationReport, setValidationReport] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [deliveryStatusReport, setDeliveryStatusReport] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [bulkDeactivateAbsent, setBulkDeactivateAbsent] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const workerRef = useRef(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Template Download
  const handleDownloadSampleCsv = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      encodeURIComponent(
        "StudentId,Name,Email,Program,Year,Phone\n" +
          "STU-2026-001,Arthur Pendelton,arthur@college.edu,Computer Science,Year 1,+1234567890\n" +
          "STU-2026-002,Beatrix Potter,beatrix@college.edu,English Literature,Year 2,+1234567891\n" +
          "STU-2026-003,Charles Xavier,,Physics,Year 3,+1234567892\n",
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
      initiateWorkerParsingAndValidation(selectedFile);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      initiateWorkerParsingAndValidation(selectedFile);
    }
  };

  // Step 1: Parse in Web Worker then dry-run validate on backend
  const initiateWorkerParsingAndValidation = (uploadFile) => {
    setError(null);
    setValidationReport(null);
    setCommitResult(null);
    setDeliveryStatusReport(null);

    // If file is CSV, run Web Worker parsing first
    if (uploadFile.name.endsWith(".csv")) {
      setIsParsingWorker(true);
      setWorkerProgress({ percent: 0, processed: 0, total: 0 });

      const reader = new FileReader();
      reader.onload = (event) => {
        const fileContent = event.target.result;

        // Initialize Web Worker
        try {
          if (workerRef.current) {
            workerRef.current.terminate();
          }
          workerRef.current = new Worker(
            new URL("../../../workers/csvParser.worker.js", import.meta.url),
            { type: "module" },
          );

          workerRef.current.onmessage = (e) => {
            const data = e.data;
            if (data.type === "PROGRESS") {
              setWorkerProgress({
                percent: data.percent,
                processed: data.processed,
                total: data.total,
              });
            } else if (data.type === "DONE") {
              setIsParsingWorker(false);
              // Send to server dry-run validation
              uploadAndValidateFile(uploadFile);
            } else if (data.type === "ERROR") {
              setIsParsingWorker(false);
              setError(data.message);
            }
          };

          workerRef.current.onerror = (err) => {
            setIsParsingWorker(false);
            setError(`Worker parse failure: ${err.message}`);
          };

          workerRef.current.postMessage({ fileContent });
        } catch {
          // Fallback if Worker fails to initialize
          setIsParsingWorker(false);
          uploadAndValidateFile(uploadFile);
        }
      };

      reader.onerror = () => {
        setIsParsingWorker(false);
        setError("Failed to read file.");
      };

      reader.readAsText(uploadFile);
    } else {
      // Excel files go directly to server parser
      uploadAndValidateFile(uploadFile);
    }
  };

  // Server Dry-Run Validation
  const uploadAndValidateFile = async (uploadFile) => {
    setIsValidating(true);
    setError(null);

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

  // Step 2: Non-blocking commit + status polling
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
          bulkDeactivateAbsent,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to initiate roster commit.");
      }

      setBatchStatusPolling(true);
      setIsCommitting(false);

      // Start polling for background job completion
      startPollingBatchStatus(validationReport.batchId);
    } catch (err) {
      setError(err.message || "An error occurred while committing roster.");
      setIsCommitting(false);
    }
  };

  const startPollingBatchStatus = (batchId) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/students/upload/${batchId}/status`);
        const data = await res.json();

        if (res.ok && data.success && data.batch) {
          setPollingProgress(data.batch);

          if (data.batch.status === "committed") {
            clearInterval(pollIntervalRef.current);
            setBatchStatusPolling(false);
            setCommitResult({
              message: "Roster ingestion completed successfully.",
              summary: {
                createdCount: data.batch.createdCount,
                updatedCount: data.batch.updatedCount,
                deactivatedCount: data.batch.deactivatedCount || 0,
                totalCommitted:
                  (data.batch.createdCount || 0) +
                  (data.batch.updatedCount || 0),
              },
            });
            // Fetch detailed delivery status report
            fetchDeliveryStatus(batchId);
          } else if (data.batch.status === "failed") {
            clearInterval(pollIntervalRef.current);
            setBatchStatusPolling(false);
            setError(
              `Ingestion failed: ${data.batch.errorMessage || "Unknown error"}`,
            );
          }
        }
      } catch {
        // Silently retry on transient poll error
      }
    }, 1200);
  };

  const fetchDeliveryStatus = async (batchId) => {
    try {
      const res = await fetch(
        `/api/admin/students/upload/${batchId}/delivery-status`,
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setDeliveryStatusReport(data);
      }
    } catch {
      // Ignore
    }
  };

  const handleDownloadHandouts = () => {
    if (!validationReport?.batchId && !deliveryStatusReport?.batchId) return;
    const batchId = deliveryStatusReport?.batchId || validationReport?.batchId;
    window.location.href = `/api/admin/students/upload/${batchId}/handouts`;
  };

  // Filtered Delivery Status Rows
  const getFilteredRows = () => {
    if (!deliveryStatusReport?.rowResults) return [];
    if (selectedFilter === "all") return deliveryStatusReport.rowResults;
    if (selectedFilter === "sent") {
      return deliveryStatusReport.rowResults.filter(
        (r) => r.deliveryStatus === "sent",
      );
    }
    if (selectedFilter === "failed") {
      return deliveryStatusReport.rowResults.filter(
        (r) => r.deliveryStatus === "bounced" || r.deliveryStatus === "failed",
      );
    }
    if (selectedFilter === "handout") {
      return deliveryStatusReport.rowResults.filter(
        (r) => r.deliveryStatus === "no_contact_info",
      );
    }
    if (selectedFilter === "active_preserved") {
      return deliveryStatusReport.rowResults.filter(
        (r) => r.deliveryStatus === "active_preserved",
      );
    }
    if (selectedFilter === "deactivated") {
      return deliveryStatusReport.rowResults.filter(
        (r) => r.action === "deactivated",
      );
    }
    return deliveryStatusReport.rowResults;
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
            Offloaded parsing via Web Worker, non-blocking background ingestion,
            per-row delivery status tracking, and optional bulk deactivation for
            absent patrons.
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

      {/* Web Worker Parsing Overlay */}
      {isParsingWorker && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-2xl">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto" />
          </div>
          <h3 className="text-base font-bold text-slate-100">
            Parsing CSV in Dedicated Web Worker...
          </h3>
          <p className="text-xs text-slate-400 max-w-md">
            Processing file tokens off the main UI thread to eliminate UI
            freezes.
            {workerProgress.total > 0 &&
              ` (${workerProgress.processed} / ${workerProgress.total} rows)`}
          </p>
          <div className="w-full max-w-xs bg-slate-950 border border-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.max(workerProgress.percent, 10)}%` }}
            />
          </div>
        </div>
      )}

      {/* Background Ingestion Progress Bar (Polling) */}
      {batchStatusPolling && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              <div>
                <h3 className="text-base font-bold text-white">
                  Ingesting Student Accounts in Background...
                </h3>
                <p className="text-xs text-slate-400">
                  Accounts being provisioned, cryptographic tokens generated,
                  and delivery queued.
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-400 px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              {pollingProgress
                ? `${pollingProgress.processedRows || 0} / ${pollingProgress.validRowsCount || 0} Rows`
                : "Processing..."}
            </span>
          </div>

          <div className="w-full bg-slate-950 border border-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full rounded-full transition-all duration-300"
              style={{
                width: pollingProgress
                  ? `${Math.round(((pollingProgress.processedRows || 1) / (pollingProgress.validRowsCount || 1)) * 100)}%`
                  : "25%",
              }}
            />
          </div>
        </div>
      )}

      {/* Success Commitment Banner & Summary Cards */}
      {commitResult && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-emerald-400">
              <CheckCircle2 className="w-8 h-8 shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-slate-100">
                  Roster Import Committed!
                </h3>
                <p className="text-xs text-emerald-300">
                  {commitResult.message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {deliveryStatusReport?.hasCredentialSlips && (
                <button
                  onClick={handleDownloadHandouts}
                  className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-2 transition"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>
                    Download Handout Slips (
                    {deliveryStatusReport.credentialSlipsCount})
                  </span>
                </button>
              )}
              <button
                onClick={() => {
                  setCommitResult(null);
                  setValidationReport(null);
                  setDeliveryStatusReport(null);
                  setFile(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
              >
                Upload Another Roster
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
              <span className="text-slate-400 block mb-1">
                Accounts Created
              </span>
              <span className="text-xl font-bold text-emerald-400">
                +{commitResult.summary.createdCount}
              </span>
            </div>
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
              <span className="text-slate-400 block mb-1">Records Updated</span>
              <span className="text-xl font-bold text-indigo-400">
                {commitResult.summary.updatedCount}
              </span>
            </div>
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
              <span className="text-slate-400 block mb-1">
                Absent Deactivated
              </span>
              <span className="text-xl font-bold text-amber-400">
                {commitResult.summary.deactivatedCount}
              </span>
            </div>
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800">
              <span className="text-slate-400 block mb-1">Total Processed</span>
              <span className="text-xl font-bold text-slate-200">
                {commitResult.summary.totalCommitted}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Upload Drop Zone (Step 1) */}
      {!validationReport &&
        !isValidating &&
        !isParsingWorker &&
        !batchStatusPolling &&
        !commitResult && (
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
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto" />
          <h3 className="text-base font-bold text-slate-100">
            Running Server-Side Integrity & Collision Audit...
          </h3>
          <p className="text-xs text-slate-400 max-w-md">
            Validating row-by-row data against institutional records and
            performing collision analysis.
          </p>
        </div>
      )}

      {/* Step 2: Validation Dry-Run Report & Commit Settings */}
      {validationReport && !batchStatusPolling && !commitResult && (
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
                      <span>Queuing Roster...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        Confirm & Ingest (
                        {validationReport.summary.validRowsCount} Rows)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Bulk Deactivation Toggle */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <UserX className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-slate-200">
                    Bulk Deactivate Absent Students
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Mark active enrolled students missing from this roster as{" "}
                  <code className="text-amber-300 bg-amber-950/60 px-1 py-0.5 rounded">
                    inactive
                  </code>
                  . Accounts are never deleted — historical loans, circulation,
                  and records remain intact.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1 sm:mt-0">
                <input
                  type="checkbox"
                  checked={bulkDeactivateAbsent}
                  onChange={(e) => setBulkDeactivateAbsent(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
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
                        <td className="p-3 text-slate-400">
                          {row.email || "(Handout Slip)"}
                        </td>
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

      {/* Step 3: Per-Row Delivery Status Table (Item 5 View) */}
      {deliveryStatusReport && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <MailCheck className="w-4 h-4" />
                <span>Credential Delivery & Account Roster Audit</span>
              </span>
              <h2 className="text-xl font-bold text-white mt-0.5">
                Delivery Outcomes & Row Status
              </h2>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition ${
                  selectedFilter === "all"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                All ({deliveryStatusReport.summary.totalProcessed})
              </button>
              <button
                onClick={() => setSelectedFilter("sent")}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition ${
                  selectedFilter === "sent"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Sent ({deliveryStatusReport.summary.sent})
              </button>
              <button
                onClick={() => setSelectedFilter("handout")}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition ${
                  selectedFilter === "handout"
                    ? "bg-amber-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Handout Slips ({deliveryStatusReport.summary.no_contact_info})
              </button>
              <button
                onClick={() => setSelectedFilter("active_preserved")}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition ${
                  selectedFilter === "active_preserved"
                    ? "bg-indigo-700 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Active Preserved (
                {deliveryStatusReport.summary.active_preserved})
              </button>
              {deliveryStatusReport.summary.deactivated > 0 && (
                <button
                  onClick={() => setSelectedFilter("deactivated")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition ${
                    selectedFilter === "deactivated"
                      ? "bg-rose-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  Deactivated ({deliveryStatusReport.summary.deactivated})
                </button>
              )}
            </div>
          </div>

          {/* Delivery Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">Row #</th>
                  <th className="p-3">Student ID</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Delivery Status</th>
                  <th className="p-3">Details / Audit Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {getFilteredRows().map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40">
                    <td className="p-3 text-slate-500">
                      {row.rowNumber || "—"}
                    </td>
                    <td className="p-3 font-bold text-indigo-300">
                      {row.studentId}
                    </td>
                    <td className="p-3 font-semibold text-slate-200">
                      {row.name}
                    </td>
                    <td className="p-3 text-slate-400">
                      {row.email || (
                        <span className="text-amber-400/80 italic">
                          No email
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {row.action === "created" && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                          Created
                        </span>
                      )}
                      {row.action === "updated" && (
                        <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px]">
                          Updated
                        </span>
                      )}
                      {row.action === "deactivated" && (
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px]">
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {row.deliveryStatus === "sent" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px]">
                          <MailCheck className="w-3 h-3" />
                          <span>Sent</span>
                        </span>
                      )}
                      {row.deliveryStatus === "sms_queued" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>SMS Sent</span>
                        </span>
                      )}
                      {row.deliveryStatus === "bounced" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[10px]">
                          <MailWarning className="w-3 h-3" />
                          <span>Bounced</span>
                        </span>
                      )}
                      {row.deliveryStatus === "no_contact_info" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px]">
                          <FileText className="w-3 h-3" />
                          <span>Handout Slip</span>
                        </span>
                      )}
                      {row.deliveryStatus === "active_preserved" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Password Preserved</span>
                        </span>
                      )}
                      {row.deliveryStatus === "inactive" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px]">
                          <UserX className="w-3 h-3" />
                          <span>Inactive</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400 max-w-xs truncate text-[11px]">
                      {row.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
