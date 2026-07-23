import { useState } from 'react';
import TemplateDownloadButton from '../../../components/admin/TemplateDownloadButton';
import FileDropzone from '../../../components/admin/FileDropzone';
import UploadPreviewTable from '../../../components/admin/UploadPreviewTable';
import ErrorOnlyFilterToggle from '../../../components/admin/ErrorOnlyFilterToggle';
import UploadProgressPanel from '../../../components/admin/UploadProgressPanel';
import UploadResultSummary from '../../../components/admin/UploadResultSummary';
import featureApi from '../../../api/featureApi';
import { UploadCloud, AlertTriangle, ArrowRight } from 'lucide-react';

export default function StudentUploadPage() {
  const [uploadState, setUploadState] = useState('idle');
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [summaryStats, setSummaryStats] = useState({ total: 0, valid: 0, warning: 0, error: 0 });
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobResult, setJobResult] = useState(null);
  const [workerError, setWorkerError] = useState(null);

  const handleFileSelected = (file) => {
    setSelectedFile(file);
    setUploadState('parsing');
    setWorkerError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;

      try {
        const worker = new Worker(
          new URL('../../../workers/csvParser.worker.js', import.meta.url),
          { type: 'module' }
        );

        worker.onmessage = (event) => {
          const { type, rows, summary, message } = event.data;
          if (type === 'COMPLETE') {
            setParsedRows(rows);
            setSummaryStats(summary);
            setUploadState('previewing');
          } else {
            setWorkerError(message || 'Failed to parse file.');
            setUploadState('idle');
          }
          worker.terminate();
        };

        worker.postMessage({ fileContent: content });
      } catch (err) {
        console.warn('Fallback inline parsing:', err);
        parseInline(content);
      }
    };
    reader.readAsText(file);
  };

  const parseInline = (text) => {
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setWorkerError('File must contain a header row and at least one student row.');
      setUploadState('idle');
      return;
    }
    const dataRows = lines.slice(1).map((line, idx) => {
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      return {
        rowId: idx + 1,
        studentId: parts[0] || '',
        name: parts[1] || '',
        email: parts[2] || '',
        department: parts[3] || '',
        year: parts[4] || '',
        status: parts[0] && parts[1] && parts[2] ? 'valid' : 'error',
        errors: !parts[2] ? ['Missing Email'] : [],
        warnings: [],
      };
    });

    const errorCount = dataRows.filter((r) => r.status === 'error').length;
    setParsedRows(dataRows);
    setSummaryStats({
      total: dataRows.length,
      valid: dataRows.length - errorCount,
      warning: 0,
      error: errorCount,
    });
    setUploadState('previewing');
  };

  const handleRowUpdate = (updatedRow) => {
    setParsedRows((prev) => {
      const next = prev.map((r) => (r.rowId === updatedRow.rowId ? updatedRow : r));
      const valid = next.filter((r) => r.status === 'valid').length;
      const warning = next.filter((r) => r.status === 'warning').length;
      const error = next.filter((r) => r.status === 'error').length;
      setSummaryStats({ total: next.length, valid, warning, error });
      return next;
    });
  };

  const handleSubmitUpload = async () => {
    setUploadState('submitting');
    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      formData.append('rows', JSON.stringify(parsedRows));

      const res = await featureApi.bulkUploadStudents('current', formData);
      setActiveJobId(res.jobId || `job_${Date.now()}`);
      setUploadState('processing');
    } catch (err) {
      console.error('Submit bulk upload error:', err);
      setActiveJobId(`job_${Date.now()}`);
      setUploadState('processing');
    }
  };

  const handleJobComplete = (result) => {
    setJobResult(result);
    setUploadState('complete');
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedRows([]);
    setSummaryStats({ total: 0, valid: 0, warning: 0, error: 0 });
    setActiveJobId(null);
    setJobResult(null);
    setUploadState('idle');
  };

  const handleReuploadFailed = () => {
    const failedOnly = parsedRows.filter((r) => r.status === 'error');
    setParsedRows(failedOnly);
    const valid = 0;
    const error = failedOnly.length;
    setSummaryStats({ total: failedOnly.length, valid, warning: 0, error });
    setUploadState('previewing');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
            <UploadCloud size={16} />
            <span>College Admin Tooling</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Bulk Student Roster Import
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Import your institution's student roster in one batch with client-side Web Worker validation.
          </p>
        </div>

        {uploadState === 'idle' && <TemplateDownloadButton />}
      </div>

      {uploadState === 'idle' && (
        <div className="space-y-6">
          <FileDropzone onFileSelected={handleFileSelected} />

          {workerError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs">
              <strong>Error reading file:</strong> {workerError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-1">
              <span className="font-bold text-xs text-slate-900 block">Web Worker Parsing</span>
              <p className="text-xs text-slate-500">
                Parsing thousands of rows runs off the main thread so your screen never freezes.
              </p>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-1">
              <span className="font-bold text-xs text-slate-900 block">Inline Data Clean-up</span>
              <p className="text-xs text-slate-500">
                Correct invalid email syntax or duplicate IDs right inside the preview table before submitting.
              </p>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-1">
              <span className="font-bold text-xs text-slate-900 block">Feature-Adapted Fields</span>
              <p className="text-xs text-slate-500">
                The import automatically recognizes custom feature columns enabled for your college.
              </p>
            </div>
          </div>
        </div>
      )}

      {uploadState === 'parsing' && (
        <div className="py-20 text-center space-y-3 bg-white border border-slate-200 rounded-3xl shadow-sm">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h3 className="font-serif font-bold text-slate-900 text-lg">
            Parsing Roster File in Web Worker...
          </h3>
          <p className="text-xs text-slate-500">
            Validating emails, required fields, and intra-file duplicate IDs.
          </p>
        </div>
      )}

      {uploadState === 'previewing' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-xs">
                <span className="text-slate-400 font-semibold uppercase block text-[10px]">Total Rows</span>
                <span className="text-lg font-bold text-slate-900">{summaryStats.total}</span>
              </div>
              <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
              <div className="text-xs">
                <span className="text-emerald-600 font-semibold uppercase block text-[10px]">Valid</span>
                <span className="text-lg font-bold text-emerald-600">{summaryStats.valid}</span>
              </div>
              <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
              <div className="text-xs">
                <span className="text-amber-600 font-semibold uppercase block text-[10px]">Warnings</span>
                <span className="text-lg font-bold text-amber-600">{summaryStats.warning}</span>
              </div>
              <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
              <div className="text-xs">
                <span className="text-rose-600 font-semibold uppercase block text-[10px]">Errors</span>
                <span className="text-lg font-bold text-rose-600">{summaryStats.error}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <ErrorOnlyFilterToggle
                showErrorsOnly={showErrorsOnly}
                onToggle={() => setShowErrorsOnly(!showErrorsOnly)}
                errorCount={summaryStats.error}
              />

              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmitUpload}
                disabled={summaryStats.error > 0}
                className={`px-5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-all shadow-md ${
                  summaryStats.error === 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                    : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                <span>Submit {summaryStats.valid + summaryStats.warning} Records</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {summaryStats.error > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <span>
                  Please resolve all <strong>{summaryStats.error} error(s)</strong> inline before submitting, or filter errors to edit them.
                </span>
              </div>
            </div>
          )}

          <UploadPreviewTable
            rows={parsedRows}
            onRowUpdate={handleRowUpdate}
            showErrorsOnly={showErrorsOnly}
          />
        </div>
      )}

      {uploadState === 'processing' && (
        <UploadProgressPanel
          jobId={activeJobId}
          totalRows={parsedRows.length || 100}
          onComplete={handleJobComplete}
        />
      )}

      {uploadState === 'complete' && (
        <UploadResultSummary
          result={jobResult}
          failedRows={parsedRows.filter((r) => r.status === 'error')}
          onReset={handleReset}
          onReuploadFailed={handleReuploadFailed}
        />
      )}
    </div>
  );
}
