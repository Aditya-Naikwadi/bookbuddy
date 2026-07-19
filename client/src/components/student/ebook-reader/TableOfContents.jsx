import { BookOpen, SkipBack, ListTree } from 'lucide-react';

export const TableOfContents = ({ toc = [], pdfOutline = [], isPdf = false, onJumpToLocation, onJumpToPdfPage, onClose }) => {
  return (
    <div className="w-80 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
      {/* TOC Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-800/50">
        <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <ListTree size={18} className="text-indigo-600 dark:text-indigo-400" />
          {isPdf ? 'PDF Document Outline' : 'Table of Contents'}
        </h4>
        <button
          onClick={onClose}
          className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white"
        >
          Close
        </button>
      </div>

      {/* Navigable Chapter list */}
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Book chapters">
        <ul className="space-y-1">
          {/* Start from Beginning quick link */}
          <li>
            <button
              onClick={() => {
                if (isPdf) {
                  onJumpToPdfPage(1);
                } else {
                  onJumpToLocation(0);
                }
                onClose();
              }}
              className="w-full text-left p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2.5 transition-colors focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            >
              <SkipBack size={14} />
              Start from beginning (Page 1)
            </button>
          </li>

          <hr className="my-2 border-slate-100 dark:border-slate-800" />

          {/* Render PDF Outline or EPUB TOC */}
          {isPdf ? (
            pdfOutline.length === 0 ? (
              <p className="p-4 text-xs text-slate-400 text-center font-medium">
                No embedded PDF outline structure found in this document.
              </p>
            ) : (
              pdfOutline.map((item, i) => (
                <li key={i}>
                  <button
                    onClick={() => {
                      if (item.destPage) {
                        onJumpToPdfPage(item.destPage);
                      }
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 flex items-start gap-2.5 transition-all group"
                  >
                    <BookOpen
                      size={14}
                      className="shrink-0 mt-0.5 text-slate-400 group-hover:text-indigo-600 transition-colors"
                    />
                    <span className="truncate flex-1">{item.title || `Section ${i + 1}`}</span>
                    {item.destPage && (
                      <span className="text-[10px] font-mono text-slate-400">p. {item.destPage}</span>
                    )}
                  </button>
                </li>
              ))
            )
          ) : (
            toc.length === 0 ? (
              <p className="p-4 text-xs text-slate-400 text-center font-medium">
                No chapter markers found in this book.
              </p>
            ) : (
              toc.map((chapter, i) => {
                const label = chapter.label ? chapter.label.trim() : `Chapter ${i + 1}`;
                return (
                  <li key={chapter.id || i}>
                    <button
                      onClick={() => {
                        onJumpToLocation(chapter.href);
                        onClose();
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 flex items-start gap-2.5 transition-all group"
                    >
                      <BookOpen
                        size={14}
                        className="shrink-0 mt-0.5 text-slate-400 group-hover:text-indigo-600 transition-colors"
                      />
                      <span className="truncate">{label}</span>
                    </button>
                  </li>
                );
              })
            )
          )}
        </ul>
      </nav>
    </div>
  );
};

export default TableOfContents;
