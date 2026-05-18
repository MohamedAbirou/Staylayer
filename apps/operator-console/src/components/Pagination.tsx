/**
 * Bounded pagination control. Renders nothing when only one page is
 * available so list pages stay clean for small datasets.
 *
 * The component is deliberately lightweight: only Prev/Next + a textual
 * page indicator. Phase 4 datasets are bounded server-side (limit ≤ 100)
 * and most queues fit in a handful of pages, so a richer page jumper
 * would be over-engineering for now.
 */
export function Pagination({
  page,
  limit,
  total,
  onPageChange,
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);

  const btn =
    "rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-center justify-between gap-3 pt-2 text-xs text-slate-400">
      <span>
        Showing <span className="text-slate-200">{start}</span>–
        <span className="text-slate-200">{end}</span> of{" "}
        <span className="text-slate-200">{total}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={btn}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span className="px-1">
          Page <span className="text-slate-200">{page}</span> of{" "}
          <span className="text-slate-200">{totalPages}</span>
        </span>
        <button
          type="button"
          className={btn}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
