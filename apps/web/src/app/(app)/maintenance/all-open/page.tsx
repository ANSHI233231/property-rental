/**
 * Route entry point — server component shell.
 *
 * BUG-004 fix: `export const dynamic = "force-dynamic"` must live in a
 * server component for Next.js App Router to honour it. The actual UI lives
 * in AllOpenClient.tsx ("use client"). This thin wrapper forces the route to
 * be server-rendered on demand instead of statically pre-rendered at build
 * time, preventing the corrupt static asset that caused HTTP 404 for
 * authenticated MAINTENANCE users in production `next start`.
 */
export const dynamic = "force-dynamic";

import AllOpenClient from "./AllOpenClient";

export default function MaintenanceAllOpenPage() {
  return <AllOpenClient />;
}
