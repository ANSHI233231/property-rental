"use client";

/**
 * usePaginatedList — offset-based pagination hook.
 *
 * API contract (every paginated endpoint):
 *   GET /<path>?page=N&pageSize=N&...extras
 *   Response: { data: T[], meta: { total, page, page_size, total_pages, has_more, next_cursor } }
 *
 * Both paths (offset and cursor) are still supported by the backend.
 * This hook always uses ?page=N&pageSize=N for forward/backward navigation.
 *
 * Backward compat: hasPrev/hasNext are still in the result so none of the 12
 * existing call sites need changes; they just gain totalPages/total/goToPage.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/context";

// ---------------------------------------------------------------------------
// Shared response type
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data?: T[];
  items?: T[];
  meta?: {
    next_cursor?: number | string | null;
    has_more?: boolean;
    hasMore?: boolean;
    // Legacy field names accepted by some endpoints
    cursor?: string | null;
    total?: number;
    count?: number;
    page?: number;
    page_size?: number;
    total_pages?: number;
  };
  // Some endpoints surface hasMore at the top level
  hasMore?: boolean;
  nextCursor?: string | null;
}

// ---------------------------------------------------------------------------
// Options / result types
// ---------------------------------------------------------------------------

export interface UsePaginatedListOptions {
  /** Relative URL without query string, e.g. "/properties/13/tenants" */
  url: string;
  /** Extra query params to merge in; changing this resets to page 1. */
  extraQuery?: Record<string, string | number | boolean | undefined>;
  /** Items per page — default 10. */
  pageSize?: number;
  /**
   * Bump this value to force a refetch while keeping page state.
   * Changing `extraQuery` already auto-resets; this is for same-query refreshes.
   */
  refetchKey?: unknown;
}

export interface UsePaginatedListResult<T> {
  items: T[];
  /** 1-indexed current page number. */
  page: number;
  /** Total number of pages (from meta.total_pages; 0 when unknown). */
  totalPages: number;
  /** Total item count across all pages (from meta.total; 0 when unknown). */
  total: number;
  /** Active page size. */
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
  loading: boolean;
  error: string | null;
  next: () => void;
  prev: () => void;
  /** Navigate to an arbitrary page, clamped to [1, max(1, totalPages)]. */
  goToPage: (n: number) => void;
  /** Resets to page 1. */
  reset: () => void;
  /** Refetches the current page. */
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Stable serialise helper — avoids infinite render loops from object identity
// ---------------------------------------------------------------------------

function serializeQuery(q: Record<string, string | number | boolean | undefined> | undefined): string {
  if (!q) return "";
  return Object.entries(q)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join("&");
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePaginatedList<T>({
  url,
  extraQuery,
  pageSize = 10,
  refetchKey,
}: UsePaginatedListOptions): UsePaginatedListResult<T> {
  const { apiFetch } = useAuth();

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Stable serialised extra query — used to detect filter changes
  const extraQuerySerialized = serializeQuery(extraQuery);
  const prevExtraQueryRef = useRef(extraQuerySerialized);

  // refetchKey ref for stable comparison
  const refetchKeyRef = useRef(refetchKey);

  // Stable fetch function — does NOT depend on changing state, uses params
  const doFetch = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(pageSize),
        });
        // Merge extra query params
        const eq = extraQuery;
        if (eq) {
          Object.entries(eq).forEach(([k, v]) => {
            if (v !== undefined) params.set(k, String(v));
          });
        }
        const response = await apiFetch<PaginatedResponse<T>>(`${url}?${params.toString()}`);
        const rows: T[] = response.data ?? response.items ?? [];
        setItems(rows);

        // Read pagination meta — new fields first, fall back to legacy
        const meta = response.meta;
        const serverTotal = meta?.total ?? meta?.count ?? 0;
        const serverTotalPages = meta?.total_pages ?? 0;
        const serverHasMore =
          meta?.has_more ??
          meta?.hasMore ??
          response.hasMore ??
          false;

        setTotal(serverTotal);

        // Derive total pages: prefer server value, fall back to has_more heuristic
        if (serverTotalPages > 0) {
          setTotalPages(serverTotalPages);
        } else if (!serverHasMore) {
          // No more pages — totalPages = current page (or 1 if empty)
          setTotalPages(rows.length === 0 && targetPage === 1 ? 0 : targetPage);
        } else {
          // has_more=true but no total_pages — we know there's at least targetPage+1
          setTotalPages(targetPage + 1);
        }

        setHasMore(serverHasMore || (serverTotalPages > 0 && targetPage < serverTotalPages));
        setPage(targetPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        setItems([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    // We intentionally exclude extraQuery object from deps and use the serialized string instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiFetch, url, pageSize, extraQuerySerialized],
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    if (prevExtraQueryRef.current !== extraQuerySerialized) {
      prevExtraQueryRef.current = extraQuerySerialized;
      void doFetch(1);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraQuerySerialized, doFetch]);

  // Initial load and refetchKey change — fetch current page
  useEffect(() => {
    void doFetch(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doFetch, refetchKey]);

  // Update refetchKey ref
  useEffect(() => {
    refetchKeyRef.current = refetchKey;
  }, [refetchKey]);

  const goToPage = useCallback(
    (n: number) => {
      const clamped = Math.max(1, Math.min(n, Math.max(1, totalPages)));
      void doFetch(clamped);
    },
    [doFetch, totalPages],
  );

  const next = useCallback(() => {
    goToPage(page + 1);
  }, [goToPage, page]);

  const prev = useCallback(() => {
    goToPage(page - 1);
  }, [goToPage, page]);

  const reset = useCallback(() => {
    void doFetch(1);
  }, [doFetch]);

  const refresh = useCallback(() => {
    void doFetch(page);
  }, [doFetch, page]);

  return {
    items,
    page,
    totalPages,
    total,
    pageSize,
    hasNext: totalPages > 0 ? page < totalPages : hasMore,
    hasPrev: page > 1,
    loading,
    error,
    next,
    prev,
    goToPage,
    reset,
    refresh,
  };
}
