import { useState } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  AlertTriangle,
  Info,
  Check,
  RefreshCw,
} from "lucide-react";
import bulkUploadApi from "../../../api/bulkUploadApi";

export default function StudentUploadPage() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [report, setReport] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Sample CSV Mock Data Generator
  const handleDownloadSampleCsv = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      encodeURIComponent(
        "RollNumber,FullName,Email,Department,Phone\n" +
          "CS-2026-001,Arthur Pendelton,arthur@stanford.edu,Computer Science,+16505550101\n" +
          "CS-2026-002,Beatrix Potter,beatrix@stanford.edu,English Literature,+16505550102\n" +
          "INVALID_ROW,Charles Xavier,invalid-email-format,Physics,\n" +
          "CS-2026-004,Diana Prince,diana@stanford.edu,Law,+16505550104\n",
      );
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "bookbuddy_student_upload_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      setFile(e.dataTransfer.files[0]);
      simulateFileParsing(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      simulateFileParsing(e.target.files[0]);
    }
  };

  const simulateFileParsing = (uploadFile) => {
    setIsUploading(true);
    setReport(null);

    // Simulate CSV parsing & validation report
    setTimeout(() => {
      setIsUploading(false);
      setReport({
        fileName: uploadFile.name,
        totalRows: 4,
        validCount: 3,
        failedCount: 1,
        rows: [
          {
            rowNumber: 1,
            rollNumber: "CS-2026-001",
            fullName: "Arthur Pendelton",
            email: "arthur@stanford.edu",
            department: "Computer Science",
            status: "VALID",
            reason: "All fields valid",
          },
          {
            rowNumber: 2,
            rollNumber: "CS-2026-002",
            fullName: "Beatrix Potter",
            email: "beatrix@stanford.edu",
            department: "English Literature",
            status: "VALID",
            reason: "All fields valid",
          },
          {
            rowNumber: 3,
            rollNumber: "INVALID_ROW",
            fullName: "Charles Xavier",
            email: "invalid-email-format",
            department: "Physics",
            status: "FAILED",
            reason:
              "Invalid email domain format (@stanford.edu required); Missing phone number",
          },
          {
            rowNumber: 4,
            rollNumber: "CS-2026-004",
            fullName: "Diana Prince",
            email: "diana@stanford.edu",
            department: "Law",
            status: "VALID",
            reason: "All fields valid",
          },
        ],
      });
    }, 1200);
  };

  const handleConfirmCommit = async () => {
    alert(
      `Successfully provisioned ${report?.validCount || 3} student accounts for Stanford University!`,
    );
    setFile(null);
    setReport(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header & Back */}
      <div className="flex items-center justify-between">
        <Link
          to="/college-admin"
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Console</span>
        </Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs uppercase tracking-wider mb-1">
            <UploadCloud className="w-4 h-4" />
            <span>Patron Provisioning & Data Intake</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Bulk Student Roster Import (CSV)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
            Upload student roster CSV files to provision student accounts
            directly. Failed rows are highlighted with clear actionable
            validation reasons.
          </p>
        </div>

        <button
          onClick={handleDownloadSampleCsv}
          className="px-5 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 transition-colors shrink-0"
        >
          <Download className="w-4 h-4 text-indigo-400" />
          <span>Download Sample CSV Template</span>
        </button>
      </div>

      {/* Drag & Drop Upload Zone */}
      {!report && (
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
            <FileSpreadsheet className="w-8 h-8" />
          </div>

          <h3 className="text-base font-bold text-white">
            Drag and Drop Student Roster CSV File Here
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Or click below to browse files on your device (.csv format, max
            10MB)
          </p>

          <div className="mt-6">
            <label className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 cursor-pointer inline-flex items-center gap-2 transition-all">
              <UploadCloud className="w-4 h-4" />
              <span>Browse CSV File</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          {isUploading && (
            <div className="mt-6 flex items-center justify-center gap-2 text-xs font-mono text-indigo-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Parsing and validating student records...</span>
            </div>
          )}
        </div>
      )}

      {/* Validation Report Table */}
      {report && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          {/* Summary Cards */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                Validation Report — {report.fileName}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Found {report.totalRows} records:{" "}
                <span className="text-emerald-400 font-bold">
                  {report.validCount} valid
                </span>
                ,{" "}
                <span className="text-rose-400 font-bold">
                  {report.failedCount} failed
                </span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setFile(null);
                  setReport(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white font-bold text-xs"
              >
                Re-upload File
              </button>

              <button
                onClick={handleConfirmCommit}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Import {report.validCount} Valid Students</span>
              </button>
            </div>
          </div>

          {/* Validation Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Row</th>
                  <th className="p-3">Roll Number</th>
                  <th className="p-3">Full Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Validation Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {report.rows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={`transition-colors ${
                      row.status === "FAILED"
                        ? "bg-rose-950/20 hover:bg-rose-950/30"
                        : "hover:bg-slate-950/40"
                    }`}
                  >
                    <td className="p-3 font-bold text-slate-400">
                      #{row.rowNumber}
                    </td>
                    <td className="p-3 font-bold text-white">
                      {row.rollNumber}
                    </td>
                    <td className="p-3 font-sans text-slate-200">
                      {row.fullName}
                    </td>
                    <td className="p-3 text-indigo-300">{row.email}</td>
                    <td className="p-3 font-sans text-slate-400">
                      {row.department}
                    </td>
                    <td className="p-3">
                      {row.status === "VALID" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> VALID
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3 h-3" /> FAILED
                        </span>
                      )}
                    </td>
                    <td
                      className={`p-3 font-sans text-xs ${
                        row.status === "FAILED"
                          ? "text-rose-300 font-semibold"
                          : "text-slate-500"
                      }`}
                    >
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
