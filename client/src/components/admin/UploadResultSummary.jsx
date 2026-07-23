import React from 'react';
import { CheckCircle2, AlertOctagon, Download, RefreshCw, ArrowLeft } from 'lucide-react';

export default function UploadResultSummary({
  result,
  failedRows = [],
  onReset,
  onReuploadFailed,
}) {
  const processedCount = result?.processed || 0;
  const failedCount = result?.failed || failedRows.length || 0;
  const successCount = Math.max(0, processedCount - failedCount);

  const handleDownloadErrorReport = () => {
    const columns = ['Row', 'Student ID', 'Error Details'];
    const rowsData = (result?.errors || failedRows).map((err, idx) => [
      err.row || idx + 1,
      err.studentId || 'N/A',
      `"${(err.error || err.errors?.join(', ') || 'Validation error').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [columns.join(','), ...rowsData.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `upload_error_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-2xl mx-auto shadow-lg space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-3 shadow-sm">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-2xl font-serif font-bold text-slate-900">
          Bulk Roster Import Complete
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          Student records have been processed and enrolled under your college institution account.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{processedCount}</p>
        </div>

        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Enrolled</span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{successCount}</p>
        </div>

        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Failed</span>
          <p className="text-2xl font-bold text-rose-700 mt-1">{failedCount}</p>
        </div>
      </div>

      {/* Failed Rows Detail & Error Report */}
      {failedCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 text-xs font-bold">
              <AlertOctagon size={16} className="text-amber-600" />
              <span>{failedCount} student record(s) failed validation or enrollment</span>
            </div>
            <button
              type="button"
              onClick={handleDownloadErrorReport}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-semibold rounded-lg transition-colors"
            >
              <Download size={13} />
              <span>Download Error Report</span>
            </button>
          </div>
          <p className="text-xs text-amber-800">
            You can download the error CSV report to see specific failure reasons or re-upload corrected rows.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onReset}
          className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft size={16} />
          <span>Upload Another Roster</span>
        </button>

        {failedCount > 0 && (
          <button
            type="button"
            onClick={onReuploadFailed}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} />
            <span>Re-upload Corrected Failed Subset</span>
          </button>
        )}
      </div>
    </div>
  );
}
