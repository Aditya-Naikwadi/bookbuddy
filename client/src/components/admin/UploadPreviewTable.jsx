import React, { useState, useMemo } from 'react';
import RowValidationBadge from './RowValidationBadge';
import { Edit2, Check, AlertCircle } from 'lucide-react';
import { useFeatureFlags } from '../../context/FeatureFlagContext';

export default function UploadPreviewTable({
  rows = [],
  onRowUpdate,
  showErrorsOnly = false,
}) {
  const { isFeatureEnabled } = useFeatureFlags();
  const [editingCell, setEditingCell] = useState(null); // { rowId, field }
  const [editValue, setEditValue] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50; // Virtualized pagination window for high performance

  const filteredRows = useMemo(() => {
    if (!showErrorsOnly) return rows;
    return rows.filter((r) => r.status === 'error' || r.status === 'warning');
  }, [rows, showErrorsOnly]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const currentRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const handleStartEdit = (rowId, field, currentValue) => {
    setEditingCell({ rowId, field });
    setEditValue(currentValue || '');
  };

  const handleSaveEdit = (row) => {
    if (!editingCell) return;
    const { field } = editingCell;
    const updatedRow = { ...row, [field]: editValue.trim() };

    // Re-validate row on client
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const errors = [];
    const warnings = [];

    if (!updatedRow.studentId) errors.push('Missing Student ID');
    if (!updatedRow.name) errors.push('Missing Full Name');
    if (!updatedRow.email) {
      errors.push('Missing Email Address');
    } else if (!emailRegex.test(updatedRow.email)) {
      errors.push(`Invalid email format (${updatedRow.email})`);
    }
    if (!updatedRow.department) warnings.push('Department not specified');

    updatedRow.errors = errors;
    updatedRow.warnings = warnings;
    updatedRow.status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';

    onRowUpdate(updatedRow);
    setEditingCell(null);
  };

  return (
    <div className="space-y-4">
      {/* Table Container */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4 w-16">Row</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Student ID</th>
              <th className="py-3 px-4">Full Name</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Department</th>
              {isFeatureEnabled('facilities') && <th className="py-3 px-4">Preferred Lab</th>}
              {isFeatureEnabled('gamification') && <th className="py-3 px-4">House</th>}
              <th className="py-3 px-4">Validation Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {currentRows.map((row) => (
              <tr
                key={row.rowId}
                className={`hover:bg-slate-50/80 transition-colors ${
                  row.status === 'error' ? 'bg-rose-50/30' : row.status === 'warning' ? 'bg-amber-50/20' : ''
                }`}
              >
                <td className="py-3 px-4 font-mono text-slate-400 font-medium">#{row.rowId}</td>
                <td className="py-3 px-4">
                  <RowValidationBadge status={row.status} errorCount={row.errors.length} />
                </td>

                {/* Student ID Cell */}
                <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                  {renderEditableCell(row, 'studentId', row.studentId)}
                </td>

                {/* Name Cell */}
                <td className="py-3 px-4 font-medium text-slate-900">
                  {renderEditableCell(row, 'name', row.name)}
                </td>

                {/* Email Cell */}
                <td className="py-3 px-4">
                  {renderEditableCell(row, 'email', row.email)}
                </td>

                {/* Department Cell */}
                <td className="py-3 px-4">
                  {renderEditableCell(row, 'department', row.department)}
                </td>

                {/* Facilities Cell */}
                {isFeatureEnabled('facilities') && (
                  <td className="py-3 px-4">{renderEditableCell(row, 'preferredLab', row.preferredLab)}</td>
                )}

                {/* Gamification Cell */}
                {isFeatureEnabled('gamification') && (
                  <td className="py-3 px-4">{renderEditableCell(row, 'house', row.house)}</td>
                )}

                {/* Validation Notes */}
                <td className="py-3 px-4 max-w-xs">
                  {row.errors.length > 0 && (
                    <span className="text-rose-600 font-semibold block line-clamp-1">
                      {row.errors.join(' • ')}
                    </span>
                  )}
                  {row.warnings.length > 0 && row.errors.length === 0 && (
                    <span className="text-amber-600 block line-clamp-1">
                      {row.warnings.join(' • ')}
                    </span>
                  )}
                  {row.status === 'valid' && <span className="text-emerald-600 font-medium">Ready</span>}
                </td>
              </tr>
            ))}

            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                  No records match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 text-xs text-slate-500">
          <span>
            Showing {(page - 1) * pageSize + 1} to Math.min({page * pageSize}, {filteredRows.length}) of {filteredRows.length} rows
          </span>

          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 bg-white border border-slate-300 rounded-lg disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-semibold">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 bg-white border border-slate-300 rounded-lg disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );

  function renderEditableCell(row, field, value) {
    const isEditing = editingCell?.rowId === row.rowId && editingCell?.field === field;

    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(row)}
            className="px-2 py-1 border border-indigo-500 rounded bg-indigo-50/50 text-xs w-full outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={() => handleSaveEdit(row)}
            className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            <Check size={12} />
          </button>
        </div>
      );
    }

    return (
      <div
        onClick={() => handleStartEdit(row.rowId, field, value)}
        className="group flex items-center justify-between cursor-pointer py-0.5 px-1 hover:bg-indigo-50/50 rounded transition-colors"
        title="Click to edit inline"
      >
        <span className={!value ? 'text-slate-300 italic' : ''}>{value || 'Empty'}</span>
        <Edit2 size={10} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
      </div>
    );
  }
}
