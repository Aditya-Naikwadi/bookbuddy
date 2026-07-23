import { Download, FileSpreadsheet } from 'lucide-react';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

export default function TemplateDownloadButton() {
  const { isFeatureEnabled } = useFeatureFlags();

  const handleDownload = () => {
    const columns = ['Student ID', 'Full Name', 'Email', 'Department', 'Year'];

    if (isFeatureEnabled('facilities')) {
      columns.push('Preferred Lab / Seat');
    }
    if (isFeatureEnabled('gamification')) {
      columns.push('House / Guild Name');
    }

    const sampleRow1 = [
      'STU-2026-001',
      'Alice Walker',
      'alice.walker@college.edu',
      'Computer Science',
      '3rd Year',
    ];
    const sampleRow2 = [
      'STU-2026-002',
      'Bob Dylan',
      'bob.dylan@college.edu',
      'Electrical Eng',
      '2nd Year',
    ];

    if (isFeatureEnabled('facilities')) {
      sampleRow1.push('Pod A-102');
      sampleRow2.push('Workstation B-04');
    }
    if (isFeatureEnabled('gamification')) {
      sampleRow1.push('Turing House');
      sampleRow2.push('Lovelace Guild');
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [columns.join(','), sampleRow1.join(','), sampleRow2.join(',')].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bookbuddy_student_import_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors border border-slate-200"
    >
      <FileSpreadsheet size={16} className="text-emerald-600" />
      <span>Download Adapted Template (.CSV)</span>
      <Download size={14} className="text-slate-400" />
    </button>
  );
}
