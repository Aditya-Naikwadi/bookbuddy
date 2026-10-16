/**
 * Maps incoming real-time socket events directly into TanStack Query cache
 * using setQueryData to avoid full network refetches and prevent UI jitter.
 */
export function patchQueryCache(event, payload, queryClient) {
  if (!queryClient || !event || !payload) return;

  const { entityId, changed = {}, ...extra } = payload;
  const merged = { ...extra, ...changed, _id: entityId };

  switch (event) {
    case "loan:issued": {
      // 1. Patch student's unified loans tracker summary
      queryClient.setQueriesData(
        { queryKey: ["loans-tracker-summary"] },
        (old) => {
          if (!old) return old;
          const active = old.loans?.active || [];
          const exists = active.some((l) => (l._id || l.id) === entityId);
          if (exists) return old;
          return {
            ...old,
            loans: {
              ...old.loans,
              active: [merged, ...active],
            },
          };
        },
      );

      // 2. Patch my-loans standalone query
      queryClient.setQueriesData({ queryKey: ["my-loans"] }, (old) => {
        if (!old) return old;
        const active = old.active || [];
        if (active.some((l) => (l._id || l.id) === entityId)) return old;
        return { ...old, active: [merged, ...active] };
      });

      // 3. Patch circulation queue on librarian desk
      queryClient.setQueriesData({ queryKey: ["circulationQueue"] }, (old) => {
        if (!old) return old;
        const activeLoans = old.activeLoans || [];
        return {
          ...old,
          activeLoans: [merged, ...activeLoans],
        };
      });

      // 4. Patch book availability in catalog cache
      if (merged.bookId) {
        patchCatalogBookCopies(queryClient, merged.bookId, -1);
      }
      break;
    }

    case "loan:returned": {
      // 1. Patch loans-tracker-summary
      queryClient.setQueriesData(
        { queryKey: ["loans-tracker-summary"] },
        (old) => {
          if (!old || !old.loans) return old;
          const active = (old.loans.active || []).filter(
            (l) => (l._id || l.id) !== entityId,
          );
          const returningLoan = (old.loans.active || []).find(
            (l) => (l._id || l.id) === entityId,
          );
          const history = returningLoan
            ? [
                {
                  ...returningLoan,
                  status: "returned",
                  returnDate: new Date().toISOString(),
                },
                ...(old.loans.history || []),
              ]
            : old.loans.history || [];
          return {
            ...old,
            loans: { ...old.loans, active, history },
          };
        },
      );

      // 2. Patch my-loans standalone query
      queryClient.setQueriesData({ queryKey: ["my-loans"] }, (old) => {
        if (!old) return old;
        const active = (old.active || []).filter(
          (l) => (l._id || l.id) !== entityId,
        );
        const returned = (old.active || []).find(
          (l) => (l._id || l.id) === entityId,
        );
        const history = returned
          ? [
              {
                ...returned,
                status: "returned",
                returnDate: new Date().toISOString(),
              },
              ...(old.history || []),
            ]
          : old.history || [];
        return { ...old, active, history };
      });

      // 3. Patch circulation desk queue
      queryClient.setQueriesData({ queryKey: ["circulationQueue"] }, (old) => {
        if (!old) return old;
        const activeLoans = (old.activeLoans || []).filter(
          (l) => (l._id || l.id) !== entityId,
        );
        return { ...old, activeLoans };
      });

      // 4. Increment copies in catalog
      if (merged.bookId) {
        patchCatalogBookCopies(queryClient, merged.bookId, +1);
      }
      break;
    }

    case "loan:renewed": {
      const updateLoan = (l) =>
        (l._id || l.id) === entityId
          ? {
              ...l,
              dueDate: merged.dueDate || l.dueDate,
              renewalCount: (l.renewalCount || 0) + 1,
              ...changed,
            }
          : l;

      queryClient.setQueriesData(
        { queryKey: ["loans-tracker-summary"] },
        (old) => {
          if (!old || !old.loans) return old;
          return {
            ...old,
            loans: {
              ...old.loans,
              active: (old.loans.active || []).map(updateLoan),
            },
          };
        },
      );

      queryClient.setQueriesData({ queryKey: ["my-loans"] }, (old) => {
        if (!old) return old;
        return { ...old, active: (old.active || []).map(updateLoan) };
      });

      queryClient.setQueriesData({ queryKey: ["circulationQueue"] }, (old) => {
        if (!old) return old;
        return { ...old, activeLoans: (old.activeLoans || []).map(updateLoan) };
      });
      break;
    }

    case "reservation:ready": {
      queryClient.setQueriesData(
        { queryKey: ["loans-tracker-summary"] },
        (old) => {
          if (!old) return old;
          const queue = (old.queue || []).map((q) =>
            (q._id || q.id) === entityId
              ? {
                  ...q,
                  status: "ready_for_pickup",
                  expiresAt: merged.expiresAt || q.expiresAt,
                }
              : q,
          );
          return { ...old, queue };
        },
      );

      queryClient.setQueriesData({ queryKey: ["my-queue"] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((q) =>
          (q._id || q.id) === entityId
            ? {
                ...q,
                status: "ready_for_pickup",
                expiresAt: merged.expiresAt || q.expiresAt,
              }
            : q,
        );
      });
      break;
    }

    case "book:updated": {
      // 1. Patch OPAC catalog cache
      queryClient.setQueriesData({ queryKey: ["catalog"] }, (old) => {
        if (!old || !old.data || !Array.isArray(old.data)) return old;
        return {
          ...old,
          data: old.data.map((b) =>
            (b._id || b.id) === entityId ? { ...b, ...changed } : b,
          ),
        };
      });

      // 2. Patch Cross-College Catalog cache
      queryClient.setQueriesData({ queryKey: ["cross-college"] }, (old) => {
        if (!old) return old;
        const books = old.books || old.data?.books;
        if (!Array.isArray(books)) return old;
        const updatedBooks = books.map((b) =>
          (b._id || b.id) === entityId ? { ...b, ...changed } : b,
        );
        return old.books
          ? { ...old, books: updatedBooks }
          : { ...old, data: { ...old.data, books: updatedBooks } };
      });

      // 3. Patch Librarian Inventory cache
      queryClient.setQueriesData({ queryKey: ["inventory"] }, (old) => {
        if (!old || !old.data || !Array.isArray(old.data)) return old;
        return {
          ...old,
          data: old.data.map((b) =>
            (b._id || b.id) === entityId ? { ...b, ...changed } : b,
          ),
        };
      });

      // 4. Patch Book search queries
      queryClient.setQueriesData({ queryKey: ["book-search"] }, (old) => {
        if (!old || !old.books || !Array.isArray(old.books)) return old;
        return {
          ...old,
          books: old.books.map((b) =>
            (b._id || b.id) === entityId ? { ...b, ...changed } : b,
          ),
        };
      });
      break;
    }

    case "fine:created": {
      queryClient.setQueriesData(
        { queryKey: ["loans-tracker-summary"] },
        (old) => {
          if (!old) return old;
          const fines = [merged, ...(old.fines || [])];
          const unpaidCount = fines.filter((f) => f.status === "unpaid").length;
          const totalUnpaid = fines
            .filter((f) => f.status === "unpaid")
            .reduce((sum, f) => sum + (f.amount || 0), 0);
          return {
            ...old,
            fines,
            finesSummary: { unpaidCount, totalUnpaid },
          };
        },
      );
      queryClient.setQueriesData({ queryKey: ["collegeFines"] }, (old) => {
        if (!old || !Array.isArray(old.data)) return old;
        return { ...old, data: [merged, ...old.data] };
      });
      break;
    }

    case "fine:paid": {
      const markPaid = (f) =>
        (f._id || f.id) === entityId
          ? { ...f, status: "paid", paidAt: new Date().toISOString() }
          : f;

      queryClient.setQueriesData(
        { queryKey: ["loans-tracker-summary"] },
        (old) => {
          if (!old) return old;
          const fines = (old.fines || []).map(markPaid);
          const unpaidCount = fines.filter((f) => f.status === "unpaid").length;
          const totalUnpaid = fines
            .filter((f) => f.status === "unpaid")
            .reduce((sum, f) => sum + (f.amount || 0), 0);
          return {
            ...old,
            fines,
            finesSummary: { unpaidCount, totalUnpaid },
          };
        },
      );

      queryClient.setQueriesData({ queryKey: ["collegeFines"] }, (old) => {
        if (!old || !Array.isArray(old.data)) return old;
        return { ...old, data: old.data.map(markPaid) };
      });
      break;
    }

    case "streak:updated": {
      queryClient.setQueriesData({ queryKey: ["streak", "me"] }, (old) => {
        return old ? { ...old, ...changed } : changed;
      });
      break;
    }

    case "badge:unlocked": {
      queryClient.setQueriesData({ queryKey: ["stickers", "me"] }, (old) => {
        if (!Array.isArray(old)) return [merged];
        return [merged, ...old];
      });
      break;
    }

    case "dashboard:stats": {
      queryClient.setQueriesData(
        { queryKey: ["analyticsSummaryDetailed"] },
        (old) => {
          return old ? { ...old, ...changed } : changed;
        },
      );
      break;
    }

    default:
      break;
  }
}

function patchCatalogBookCopies(queryClient, bookId, delta) {
  const bId = typeof bookId === "object" ? bookId._id || bookId.id : bookId;
  queryClient.setQueriesData({ queryKey: ["catalog"] }, (old) => {
    if (!old || !old.data || !Array.isArray(old.data)) return old;
    return {
      ...old,
      data: old.data.map((b) => {
        if ((b._id || b.id) === bId) {
          const current =
            typeof b.copiesAvailable === "number" ? b.copiesAvailable : 0;
          return {
            ...b,
            copiesAvailable: Math.max(0, current + delta),
          };
        }
        return b;
      }),
    };
  });
}
