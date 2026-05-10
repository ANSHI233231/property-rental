"use client";

/**
 * Admin Property Detail — Phase 2.
 * Sections: meta (editable), assigned PM (transfer), units list.
 * BL-03: rent locked when OCCUPIED/MAINTENANCE.
 * BL-05: retire is one-way.
 */

import { useAuth } from "@/lib/auth/context";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  UnitInputSchema,
  UnitUpdateSchema,
  TransferPmInputSchema,
  type UnitInput,
  type UnitUpdate,
  type TransferPmInput,
  type UnitStateValue,
  formatINR,
  rupeesToPaise,
  paiseToRupees,
} from "@gharsetu/shared";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { friendlyError } from "@/lib/api/errors";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PropertyDetail {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  timezone: string;
  active_pm?: { id: string; name: string; email: string } | null;
  created_at?: string;
}

interface UnitRow {
  id: string;
  unit_number: string;
  floor?: number | null;
  bedrooms: number;
  bathrooms: number;
  area_sqft?: number | null;
  monthly_rent_paise: number;
  state: UnitStateValue;
  is_retired: boolean;
  created_at?: string;
}

interface UnitsResponse {
  data: UnitRow[];
  meta?: { total?: number; hasMore?: boolean; cursor?: string };
  hasMore?: boolean;
  nextCursor?: string;
  total?: number;
}

interface PmUser {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
}

