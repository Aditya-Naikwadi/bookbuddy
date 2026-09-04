import { useState } from "react";
import { MessageSquare, Trash2, Check, X } from "lucide-react";

const COLOR_OPTIONS = [
  {
    id: "yellow",
    hex: "#fef08a",
    bgClass:
      "bg-yellow-200 hover:bg-yellow-300 text-yellow-900 border-yellow-400",
  },
  {
    id: "green",
    hex: "#bbf7d0",
    bgClass: "bg-green-200 hover:bg-green-300 text-green-900 border-green-400",
  },
  {
    id: "blue",
    hex: "#bae6fd",
    bgClass: "bg-sky-200 hover:bg-sky-300 text-sky-900 border-sky-400",
  },
  {
    id: "pink",
    hex: "#fbcfe8",
    bgClass: "bg-pink-200 hover:bg-pink-300 text-pink-900 border-pink-400",
  },
  {
    id: "purple",
    hex: "#e9d5ff",
    bgClass:
      "bg-purple-200 hover:bg-purple-300 text-purple-900 border-purple-400",
  },
];

const HighlightToolbar = ({
  position = { top: 0, left: 0 },
  selectedColor = "yellow",
  existingNote = "",
  isEditing = false,
  onSelectColor,
  onSaveNote,
  onDelete,
  onClose,
}) => {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState(existingNote);

  const handleColorClick = (colorId) => {
    onSelectColor(colorId, noteText);
  };

  const handleNoteSubmit = (e) => {
    e.preventDefault();
    if (noteText.length > 5000) return;
    onSaveNote(noteText);
    setShowNoteInput(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: `${Math.max(10, position.top - 55)}px`,
        left: `${Math.max(10, position.left)}px`,
        transform: "translateX(-50%)",
        zIndex: 9999,
      }}
      className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-2xl rounded-2xl p-2 flex flex-col gap-2 transition-all duration-150 animate-in fade-in zoom-in-95"
    >
      {!showNoteInput ? (
        <div className="flex items-center gap-1.5">
          {/* 5 Color Options */}
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.id}
              onClick={() => handleColorClick(c.id)}
              title={`Highlight with ${c.id}`}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${c.bgClass} ${
                selectedColor === c.id
                  ? "ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900"
                  : "border-transparent"
              }`}
            >
              {selectedColor === c.id && (
                <Check className="w-3 h-3 stroke-[3]" />
              )}
            </button>
          ))}

          <div className="w-px h-4 bg-slate-700 mx-1" />

          {/* Add / Edit Note Button */}
          <button
            onClick={() => setShowNoteInput(true)}
            title={noteText ? "Edit Note" : "Add Note"}
            className={`p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer relative ${
              noteText ? "bg-indigo-600/30 text-indigo-300" : ""
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            {noteText && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-indigo-400" />
            )}
          </button>

          {/* Delete Button (If editing existing highlight) */}
          {isEditing && (
            <button
              onClick={onDelete}
              title="Delete Highlight"
              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Close Toolbar */}
          <button
            onClick={onClose}
            title="Dismiss Toolbar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Attached Note Form */
        <form
          onSubmit={handleNoteSubmit}
          className="flex flex-col gap-2 p-1 min-w-[240px]"
        >
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold px-0.5">
            <span>Attach Note to Highlight</span>
            <span
              className={
                noteText.length > 5000
                  ? "text-rose-400 font-bold"
                  : "text-slate-500 font-mono text-[10px]"
              }
            >
              {noteText.length}/5000
            </span>
          </div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Type your study note here..."
            maxLength={5000}
            rows={3}
            autoFocus
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
          <div className="flex items-center justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setShowNoteInput(false)}
              className="px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={noteText.length > 5000}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors shadow-md"
            >
              Save Note
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default HighlightToolbar;
