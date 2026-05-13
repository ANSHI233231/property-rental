"use client";

/**
 * RentChangeBanner — tenant-facing notice for an upcoming rent change.
 *
 * Calls GET /units/:unitId/rent-schedule/tenant-view. The endpoint returns
 * 200 with { scheduledRent, effectiveDate } when a PENDING schedule exists
 * for the tenant's active lease, or 404 NO_PENDING_SCHEDULE otherwise — in
 * which case this component renders nothing.
 *
 * Hidden states: loading, no-pending (404), tenant not on an active lease,
 * any other error. We intentionally never show an error toast here — the
 * banner is a passive notice; a noisy failure would distract.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { ApiError } from "@/lib/api/client";
import { formatINR } from "@gharsetu/shared";
import { formatDateOnlyIST } from "@/lib/locale";

interface TenantViewResponse {
  /** BigInt paise serialised as string. */
  scheduledRent: string;
  /** YYYY-MM-DD. */
  effectiveDate: string;
}

interface RentChangeBannerProps {
  unitId: number | string | null | undefined;
}

export function RentChangeBanner({ unitId }: RentChangeBannerProps) {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<TenantViewResponse | null>(null);

  useEffect(() => {
    if (unitId === null || unitId === undefined) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<TenantViewResponse>(
          `/units/${unitId}/rent-schedule/tenant-view`,
        );
        if (!cancelled) setData(res);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "NO_PENDING_SCHEDULE") {
          setData(null);
        } else {
          // Any other error: stay silent. The banner is non-critical UI.
          setData(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, unitId]);

  if (!data) return null;

  const paise = parseInt(data.scheduledRent, 10);
  const rentLabel = Number.isFinite(paise) ? formatINR(paise) : "—";
  const dateLabel = formatDateOnlyIST(data.effectiveDate);

  return (
    <div className="alert mb-6" role="status" aria-live="polite">
      {/* Calendar icon — currentColor inherits from .alert text colour */}
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5 flex-shrink-0 mt-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <div>
        <strong className="font-poppins">
          Your rent will change to {rentLabel} effective {dateLabel}.
        </strong>
        <div className="text-xs mt-1 opacity-80">
          This change was scheduled by your Property Manager.
        </div>
      </div>
    </div>
  );
}
