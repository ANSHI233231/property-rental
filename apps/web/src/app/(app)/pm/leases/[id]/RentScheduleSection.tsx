"use client";

/**
 * RentScheduleSection — PM lease detail page widget.
 *
 * Backend: POST/PATCH/DELETE/GET /units/:unitId/rent-schedule (PM only).
 *
 * States:
 *   • loading      — initial GET in flight
 *   • no-pending   — GET returned 404 NO_PENDING_SCHEDULE
 *   • pending      — GET returned 200 with status=0
 *
 * APPLIED state note: the backend's getCurrent only returns the PENDING row
 * and throws 404 otherwise; there is no API to fetch a previously-APPLIED
 * schedule. So we cannot render "Last rent change applied on …" purely from
 * the FE without a backend change. The empty state is shown instead.
 */

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { friendlyError } from "@/lib/api/errors";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { formatINR, rupeesToPaise, paiseToRupees } from "@gharsetu/shared";
import { formatDateOnlyIST } from "@/lib/locale";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RentScheduleResponse {
  id: number;
  unitId: number;
  /** Serialized BigInt — always a string on the wire. */
  newAmountPaise: string;
  /** YYYY-MM-DD. */
  effectiveDate: string;
  /** 0=PENDING, 1=CANCELLED, 2=APPLIED. The GET endpoint only returns 0. */
  status: number;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
  cancelledAt: string | null;
}

interface RentScheduleSectionProps {
  unitId: number | string;
  /** Current monthly rent in paise (string from API). */
  currentRentPaise: string | number;
  /** Optional callback fired after any successful create/modify/cancel. */
  onChange?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimum days between today (IST) and effective_date — must match backend. */
const MIN_DAYS_AHEAD = 60;

/** Returns YYYY-MM-DD `MIN_DAYS_AHEAD` days from today in the user's timezone. */
function minEffectiveDateISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + MIN_DAYS_AHEAD);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function paiseStrToNumber(p: string | number): number {
  return typeof p === "string" ? parseInt(p, 10) : p;
}

// ---------------------------------------------------------------------------
// Schedule / Modify modal
// ---------------------------------------------------------------------------

interface ScheduleFormValues {
  newRentRupees: number;
  effectiveDate: string;
}

