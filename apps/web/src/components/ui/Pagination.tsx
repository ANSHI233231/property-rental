/**
 * Shared Pagination component — numbered page buttons + Prev/Next.
 *
 * Layout:
 *   Left:   "Showing X of TOTAL · Page N of M"
 *   Center: numbered buttons with windowing (first, last, ±2 around current, ellipsis)
 *   Right:  "← Prev" / "Next →"
 *
 * Hidden entirely when totalPages <= 1 && total < pageSize (single short page).
 *
 * Backward compat: hasPrev/hasNext are still accepted so existing call sites
 * that have not yet been updated continue to compile.
 */

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  itemsOnPage: number;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoToPage: (n: number) => void;
  /** @deprecated — kept for backward compat; derived from page/totalPages instead */
  hasPrev?: boolean;
  /** @deprecated — kept for backward compat; derived from page/totalPages instead */
  hasNext?: boolean;
}

/**
 * Build a window of page numbers to display.
 * Always includes: first page, last page, current ± 2.
 * Gaps get an `"ellipsis"` entry.
 */
function buildPageWindow(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 1) return total === 1 ? [1] : [];

  const alwaysShow = new Set<number>();
  alwaysShow.add(1);
  alwaysShow.add(total);
  for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
    alwaysShow.add(i);
  }

  const sorted = Array.from(alwaysShow).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const prev = sorted[i - 1];
    if (prev !== undefined && cur - prev > 1) {
      result.push("ellipsis");
    }
    result.push(cur);
  }

  return result;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  itemsOnPage,
  loading = false,
  onPrev,
  onNext,
  onGoToPage,
}: PaginationProps) {
  // Hide entirely if it's a single short page
  if (totalPages <= 1 && total < pageSize) {
    return null;
  }

  const effectiveTotalPages = Math.max(1, totalPages);
  const hasPrev = page > 1;
  const hasNext = page < effectiveTotalPages;
  const disabled = loading;

  const window = buildPageWindow(page, effectiveTotalPages);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-light-gray text-sm flex-wrap gap-2">
      {/* Left: summary */}
      <span className="muted whitespace-nowrap">
        Showing {itemsOnPage} of {total} &middot; Page {page} of {effectiveTotalPages}
      </span>

      {/* Center: numbered buttons */}
      <div className="flex items-center gap-1 flex-wrap">
        {window.map((entry, idx) => {
          if (entry === "ellipsis") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 py-1 text-mid-gray select-none"
                aria-hidden="true"
              >
                &hellip;
              </span>
            );
          }
          const isActive = entry === page;
          return (
            <button
              key={entry}
              type="button"
              className={
                isActive
                  ? "btn btn-primary !py-1 !px-2.5 !text-sm min-w-[2rem]"
                  : "btn btn-secondary !py-1 !px-2.5 !text-sm min-w-[2rem]"
              }
              onClick={() => !isActive && onGoToPage(entry)}
              disabled={disabled || isActive}
              aria-label={`Go to page ${entry}`}
              aria-current={isActive ? "page" : undefined}
            >
              {entry}
            </button>
          );
        })}
      </div>

      {/* Right: Prev / Next */}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-secondary !py-1.5 !px-3 !text-sm"
          onClick={onPrev}
          disabled={!hasPrev || disabled}
          aria-label="Previous page"
        >
          &larr; Prev
        </button>
        <button
          type="button"
          className="btn btn-secondary !py-1.5 !px-3 !text-sm"
          onClick={onNext}
          disabled={!hasNext || disabled}
          aria-label="Next page"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}
