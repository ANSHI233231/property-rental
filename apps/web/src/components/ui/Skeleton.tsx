"use client";

/**
 * Skeleton loaders — Phase 2 (updated Phase 6: aria-busy + SkeletonCard).
 * Used in tables and KPI cards while data is fetching.
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-light-gray rounded ${className}`}
      aria-busy="true"
      aria-hidden="true"
    />
  );
}

/** Skeleton for a generic content card. */
export function SkeletonCard() {
  return (
    <div className="card animate-pulse" aria-busy="true" aria-label="Loading content">
      <Skeleton className="h-5 w-1/3 mb-4" />
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

/** A single skeleton row with N cells for use inside <tbody>. */
export function SkeletonTableRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-[14px]">
          <Skeleton className="h-4 w-3/4" />
        </td>
      ))}
    </tr>
  );
}

/** N skeleton rows stacked. */
export function SkeletonTableRows({ rows, cols }: { rows: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} cols={cols} />
      ))}
    </>
  );
}

/** Skeleton for a KPI card. */
export function SkeletonKpi() {
  return (
    <div className="kpi">
      <Skeleton className="h-3 w-16 mb-2" />
      <Skeleton className="h-8 w-12 mb-1" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}