function ScheduleFormModal({
  open,
  mode,
  onClose,
  unitId,
  currentRentPaise,
  existing,
  onSuccess,
}: {
  open: boolean;
  mode: "create" | "modify";
  onClose: () => void;
  unitId: number | string;
  currentRentPaise: string | number;
  existing: RentScheduleResponse | null;
  onSuccess: (s: RentScheduleResponse) => void;
}) {
  const { apiFetch } = useAuth();
  const minDate = minEffectiveDateISO();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleFormValues>();

  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    if (mode === "modify" && existing) {
      reset({
        newRentRupees: paiseToRupees(paiseStrToNumber(existing.newAmountPaise)),
        effectiveDate: existing.effectiveDate,
      });
    } else {
      reset({
        newRentRupees: paiseToRupees(paiseStrToNumber(currentRentPaise)) || undefined,
        effectiveDate: "",
      });
    }
  }, [open, mode, existing, currentRentPaise, reset]);

  async function onSubmit(data: ScheduleFormValues) {
    setServerError(null);
    const body = {
      newAmountPaise: rupeesToPaise(data.newRentRupees),
      effectiveDate: data.effectiveDate,
    };
    try {
      const res = await apiFetch<RentScheduleResponse>(
        `/units/${unitId}/rent-schedule`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          body: JSON.stringify(body),
        },
      );
      onSuccess(res);
    } catch (err) {
      setServerError(friendlyError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Schedule Rent Change" : "Modify Rent Schedule"}
      maxWidth="max-w-[560px]"
    >
      <p className="text-sm muted mt-1 mb-4">
        Effective date must be at least {MIN_DAYS_AHEAD} days from today. Tenant will be notified.
        Change takes effect on the selected date.
      </p>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <div className="space-y-4">
          <Field
            id="rent-schedule-amount"
            label="New Rent Amount (₹)"
            error={errors.newRentRupees?.message}
          >
            <input
              className="input"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 22000"
              {...register("newRentRupees", {
                required: "New rent amount is required",
                valueAsNumber: true,
                validate: (v) => v > 0 || "Rent must be greater than ₹0",
              })}
            />
          </Field>
          <Field
            id="rent-schedule-effective-date"
            label="Effective Date"
            error={errors.effectiveDate?.message}
          >
            <input
              className="input"
              type="date"
              min={minDate}
              {...register("effectiveDate", {
                required: "Effective date is required",
                validate: (v) =>
                  v >= minDate ||
                  `Effective date must be on or after ${minDate} (60 days from today)`,
              })}
            />
          </Field>
        </div>
        {serverError && <div className="field-error show mt-3">{serverError}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "create"
                ? "Scheduling…"
                : "Saving…"
              : mode === "create"
                ? "Schedule Change"
                : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Cancel confirmation modal
// ---------------------------------------------------------------------------

function CancelConfirmModal({
  open,
  onClose,
  onConfirm,
  busy,
  scheduledRent,
  scheduledDate,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  scheduledRent: string;
  scheduledDate: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Cancel Rent Schedule">
      <p className="text-sm mt-1 text-charcoal">
        Cancel the scheduled rent change of <strong>{scheduledRent}</strong> on{" "}
        <strong>{scheduledDate}</strong>?
      </p>
      <p className="text-sm muted mt-2">
        The current rent will continue unchanged. You can schedule a new change later.
      </p>
      <div className="flex justify-end gap-3 mt-6">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
          Keep Schedule
        </button>
        <button
          type="button"
          className="btn btn-danger !py-2 !text-sm"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Cancelling…" : "Cancel Schedule"}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export function RentScheduleSection({
  unitId,
  currentRentPaise,
  onChange,
}: RentScheduleSectionProps) {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<RentScheduleResponse | null>(null);

  const [openModal, setOpenModal] = useState<"create" | "modify" | "cancel" | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await apiFetch<RentScheduleResponse>(
        `/units/${unitId}/rent-schedule`,
      );
      setSchedule(res);
    } catch (err) {
      // 404 NO_PENDING_SCHEDULE is the empty state — not an error.
      if (err instanceof ApiError && err.code === "NO_PENDING_SCHEDULE") {
        setSchedule(null);
      } else {
        setFetchError(friendlyError(err));
        setSchedule(null);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, unitId]);

  useEffect(() => {
    void fetchSchedule();
  }, [fetchSchedule]);

  function handleScheduled(s: RentScheduleResponse, mode: "create" | "modify") {
    setSchedule(s);
    setOpenModal(null);
    toast(
      mode === "create"
        ? "Rent change scheduled."
        : "Rent schedule updated.",
      "success",
    );
    onChange?.();
  }

  async function handleCancelConfirm() {
    setCancelling(true);
    try {
      await apiFetch(`/units/${unitId}/rent-schedule`, { method: "DELETE" });
      setSchedule(null);
      setOpenModal(null);
      toast("Rent schedule cancelled.", "success");
      onChange?.();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setCancelling(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <section className="card mb-6">
      <h3 className="section-title">Rent Change Schedule</h3>

      {loading ? (
        <p className="text-sm muted">Loading…</p>
      ) : fetchError ? (
        <div className="field-error show">{fetchError}</div>
      ) : schedule ? (
        <>
          <div className="rounded-card border border-mid-gray bg-bg-prepaid p-4">
            <div className="font-poppins font-semibold text-charcoal">
              Scheduled Rent Change
            </div>
            <div className="grid sm:grid-cols-3 gap-x-8 gap-y-2 mt-3 text-sm">
              <div>
                <div className="muted">New Amount</div>
                <strong className="text-charcoal">
                  {formatINR(paiseStrToNumber(schedule.newAmountPaise))}
                </strong>
              </div>
              <div>
                <div className="muted">Effective Date</div>
                <strong className="text-charcoal">
                  {formatDateOnlyIST(schedule.effectiveDate)}
                </strong>
              </div>
              <div>
                <div className="muted">Scheduled On</div>
                <strong className="text-charcoal">
                  {formatDateOnlyIST(schedule.createdAt)}
                </strong>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-4 flex-wrap">
            <button
              type="button"
              className="btn btn-secondary !py-2 !text-sm"
              onClick={() => setOpenModal("modify")}
            >
              Modify
            </button>
            <button
              type="button"
              className="btn btn-danger !py-2 !text-sm"
              onClick={() => setOpenModal("cancel")}
            >
              Cancel Schedule
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm muted mb-4">
            No rent change scheduled. Schedule a future rent change for this unit — the new
            rent applies on the effective date.
          </p>
          <button
            type="button"
            className="btn btn-primary !py-2 !text-sm"
            onClick={() => setOpenModal("create")}
          >
            Schedule Rent Change
          </button>
        </>
      )}

      {/* Create / Modify modal — re-keyed by mode so the form resets cleanly */}
      <ScheduleFormModal
        key={openModal === "modify" ? `modify-${schedule?.id ?? ""}` : "create"}
        open={openModal === "create" || openModal === "modify"}
        mode={openModal === "modify" ? "modify" : "create"}
        onClose={() => setOpenModal(null)}
        unitId={unitId}
        currentRentPaise={currentRentPaise}
        existing={openModal === "modify" ? schedule : null}
        onSuccess={(s) =>
          handleScheduled(s, openModal === "modify" ? "modify" : "create")
        }
      />

      {/* Cancel confirm */}
      <CancelConfirmModal
        open={openModal === "cancel"}
        onClose={() => setOpenModal(null)}
        onConfirm={() => void handleCancelConfirm()}
        busy={cancelling}
        scheduledRent={
          schedule ? formatINR(paiseStrToNumber(schedule.newAmountPaise)) : "—"
        }
        scheduledDate={
          schedule ? formatDateOnlyIST(schedule.effectiveDate) : "—"
        }
      />
    </section>
  );
}
