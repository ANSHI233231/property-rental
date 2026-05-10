"use client";

/**
 * Skeleton loaders — Phase 2.
 * Used in tables and KPI cards while data is fetching.
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-light-gray rounded ${className}`}
      aria-hidden="true"
    />
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
