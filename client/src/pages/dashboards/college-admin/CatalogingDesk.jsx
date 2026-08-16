import { useState } from "react";
import { BookPlus, BookOpen, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";

export default function CatalogingDesk() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [category, setCategory] = useState("");
  const [totalCopies, setTotalCopies] = useState(1);
  const [publishedYear, setPublishedYear] = useState(new Date().getFullYear());

  const addBookMutation = useMutation({
    mutationFn: (payload) => collegeAdminApi.addCatalogBook(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      setTitle("");
      setAuthor("");
      setIsbn("");
      setCategory("");
      setTotalCopies(1);
    },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 py-6 text-slate-100">
      <div className="border-b border-slate-800 pb-6">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
          Cataloging Management
        </span>
        <h1 className="text-3xl font-serif font-bold text-white mt-1">
          Physical Book Cataloging & Indexing
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Add new physical books, accession numbers, and shelf categories to
          your college library.
        </p>
      </div>

      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <BookPlus className="text-indigo-400" size={20} />
          Catalog New Physical Book Copy
        </h3>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            addBookMutation.mutate({
              title,
              author,
              isbn,
              category,
              totalCopies: Number(totalCopies),
              publishedYear: Number(publishedYear),
            });
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
              Book Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Algorithms 4th Ed."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
              Author(s) *
            </label>
            <input
              type="text"
              required
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g. Thomas H. Cormen"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
              ISBN Code *
            </label>
            <input
              type="text"
              required
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="e.g. 9780262046305"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
              Category / Shelf Section *
            </label>
            <input
              type="text"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Computer Science"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
              Total Shelf Copies *
            </label>
            <input
              type="number"
              min={1}
              required
              value={totalCopies}
              onChange={(e) => setTotalCopies(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono"
            />
          </div>

          <div className="sm:col-span-2 pt-2 flex justify-end">
            <button
              type="submit"
              disabled={addBookMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white flex items-center gap-2 transition-colors"
            >
              {addBookMutation.isPending && (
                <Loader2 size={14} className="animate-spin" />
              )}
              Save to Physical Inventory
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
