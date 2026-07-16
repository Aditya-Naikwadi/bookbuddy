import React from 'react';
import { Menu, BookOpen, SkipBack } from 'lucide-react';

export const TableOfContents = ({ toc = [], onJumpToLocation, onClose }) => {
  return (
    <div className="w-80 h-full bg-white border-r border-slate-200 flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
      {/* TOC Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Menu size={18} className="text-indigo-600" />
          Table of Contents
        </h4>
      </div>

      {/* Navigable Chapter list */}
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Book chapters">
        <ul className="space-y-1">
          {/* Start from Beginning quick link */}
          <li>
            <button
              onClick={() => {
                onJumpToLocation(0); // Jump to beginning
                onClose();
              }}
              className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 text-xs font-bold text-indigo-600 flex items-center gap-2.5 transition-colors focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            >
              <SkipBack size={14} />
              Start from beginning
            </button>
          </li>

          <hr className="my-2 border-slate-100" />

          {/* Dynamic chapters */}
          {toc.length === 0 ? (
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
                    className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 hover:text-indigo-600 flex items-start gap-2.5 transition-all focus:ring-2 focus:ring-indigo-600 focus:outline-none group"
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
          )}
        </ul>
      </nav>
    </div>
  );
};

export default TableOfContents;
