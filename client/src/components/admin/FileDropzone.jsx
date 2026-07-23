import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export default function FileDropzone({ onFileSelected, isParsing = false }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (file) => {
    setError(null);
    if (!file) return;

    if (!file.name.match(/\.(csv|txt|xlsx)$/i)) {
      setError('Please select a valid CSV or XLSX file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      setError('File size exceeds 10MB sanity limit.');
      return;
    }

    onFileSelected(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  return (
    <div className="space-y-3">
      <div
        tabIndex={0}
        role="button"
        aria-label="Upload student roster CSV file"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer select-none outline-none focus:ring-4 focus:ring-indigo-100 ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-50/70 scale-[1.01]'
            : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-slate-50/50'
        } ${isParsing ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.xlsx"
          onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
          className="sr-only"
        />

        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-4 shadow-sm">
          <UploadCloud size={32} />
        </div>

        <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
          Drag & Drop Student Roster File Here
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mb-4">
          Support for <strong>CSV</strong> or <strong>XLSX</strong> files containing thousands of student records.
        </p>

        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all">
          <FileText size={14} />
          <span>Browse File from Device</span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
