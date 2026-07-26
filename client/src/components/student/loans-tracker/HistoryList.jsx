import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "../../ui/Button";

export const HistoryList = ({ history }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const totalPages = Math.ceil(history.length / itemsPerPage);

  const paginatedHistory = history.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  if (history.length === 0) {
    return (
      <p className="text-muted text-xs py-8 text-center bg-surface/5 rounded-xl border border-dashed border-edge/20">
        No borrowing history yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden border border-edge/20 rounded-xl bg-surface/10">
        <table className="w-full text-left border-collapse text-xs text-muted">
          <thead>
            <tr className="bg-surface/30 border-b border-edge/20 text-ink">
              <th
                scope="col"
                className="p-4 font-bold uppercase tracking-wider"
              >
                Book Title
              </th>
              <th
                scope="col"
                className="p-4 font-bold uppercase tracking-wider hidden sm:table-cell"
              >
                Author
              </th>
              <th
                scope="col"
                className="p-4 font-bold uppercase tracking-wider"
              >
                Returned Date
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedHistory.map((loan) => {
              const returnDateStr = loan.returnDate
                ? new Date(loan.returnDate).toLocaleDateString()
                : "N/A";

              return (
                <tr
                  key={loan._id}
                  className="border-b border-edge/10 hover:bg-surface/20 transition-colors"
                >
                  <th
                    scope="row"
                    className="p-4 font-bold text-ink flex items-center gap-2"
                  >
                    <BookOpen size={14} className="text-indigo/60 shrink-0" />
                    <span className="truncate max-w-[150px] sm:max-w-xs">
                      {loan.bookId?.title || "Unknown Title"}
                    </span>
                  </th>
                  <td className="p-4 hidden sm:table-cell truncate max-w-[120px]">
                    {loan.bookId?.author || "Unknown"}
                  </td>
                  <td className="p-4">{returnDateStr}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-[10px] text-muted font-medium">
            Page {currentPage} of {totalPages} ({history.length} items)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage === 1}
              onClick={handlePrevPage}
              className="text-[10px] px-3 h-8 font-bold"
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={handleNextPage}
              className="text-[10px] px-3 h-8 font-bold"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
