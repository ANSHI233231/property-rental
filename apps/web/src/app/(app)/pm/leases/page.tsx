"use client";

/**
 * PM Leases list — Phase 3.
 * 1:1 with prototype/pm/leases.html.
 * "Sign new lease" multi-step modal with temp-password reveal on success.
 */

import { useAuth } from "@/lib/auth/context";
import { usePmProperty } from "@/lib/pm/context";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { formatINR, rupeesToPaise, LeaseInputSchema, type LeaseInput, type TenantInput } from "@gharsetu/shared";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { friendlyError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaseRow {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  monthly_rent_paise: string | number;
  security_deposit_paise: string | number;
  unit?: { id: string; name: string };
  tenants?: { id: string; name: string; is_primary: boolean }[];
}

interface PaginatedResponse {
  data?: LeaseRow[];
  items?: LeaseRow[];
  meta?: {
    total?: number;
    count?: number;
    next_cursor?: string | null;
  };
}

interface Unit {
  id: string;
  name: string;
  state: string;
  monthly_rent_paise?: string | number;
}

interface NewTenantCreated {
  name: string;
  email: string;
  tempPassword?: string;
}

interface SignLeaseResponse {
  id: string;
  created_tenants?: NewTenantCreated[];
}

// ---------------------------------------------------------------------------
// Form types (rupees for input, convert to paise on submit)
// ---------------------------------------------------------------------------

interface SignLeaseFormValues {
  unitId: string;
  startDate: string;
  endDate: string;
  monthlyRentRupees: number;
  securityDepositRupees: number;
  tenants: {
    name: string;
    email: string;
    phone: string;
    dob?: string;
    id_proof_type?: string;
    id_proof_number?: string;
  }[];
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "badge-active",
  EXPIRED: "badge-open",
  RENEWED: "badge-renewed",
  TERMINATED: "badge-terminated",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? "badge-open";
  return (
    <span className={`badge ${cls}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Temp-password reveal modal
// ---------------------------------------------------------------------------

function TempPasswordModal({
  open,
  onClose,
  createdTenants,
}: {
  open: boolean;
  onClose: () => void;
  createdTenants: NewTenantCreated[];
}) {
  return (
    <Modal open={open} onClose={onClose} title="Lease Created — Save Credentials" maxWidth="max-w-[560px]">
      <p className="text-sm muted mt-1 mb-4">
        New tenant accounts have been created. <strong className="text-charcoal">Save these passwords now</strong> — they will not be shown again.
      </p>
      <div className="space-y-3">
        {createdTenants.map((t, i) => (
          <div key={i} className="p-3 rounded border border-mid-gray text-sm">
            <div className="font-poppins font-semibold text-charcoal">{t.name}</div>
            <div className="muted">{t.email}</div>
            {t.tempPassword ? (
              <div className="mt-1">
                <span className="muted">Temp password: </span>
                <code className="font-mono font-semibold text-charcoal bg-light-gray px-2 py-0.5 rounded">
                  {t.tempPassword}
                </code>
              </div>
            ) : (
              <div className="muted mt-1 text-xs">Existing account — no new password.</div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-6">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          I have saved these credentials
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sign new lease modal (multi-step)
// ---------------------------------------------------------------------------

function SignLeaseModal({
  open,
  onClose,
  propertyId,
  units,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  units: Unit[];
  onSuccess: (createdTenants: NewTenantCreated[], leaseId: string) => void;
}) {
  const { apiFetch } = useAuth();
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
    reset: resetForm,
    trigger,
  } = useForm<SignLeaseFormValues>({
    defaultValues: {
      unitId: "",
      startDate: "",
      endDate: "",
      monthlyRentRupees: 0,
      securityDepositRupees: 0,
      tenants: [{ name: "", email: "", phone: "", dob: "", id_proof_type: "", id_proof_number: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "tenants" });

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setSubmitError(null);
      resetForm({
        unitId: "",
        startDate: "",
        endDate: "",
        monthlyRentRupees: 0,
        securityDepositRupees: 0,
        tenants: [{ name: "", email: "", phone: "", dob: "", id_proof_type: "", id_proof_number: "" }],
      });
    }
  }, [open, resetForm]);

  async function goToStep2() {
    const valid = await trigger(["unitId", "startDate", "endDate", "monthlyRentRupees", "securityDepositRupees"]);
    if (valid) setStep(2);
  }

  async function onSubmit(data: SignLeaseFormValues) {
    setSubmitError(null);
    try {
      // Build payload conforming to LeaseInputSchema
      const payload: LeaseInput = {
        startDate: data.startDate,
        endDate: data.endDate,
        monthlyRentPaise: rupeesToPaise(data.monthlyRentRupees),
        securityDepositPaise: rupeesToPaise(data.securityDepositRupees),
        tenants: data.tenants.map((t, i): TenantInput => ({
          name: t.name,
          email: t.email,
          phone: t.phone || undefined,
          is_primary: i === 0,
          dob: t.dob || undefined,
          id_proof_type: t.id_proof_type || undefined,
          id_proof_number: t.id_proof_number || undefined,
        })),
      };

      // Validate with shared schema
      const validated = LeaseInputSchema.parse(payload);

      const res = await apiFetch<SignLeaseResponse>(
        `/properties/${propertyId}/units/${data.unitId}/leases`,
        {
          method: "POST",
          body: JSON.stringify(validated),
        },
      );

      onSuccess(res.created_tenants ?? [], res.id);
    } catch (err) {
      setSubmitError(friendlyError(err));
    }
  }

  const watchStartDate = watch("startDate");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 1 ? "New Lease — Details" : "New Lease — Tenants"}
      maxWidth="max-w-[600px]"
    >
      <p className="muted text-sm mt-1 mb-5">
        Rent is locked at signing and cannot be changed mid-lease (BL-02).
      </p>

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field id="unitId" label="Unit" error={errors.unitId?.message}>
                <select className="input" {...register("unitId", { required: "Please select a unit" })}>
                  <option value="">Choose a unit</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.state.charAt(0) + u.state.slice(1).toLowerCase()}
                      {u.monthly_rent_paise
                        ? ` · ${formatINR(typeof u.monthly_rent_paise === "string" ? parseInt(u.monthly_rent_paise, 10) : u.monthly_rent_paise)}`
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {units.length === 0 && (
                <p className="text-xs muted mt-1">No available units. Mark a unit as Available first.</p>
              )}
            </div>
            <Field id="startDate" label="Start date (YYYY-MM-DD)" error={errors.startDate?.message}>
              <input
                className="input"
                type="text"
                placeholder="YYYY-MM-DD"
                {...register("startDate", {
                  required: "Start date is required",
                  pattern: { value: /^\d{4}-\d{2}-\d{2}$/, message: "Format: YYYY-MM-DD" },
                  validate: (v) => v >= new Date().toISOString().slice(0, 10) || "Start date cannot be in the past",
                })}
              />
            </Field>
            <Field id="endDate" label="End date (YYYY-MM-DD)" error={errors.endDate?.message}>
              <input
                className="input"
                type="text"
                placeholder="YYYY-MM-DD"
                {...register("endDate", {
                  required: "End date is required",
                  pattern: { value: /^\d{4}-\d{2}-\d{2}$/, message: "Format: YYYY-MM-DD" },
                  validate: (v) => !watchStartDate || v > watchStartDate || "End date must be after start date",
                })}
              />
            </Field>
            <Field id="monthlyRentRupees" label="Monthly Rent (₹)" error={errors.monthlyRentRupees?.message}>
              <input
                className="input"
                type="number"
                min="1"
                placeholder="18000"
                {...register("monthlyRentRupees", {
                  required: "Rent is required",
                  valueAsNumber: true,
                  validate: (v) => (v > 0) || "Rent must be greater than ₹0",
                })}
              />
            </Field>
            <Field id="securityDepositRupees" label="Security Deposit (₹)" error={errors.securityDepositRupees?.message}>
              <input
                className="input"
                type="number"
                min="0"
                placeholder="36000"
                {...register("securityDepositRupees", {
                  required: "Deposit is required",
                  valueAsNumber: true,
                  validate: (v) => v >= 0 || "Deposit cannot be negative",
                })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={() => void goToStep2()}>
              Next: Tenants →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 rounded border border-mid-gray">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-poppins font-semibold text-charcoal text-sm">
                    {index === 0 ? "Primary Tenant" : `Co-tenant ${index}`}
                  </span>
                  {index > 0 && (
                    <button
                      type="button"
                      className="text-sm text-royal-blue hover:underline"
                      onClick={() => remove(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field
                    id={`tenants.${index}.name`}
                    label="Full Name *"
                    error={errors.tenants?.[index]?.name?.message}
                  >
                    <input
                      className="input"
                      type="text"
                      {...register(`tenants.${index}.name`, { required: "Name is required" })}
                    />
                  </Field>
                  <Field
                    id={`tenants.${index}.email`}
                    label="Email *"
                    error={errors.tenants?.[index]?.email?.message}
                  >
                    <input
                      className="input"
                      type="email"
                      {...register(`tenants.${index}.email`, {
                        required: "Email is required",
                        pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Valid email required" },
                      })}
                    />
                  </Field>
                  <Field
                    id={`tenants.${index}.phone`}
                    label="Phone *"
                    error={errors.tenants?.[index]?.phone?.message}
                  >
                    <input
                      className="input"
                      type="text"
                      placeholder="9876543210"
                      {...register(`tenants.${index}.phone`, {
                        required: "Phone is required",
                        pattern: { value: /^[6-9]\d{9}$/, message: "Valid Indian mobile number required" },
                      })}
                    />
                  </Field>
                  <Field
                    id={`tenants.${index}.dob`}
                    label="Date of Birth (YYYY-MM-DD)"
                    error={errors.tenants?.[index]?.dob?.message}
                  >
                    <input
                      className="input"
                      type="text"
                      placeholder="YYYY-MM-DD (optional)"
                      {...register(`tenants.${index}.dob`)}
                    />
                  </Field>
                  <Field
                    id={`tenants.${index}.id_proof_type`}
                    label="ID Proof Type"
                    error={errors.tenants?.[index]?.id_proof_type?.message}
                  >
                    <input
                      className="input"
                      type="text"
                      placeholder="Aadhaar, Passport… (optional)"
                      {...register(`tenants.${index}.id_proof_type`)}
                    />
                  </Field>
                  <Field
                    id={`tenants.${index}.id_proof_number`}
                    label="ID Proof Number"
                    error={errors.tenants?.[index]?.id_proof_number?.message}
                  >
                    <input
                      className="input"
                      type="text"
                      placeholder="(optional)"
                      {...register(`tenants.${index}.id_proof_number`)}
                    />
                  </Field>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary !py-2 !text-sm"
              onClick={() =>
                append({ name: "", email: "", phone: "", dob: "", id_proof_type: "", id_proof_number: "" })
              }
            >
              + Add co-tenant
            </button>
          </div>

          {submitError && (
            <div className="field-error show mt-3">{submitError}</div>
          )}

          <div className="flex justify-between gap-3 mt-6">
            <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
              ← Back
            </button>
            <div className="flex gap-3">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Creating…" : "Create Lease"}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PmLeasesPage() {
  const { apiFetch } = useAuth();
  const { property, propertyId, loading: propertyLoading } = usePmProperty();
  const router = useRouter();

  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showNewLeaseModal, setShowNewLeaseModal] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);

  const [showTempPassModal, setShowTempPassModal] = useState(false);
  const [createdTenants, setCreatedTenants] = useState<NewTenantCreated[]>([]);
  const [newLeaseId, setNewLeaseId] = useState<string | null>(null);

  // Leases ending soon alert
  const endingSoon = leases.filter((l) => {
    if (l.status !== "ACTIVE") return false;
    try {
      const end = parseISO(l.end_date);
      const now = new Date();
      const days = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 30;
    } catch { return false; }
  });

  const fetchLeases = useCallback(
    async (cursor: string | null = null, append = false) => {
      if (!propertyId) return;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({ limit: "20" });
        if (cursor) params.set("cursor", cursor);
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        params.set("propertyId", propertyId);

        const res = await apiFetch<PaginatedResponse>(`/leases?${params.toString()}`);
        const rows: LeaseRow[] = res.data ?? res.items ?? [];

        setLeases((prev) => (append ? [...prev, ...rows] : rows));
        setTotal(res.meta?.total ?? null);
        setNextCursor(res.meta?.next_cursor ?? null);
      } catch {
        if (!append) setLeases([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [apiFetch, propertyId, statusFilter],
  );

  useEffect(() => {
    if (!propertyLoading && propertyId) {
      void fetchLeases();
    } else if (!propertyLoading && !propertyId) {
      setLoading(false);
    }
  }, [fetchLeases, propertyLoading, propertyId]);

  async function openNewLeaseModal() {
    if (!propertyId) return;
    try {
      const res = await apiFetch<{ data?: Unit[]; items?: Unit[] }>(
        `/properties/${propertyId}/units?state=AVAILABLE&limit=100`,
      );
      const units = res.data ?? res.items ?? [];
      setAvailableUnits(units);
    } catch {
      setAvailableUnits([]);
    }
    setShowNewLeaseModal(true);
  }

  function handleLeaseCreated(newTenants: NewTenantCreated[], leaseId: string) {
    setShowNewLeaseModal(false);
    setCreatedTenants(newTenants);
    setNewLeaseId(leaseId);
    setShowTempPassModal(true);
    void fetchLeases();
  }

  function handleTempPassDismiss() {
    setShowTempPassModal(false);
    if (newLeaseId) {
      router.push(`/pm/leases/${newLeaseId}`);
    }
  }

  const formatDate = (iso: string) => {
    try { return format(parseISO(iso), "dd/MM/yyyy"); } catch { return iso; }
  };

  const formatRent = (paise: string | number) => {
    const val = typeof paise === "string" ? parseInt(paise, 10) : paise;
    return isNaN(val) ? "—" : formatINR(val);
  };

  const formatTenants = (tenants?: LeaseRow["tenants"]) => {
    if (!tenants || tenants.length === 0) return "—";
    return tenants.map((t) => (t.is_primary ? `• ${t.name}` : t.name)).join(", ");
  };

  const isEmpty = !loading && leases.length === 0;

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Leases</h1>
          <div className="page-subtitle">{property?.name ?? ""}</div>
        </div>
        <button
          type="button"
          className="btn btn-primary !py-2 !text-sm"
          onClick={() => void openNewLeaseModal()}
        >
          + New Lease
        </button>
      </header>

      {/* Expiry alert */}
      {endingSoon.length > 0 && (
        <div className="alert mb-6">
          <strong className="font-poppins">
            {endingSoon.length} lease{endingSoon.length > 1 ? "s" : ""} expiring within 30 days
          </strong>
          <div>
            Renewals create a new lease record automatically. The old lease keeps &ldquo;Active&rdquo; status until its end date, then transitions to &ldquo;Renewed&rdquo;.
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {["ALL", "ACTIVE", "EXPIRED", "RENEWED", "TERMINATED"].map((s) => (
          <button
            key={s}
            type="button"
            className={`btn !py-1 !px-3 !text-sm ${statusFilter === s ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Table */}
      <section className="card p-0 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tenant(s)</th>
              <th>Unit</th>
              <th>Start</th>
              <th>End</th>
              <th>Rent</th>
              <th>Deposit</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows rows={5} cols={8} />
            ) : isEmpty ? (
              <tr>
                <td colSpan={8} className="p-0">
                  <EmptyState
                    heading="No leases yet."
                    body="Click '+ New Lease' to sign the first lease for this property."
                    cta={
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => void openNewLeaseModal()}
                      >
                        + New Lease
                      </button>
                    }
                  />
                </td>
              </tr>
            ) : (
              leases.map((l) => (
                <tr
                  key={l.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/pm/leases/${l.id}`)}
                >
                  <td>
                    <div className="font-poppins font-semibold text-charcoal">
                      {formatTenants(l.tenants)}
                    </div>
                    {l.tenants && l.tenants.length > 1 && (
                      <div className="text-xs muted">
                        {l.tenants.length} tenant{l.tenants.length > 1 ? "s" : ""}
                      </div>
                    )}
                  </td>
                  <td>{l.unit?.name ?? "—"}</td>
                  <td>{formatDate(l.start_date)}</td>
                  <td>{formatDate(l.end_date)}</td>
                  <td>{formatRent(l.monthly_rent_paise)}</td>
                  <td>{formatRent(l.security_deposit_paise)}</td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-secondary !py-1 !px-3 !text-sm"
                        onClick={() => router.push(`/pm/leases/${l.id}`)}
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && !isEmpty && (
          <div className="flex items-center justify-between p-4 border-t border-light-gray text-sm muted">
            <div>Showing {leases.length}{total != null ? ` of ${total}` : ""}</div>
            {nextCursor && (
              <button
                type="button"
                className="btn btn-secondary !py-1 !px-3 !text-sm"
                onClick={() => void fetchLeases(nextCursor, true)}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Sign new lease modal */}
      {showNewLeaseModal && propertyId && (
        <SignLeaseModal
          open={showNewLeaseModal}
          onClose={() => setShowNewLeaseModal(false)}
          propertyId={propertyId}
          units={availableUnits}
          onSuccess={handleLeaseCreated}
        />
      )}

      {/* Temp password reveal */}
      <TempPasswordModal
        open={showTempPassModal}
        onClose={handleTempPassDismiss}
        createdTenants={createdTenants}
      />
    </>
  );
}
