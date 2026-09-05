import { useState } from "react";
import { BookPlus, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import collegeAdminApi from "../../../api/collegeAdminApi";
import apiClient from "../../../api/client";

export default function CatalogingDesk() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [category, setCategory] = useState("");
  const [shelfLocation, setShelfLocation] = useState("");
  const [callNumber, setCallNumber] = useState("");
  const [totalCopies, setTotalCopies] = useState(1);
  const [publishedYear, setPublishedYear] = useState(new Date().getFullYear());
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupMessage, setLookupMessage] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const addBookMutation = useMutation({
    mutationFn: (payload) => collegeAdminApi.addCatalogBook(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      queryClient.invalidateQueries({ queryKey: ["staffDashboardWidgets"] });
      setSaveSuccess(true);
      setTitle("");
      setAuthor("");
      setIsbn("");
      setCategory("");
      setShelfLocation("");
      setCallNumber("");
      setTotalCopies(1);
      setTimeout(() => setSaveSuccess(false), 4000);
    },
  });

  const handleIsbnLookup = async () => {
    if (!isbn.trim()) {
      setLookupMessage({
        type: "error",
        text: "Please enter an ISBN code to lookup.",
      });
      return;
    }

    setIsLookingUp(true);
    setLookupMessage(null);

    try {
      const cleanIsbn = isbn.replace(/[-\s]/g, "");
      const res = await apiClient.get(
        `/google-books/search?search=isbn:${cleanIsbn}`,
      );
      const items = res.data?.data?.items || res.data?.items || [];

      if (items.length > 0) {
        const book = items[0].volumeInfo || items[0];
        if (book.title) setTitle(book.title);
        if (book.authors && book.authors.length > 0)
          setAuthor(book.authors.join(", "));
        if (book.categories && book.categories.length > 0)
          setCategory(book.categories[0]);
        if (book.publishedDate) {
          const year = parseInt(book.publishedDate.substring(0, 4), 10);
          if (!isNaN(year)) setPublishedYear(year);
        }
        setLookupMessage({
          type: "success",
          text: `Found metadata: "${book.title}" by ${book.authors?.join(", ") || "Unknown"}!`,
        });
      } else {
        setLookupMessage({
          type: "warning",
          text: "No matches found in Google Books database. You can manually enter the fields.",
        });
      }
    } catch {
      setLookupMessage({
        type: "error",
        text: "Could not reach metadata service. Please fill details manually.",
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 py-6 text-slate-100 font-sans">
      <div className="border-b border-slate-800 pb-6">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
          ILS MODULE 02 — CATALOGING DESK
        </span>
        <h1 className="text-3xl font-serif font-bold text-white mt-1">
          Physical Book Cataloging & Metadata Indexing
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Add new physical books, assign shelf locations and accession numbers,
          or auto-fetch metadata via ISBN lookup.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>
            Book cataloged successfully and synchronized with OPAC search!
          </span>
        </div>
      )}

      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <BookPlus className="text-indigo-400" size={20} />
            <span>Catalog New Physical Copy</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            OPAC Auto-Index
          </span>
        </div>

        {/* ISBN Auto-Lookup Fast Track */}
        <div className="p-4 bg-slate-950 border border-indigo-500/20 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold text-indigo-300 flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-400" />
              <span>Smart ISBN Auto-Lookup (Google Books & Open Library)</span>
            </label>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="Enter ISBN-10 or ISBN-13 (e.g. 9780262046305)"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={handleIsbnLookup}
              disabled={isLookingUp}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-colors shrink-0 shadow-lg shadow-indigo-600/20"
            >
              {isLookingUp ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Fetching...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Auto-Fill Metadata</span>
                </>
              )}
            </button>
          </div>
          {lookupMessage && (
            <p
              className={`text-[11px] font-mono mt-1 ${
                lookupMessage.type === "success"
                  ? "text-emerald-400"
                  : lookupMessage.type === "warning"
                    ? "text-amber-400"
                    : "text-rose-400"
              }`}
            >
              {lookupMessage.text}
            </p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            addBookMutation.mutate({
              title,
              author,
              isbn,
              category,
              shelfLocation,
              callNumber,
              totalCopies: Number(totalCopies),
              publishedYear: Number(publishedYear),
            });
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div className="sm:col-span-2">
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
              Book Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Algorithms 4th Ed."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
              Author(s) *
            </label>
            <input
              type="text"
              required
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g. Thomas H. Cormen"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
              Category / Subject Section *
            </label>
            <input
              type="text"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Computer Science"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
              Physical Shelf Location
            </label>
            <input
              type="text"
              value={shelfLocation}
              onChange={(e) => setShelfLocation(e.target.value)}
              placeholder="e.g. Floor 2 - Stacks B - Shelf 04"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
              Library Call Number / Accession
            </label>
            <input
              type="text"
              value={callNumber}
              onChange={(e) => setCallNumber(e.target.value)}
              placeholder="e.g. QA76.6 .C67 2022"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
              Total Shelf Copies *
            </label>
            <input
              type="number"
              min={1}
              required
              value={totalCopies}
              onChange={(e) => setTotalCopies(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1">
              Publication Year
            </label>
            <input
              type="number"
              min={1500}
              max={2100}
              value={publishedYear}
              onChange={(e) => setPublishedYear(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="sm:col-span-2 pt-4 flex justify-end">
            <button
              type="submit"
              disabled={addBookMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-2 transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {addBookMutation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving to Catalog...</span>
                </>
              ) : (
                <>
                  <BookPlus size={16} />
                  <span>Save to Physical Inventory</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
