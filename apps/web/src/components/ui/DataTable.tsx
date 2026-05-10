"use client";

/**
 * DataTable — generic cursor-paginated table.
 *
 * Features:
 * - Column definitions with optional render function
 * - Row click handler
 * - Empty state component
 * - Loading skeleton (N skeleton rows)
 * - Cursor pagination: "Load more" button advances cursor
 * - Matches prototype styles: .data-table, .badge, pagination footer
 */

import React from "react";
import { SkeletonTableRows } from "./Skeleton";
import { EmptyState } from "./EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnDef<T> {
  key: string;
  header: string;
  /** If omitted, renders row[key] as string. */
  render?: (row: T) => React.ReactNode;
  /** Additional class for the <td>. */
  cellClass?: string;
  /** Additional class for the <th>. */
  headClass?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  /** Called when user clicks a row (not an action cell). */
  onRowClick?: (row: T) => void;
  /** Loading state — shows skeleton rows. */
  loading?: boolean;
  /** Number of skeleton rows to show while loading. Default: 5. */
  skeletonRows?: number;
  /** Props for the empty state. Required for empty list UX. */
  emptyState?: { heading: string; body?: string; cta?: React.ReactNode };
  /** Current displayed count string e.g. "1–20 of 67" */
  countLabel?: string;
  /** Whether more rows exist. Shows "Load more" button. */
  hasMore?: boolean;
  /** Called when user clicks "Load more". */
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  onRowClick,
  loading = false,
  skeletonRows = 5,
  emptyState,
  countLabel,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
}: DataTableProps<T>) {
  const isEmpty = !loading && rows.length === 0;

  return (
    <div className="card p-0 overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.headClass}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonTableRows rows={skeletonRows} cols={columns.length} />
          ) : isEmpty ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                {emptyState ? (
                  <EmptyState
                    heading={emptyState.heading}
                    body={emptyState.body}
                    cta={emptyState.cta}
                  />
                ) : (
                  <EmptyState heading="No records found." />
                )}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? "cursor-pointer" : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.cellClass}>
                    {col.render
                      ? col.render(row)
                      : (row[col.key] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination footer */}
      {!loading && !isEmpty && (countLabel || hasMore) && (
        <div className="flex items-center justify-between p-4 border-t border-light-gray text-sm muted">
          <div>{countLabel ?? `${rows.length} record${rows.length !== 1 ? "s" : ""}`}</div>
          {hasMore && (
            <button
              type="button"
              className="btn btn-secondary !py-1 !px-3 !text-sm"
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
