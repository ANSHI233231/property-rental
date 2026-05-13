"use client";

import { useEffect } from "react";

/**
 * Refetch a list/detail whenever the tab regains focus.
 *
 * Why: user names, lease assignments, rent statuses, etc. can be mutated by
 * another role (e.g. PM updates their own name while Admin has the Users page
 * open). The data on the wire is always fresh, but a page that's already
 * mounted holds stale state until the user navigates away and back. This
 * hook plugs that gap: when the user switches tabs or refocuses the window,
 * we silently re-run the page's fetch.
 *
 * Usage:
 *   const refresh = useCallback(async () => { ... }, [...]);
 *   useEffect(() => { void refresh(); }, [refresh]);
 *   useRefetchOnFocus(refresh);
 */
export function useRefetchOnFocus(refetch: () => void | Promise<void>): void {
  useEffect(() => {
    function onVisible(): void {
      if (document.visibilityState === "visible") {
        void refetch();
      }
    }
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refetch]);
}