interface UsersResponse {
  data: PmUser[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stateBadgeClass(state: UnitStateValue | "RETIRED"): string {
  switch (state) {
    case "AVAILABLE": return "badge badge-paid";
    case "OCCUPIED": return "badge badge-prepaid";
    case "MAINTENANCE": return "badge badge-partial";
    case "LISTED": return "badge badge-renewed";
    case "RETIRED": return "badge badge-closed";
    default: return "badge badge-closed";
  }
}

function stateLabel(state: UnitStateValue | "RETIRED"): string {
  switch (state) {
    case "AVAILABLE": return "Available";
    case "OCCUPIED": return "Occupied";
    case "MAINTENANCE": return "In-Maintenance";
    case "LISTED": return "Listed";
    case "RETIRED": return "Retired";
    default: return state;
  }
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy");
  } catch {
    return "—";
  }
}

// ---------------------------------------------------------------------------
// Transfer PM Modal
// ---------------------------------------------------------------------------

function TransferPmModal({
  open,
  onClose,
  propertyId,
  currentPmId,
  onTransferred,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  currentPmId?: string | null;
  onTransferred: () => void;
}) {
  const { apiFetch } = useAuth();
  const { toast } = useToast();
  const [pms, setPms] = useState<PmUser[]>([]);
  const [loadingPms, setLoadingPms] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransferPmInput>({
    resolver: zodResolver(TransferPmInputSchema),
    defaultValues: { toPmId: null },
  });

  useEffect(() => {
    if (!open) return;
    setLoadingPms(true);
    apiFetch<UsersResponse>("/users?role=PROPERTY_MANAGER&limit=100")
      .then((res) => {
        // Exclude inactive PMs
        setPms((res.data ?? []).filter((pm) => pm.is_active));
      })
      .catch(() => {})
      .finally(() => setLoadingPms(false));
  }, [open, apiFetch]);

  function handleClose() {
    reset();
    setServerError("");
    onClose();
  }

  async function onSubmit(data: TransferPmInput) {
    setServerError("");
    try {
      await apiFetch(`/properties/${propertyId}/transfer-pm`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      toast("Property Manager transferred successfully.", "success");
      reset();
      onTransferred();
      onClose();
    } catch (err) {
      setServerError(friendlyError(err));
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Transfer Property Manager">
      <p className="muted text-sm mt-1 mb-4">
        Select a new Property Manager for this property. The current PM will be unassigned.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label className="label" htmlFor="transfer-pm-select">
            New Property Manager
          </label>
          {loadingPms ? (
            <Skeleton className="h-11 w-full rounded" />
          ) : (
            <select
              id="transfer-pm-select"
              className={`input${errors.toPmId ? " error" : ""}`}
              {...register("toPmId")}
            >
              <option value="">— Unassign (no PM) —</option>
              {pms
                .filter((pm) => pm.id !== currentPmId)
                .map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name} ({pm.email})
                  </option>
                ))}
            </select>
          )}
          {errors.toPmId && (
            <div className="field-error show" role="alert">
              {errors.toPmId.message}
            </div>
          )}
        </div>

        <Field id="transfer-note" label="Note (optional)" error={undefined}>
          <textarea
            className="input"
            rows={3}
            placeholder="Reason for transfer…"
            {...register("note")}
          />
        </Field>

        {serverError && (
          <div className="field-error show" role="alert">
            {serverError}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Transferring…" : "Transfer PM"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Add Unit Modal
// ---------------------------------------------------------------------------

function AddUnitModal({
  open,
  onClose,
  propertyId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  onCreated: () => void;
}) {
  const { apiFetch } = useAuth();
  const { toast } = useToast();
  const [serverError, setServerError] = useState("");

  // We use a rupee field in the UI and convert to paise on submit
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Omit<UnitInput, "monthly_rent_paise"> & { monthly_rent_rupees: number }>({
    defaultValues: { bedrooms: 1, bathrooms: 1 },
  });

  function handleClose() {
    reset();
    setServerError("");
    onClose();
  }

  async function onSubmit(
    data: Omit<UnitInput, "monthly_rent_paise"> & { monthly_rent_rupees: number },
  ) {
    setServerError("");
    const paise = rupeesToPaise(Number(data.monthly_rent_rupees));
    const parsed = UnitInputSchema.safeParse({ ...data, monthly_rent_paise: paise });
    if (!parsed.success) {
      setServerError(parsed.error.errors[0]?.message ?? "Invalid input.");
      return;
    }
    try {
      await apiFetch(`/properties/${propertyId}/units`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      toast("Unit created successfully.", "success");
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setServerError(friendlyError(err));
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add New Unit">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
        <Field id="unit-number" label="Unit number" error={errors.unit_number?.message}>
          <input className="input" placeholder="e.g. 3A" {...register("unit_number")} />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field id="unit-floor" label="Floor" error={undefined}>
            <input
              type="number"
              className="input"
              placeholder="0"
              {...register("floor", { valueAsNumber: true })}
            />
          </Field>
          <Field id="unit-bed" label="Bedrooms" error={errors.bedrooms?.message}>
            <input
              type="number"
              min={0}
              className="input"
              {...register("bedrooms", { valueAsNumber: true })}
            />
          </Field>
          <Field id="unit-bath" label="Bathrooms" error={errors.bathrooms?.message}>
            <input
              type="number"
              min={0}
              className="input"
              {...register("bathrooms", { valueAsNumber: true })}
            />
          </Field>
        </div>

        <Field id="unit-area" label="Area (sq ft, optional)" error={undefined}>
          <input
            type="number"
            className="input"
            placeholder="650"
            {...register("area_sqft", { valueAsNumber: true })}
          />
        </Field>

        <Field id="unit-rent" label="Monthly rent (₹)" error={undefined}>
          <input
            type="number"
            min={1}
            step={500}
            className="input"
            placeholder="18000"
            {...register("monthly_rent_rupees", { valueAsNumber: true })}
          />
        </Field>

        {serverError && (
          <div className="field-error show" role="alert">
            {serverError}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Add Unit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Change Unit State Modal
// ---------------------------------------------------------------------------

const STATES: UnitStateValue[] = ["AVAILABLE", "LISTED", "OCCUPIED", "MAINTENANCE"];

function ChangeStateModal({
  open,
  onClose,
  unit,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  unit: UnitRow | null;
  onChanged: () => void;
}) {
  const { apiFetch } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<UnitStateValue>("AVAILABLE");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (unit) setSelected(unit.state);
  }, [unit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unit) return;
    setSubmitting(true);
    setServerError("");
    try {
      await apiFetch(`/units/${unit.id}/state`, {
        method: "PATCH",
        body: JSON.stringify({ state: selected }),
      });
      toast("Unit state updated.", "success");
      onChanged();
      onClose();
    } catch (err) {
      setServerError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Change state — Unit ${unit?.unit_number ?? ""}`}
    >
      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <div>
          <label className="label" htmlFor="unit-state-select">
            New state
          </label>
          <select
            id="unit-state-select"
            className="input"
            value={selected}
            onChange={(e) => setSelected(e.target.value as UnitStateValue)}
          >
            {STATES.map((s) => (
              <option key={s} value={s}>
                {stateLabel(s)}
              </option>
            ))}
          </select>
        </div>

        {serverError && (
          <div className="field-error show" role="alert">
            {serverError}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save state"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Retire confirmation modal
// ---------------------------------------------------------------------------

function RetireModal({
  open,
  onClose,
  unit,
  onRetired,
}: {
  open: boolean;
  onClose: () => void;
  unit: UnitRow | null;
  onRetired: () => void;
}) {
  const { apiFetch } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  async function handleRetire() {
    if (!unit) return;
    setSubmitting(true);
    setServerError("");
    try {
      await apiFetch(`/units/${unit.id}/retire`, { method: "POST" });
      toast("Unit retired. This action is permanent.", "info");
      onRetired();
      onClose();
    } catch (err) {
      setServerError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Retire Unit ${unit?.unit_number ?? ""}`}
    >
      <div className="mt-2">
        <div className="alert alert-emergency mb-4">
          <div>
            <strong className="font-poppins">This action is permanent.</strong> Retired
            units cannot be reactivated. Create a new unit if you need to replace it.
          </div>
        </div>
        {serverError && (
          <div className="field-error show mb-4" role="alert">
            {serverError}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={submitting}
            onClick={handleRetire}
          >
            {submitting ? "Retiring…" : "Retire unit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loadingProp, setLoadingProp] = useState(true);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [unitsTotal, setUnitsTotal] = useState<number | undefined>();

  // Modal states
  const [transferOpen, setTransferOpen] = useState(false);
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [changeStateUnit, setChangeStateUnit] = useState<UnitRow | null>(null);
  const [retireUnit, setRetireUnit] = useState<UnitRow | null>(null);

  const fetchProperty = useCallback(async () => {
    try {
      const res = await apiFetch<PropertyDetail>(`/properties/${id}`);
      setProperty(res);
    } catch {
      toast("Failed to load property.", "error");
    } finally {
      setLoadingProp(false);
    }
  }, [id, apiFetch, toast]);

  const fetchUnits = useCallback(async () => {
    setLoadingUnits(true);
    try {
      const res = await apiFetch<UnitsResponse>(
        `/properties/${id}/units?limit=50`,
      );
      setUnits(res.data ?? []);
      setUnitsTotal(res.meta?.total ?? res.total);
    } catch {
      // swallow
    } finally {
      setLoadingUnits(false);
    }
  }, [id, apiFetch]);

  useEffect(() => {
    void fetchProperty();
    void fetchUnits();
  }, [fetchProperty, fetchUnits]);

  if (loadingProp) {
    return (
      <div className="space-y-4 mt-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="mt-8">
        <p className="text-slate">Property not found.</p>
        <Link href="/admin/properties" className="btn btn-secondary mt-4">
          ← Back to Properties
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb + page header */}
      <header className="topbar">
        <div>
          <div className="text-sm muted mb-1">
            <Link href="/admin/properties" className="text-royal-blue hover:underline">
              Properties
            </Link>{" "}
            / {property.name}
          </div>
          <h1 className="page-title">{property.name}</h1>
          <div className="page-subtitle">
            {property.address}, {property.city}
          </div>
        </div>
      </header>

      {/* Property meta */}
      <section className="section">
        <h3 className="section-title">Property Details</h3>
        <div className="card">
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
            {[
              { label: "Name", value: property.name },
              { label: "Address", value: property.address },
              { label: "City", value: property.city },
              { label: "State", value: property.state },
              { label: "Pincode", value: property.pincode },
              { label: "Timezone", value: property.timezone },
              { label: "Added on", value: formatDate(property.created_at) },
            ].map(({ label, value }) => (
              <div key={label} className="profile-row">
                <span className="field">{label}</span>
                <span className="value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Assigned PM */}
      <section className="section">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title m-0">Assigned Property Manager</h3>
          <button
            type="button"
            className="btn btn-secondary !py-2 !text-sm"
            onClick={() => setTransferOpen(true)}
          >
            Transfer PM
          </button>
        </div>
        <div className="card">
          {property.active_pm ? (
            <div className="grid md:grid-cols-2 gap-3">
              <div className="profile-row">
                <span className="field">Name</span>
                <span className="value">{property.active_pm.name}</span>
              </div>
              <div className="profile-row">
                <span className="field">Email</span>
                <span className="value">{property.active_pm.email}</span>
              </div>
            </div>
          ) : (
            <p className="muted text-sm">
              No Property Manager assigned. Use &ldquo;Transfer PM&rdquo; to assign one.
            </p>
          )}
        </div>
      </section>

      {/* Units list */}
      <section className="section">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title m-0">
            Units {unitsTotal != null ? `(${unitsTotal})` : ""}
          </h3>
          <button
            type="button"
            className="btn btn-primary !py-2 !text-sm"
            onClick={() => setAddUnitOpen(true)}
          >
            + Add Unit
          </button>
        </div>

        <div className="card p-0 overflow-x-auto">
          {loadingUnits ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Floor</th>
                  <th>Bed/Bath</th>
                  <th>Rent</th>
                  <th>State</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-[14px]">
                        <Skeleton className="h-4 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : units.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="font-poppins font-semibold text-charcoal mb-1">No units yet.</p>
              <p className="text-sm muted mb-4">Add units to this property.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setAddUnitOpen(true)}
              >
                + Add Unit
              </button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Floor</th>
                  <th>Bed/Bath</th>
                  <th>Area</th>
                  <th>Rent</th>
                  <th>State</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.id}>
                    <td className="font-poppins font-semibold text-charcoal">
                      {unit.unit_number}
                    </td>
                    <td>{unit.floor ?? "—"}</td>
                    <td>
                      {unit.bedrooms}B / {unit.bathrooms}Ba
                    </td>
                    <td>{unit.area_sqft ? `${unit.area_sqft} sq ft` : "—"}</td>
                    <td className="font-poppins font-semibold">
                      {formatINR(unit.monthly_rent_paise)}
                    </td>
                    <td>
                      <span
                        className={
                          unit.is_retired
                            ? "badge badge-closed"
                            : stateBadgeClass(unit.state)
                        }
                      >
                        {unit.is_retired ? "Retired" : stateLabel(unit.state)}
                      </span>
                    </td>
                    <td>
                      {!unit.is_retired && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-royal-blue font-poppins font-semibold text-sm hover:underline"
                            onClick={() => setChangeStateUnit(unit)}
                          >
                            State
                          </button>
                          <span className="text-mid-gray">·</span>
                          <button
                            type="button"
                            className="text-status-overdue font-poppins font-semibold text-sm hover:underline"
                            onClick={() => setRetireUnit(unit)}
                          >
                            Retire
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Modals */}
      <TransferPmModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        propertyId={id}
        currentPmId={property.active_pm?.id}
        onTransferred={fetchProperty}
      />

      <AddUnitModal
        open={addUnitOpen}
        onClose={() => setAddUnitOpen(false)}
        propertyId={id}
        onCreated={fetchUnits}
      />

      <ChangeStateModal
        open={changeStateUnit !== null}
        onClose={() => setChangeStateUnit(null)}
        unit={changeStateUnit}
        onChanged={fetchUnits}
      />

      <RetireModal
        open={retireUnit !== null}
        onClose={() => setRetireUnit(null)}
        unit={retireUnit}
        onRetired={fetchUnits}
      />
    </>
  );
}
