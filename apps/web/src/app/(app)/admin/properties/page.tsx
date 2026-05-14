"use client";

/**
 * Admin Properties list — Phase 2.
 * Matches prototype/admin/properties.html 1:1.
 * Columns: Property, Address, City, Units, Manager, Occupancy, View link.
 * Cursor pagination (10 per page), "Add Property" → modal.
 */

import { useAuth } from "@/lib/auth/context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PropertyInputSchema, type PropertyInput } from "@gharsetu/shared";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { friendlyError } from "@/lib/api/errors";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { usePaginatedList } from "@/lib/pagination/usePaginatedList";

// ---------------------------------------------------------------------------
// Types (API shapes for this page)
// ---------------------------------------------------------------------------

interface PropertyRow {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  timezone: string;
  active_pm?: { id: string; name: string } | null;
  // _count.units = non-retired unit total; units[] = OCCUPIED non-retired
  // units (id-only) so the FE can render occupancy as occupied / total.
  _count?: { units?: number };
  units?: Array<{ id: number | string }>;
}

interface PmOption {
  id: number | string;
  name: string;
}

// ---------------------------------------------------------------------------
// Add Property form
// ---------------------------------------------------------------------------

function AddPropertyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { apiFetch } = useAuth();
  const { toast } = useToast();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PropertyInput>({
    resolver: zodResolver(PropertyInputSchema),
    defaultValues: { timezone: "Asia/Kolkata" },
  });

  function handleClose() {
    reset();
    setServerError("");
    onClose();
  }

  async function onSubmit(data: PropertyInput) {
    setServerError("");
    try {
      await apiFetch("/properties", {
        method: "POST",
        body: JSON.stringify(data),
      });
      toast("Property created successfully.", "success");
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setServerError(friendlyError(err));
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add New Property">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
        <Field id="prop-name" label="Property name" error={errors.name?.message}>
          <input
            className="input"
            placeholder="e.g. Green Valley Apartments"
            {...register("name")}
          />
        </Field>

        <Field id="prop-address" label="Address" error={errors.address?.message}>
          <input
            className="input"
            placeholder="Street address"
            {...register("address")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="prop-city" label="City" error={errors.city?.message}>
            <input className="input" placeholder="Delhi" {...register("city")} />
          </Field>
          <Field id="prop-state" label="State" error={errors.state?.message}>
            <input className="input" placeholder="Delhi" {...register("state")} />
          </Field>
        </div>

        <Field id="prop-pincode" label="Pincode" error={errors.pincode?.message}>
          <input
            className="input"
            placeholder="110001"
            maxLength={6}
            {...register("pincode")}
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
            {isSubmitting ? "Creating…" : "Create Property"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PropertiesPage() {
  const router = useRouter();
  const { apiFetch } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pmFilter, setPmFilter] = useState<string>("ALL");
  const [pms, setPms] = useState<PmOption[]>([]);

  // Fetch PM list once for the manager filter dropdown.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ data: PmOption[] }>(
          "/users?role=PROPERTY_MANAGER&limit=200",
        );
        if (!cancelled) setPms(res.data ?? []);
      } catch {
        if (!cancelled) setPms([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  const extraQuery: Record<string, string | undefined> = {};
  if (search.trim()) extraQuery.search = search.trim();
  if (pmFilter !== "ALL") extraQuery.activePmId = pmFilter;

  const {
    items: rows,
    page,
    totalPages,
    total,
    pageSize: activePageSize,
    hasNext,
    hasPrev,
    loading,
    next,
    prev,
    goToPage,
  } = usePaginatedList<PropertyRow>({
    url: "/properties",
    extraQuery,
    pageSize: 10,
    refetchKey,
  });

  const isEmpty = !loading && rows.length === 0;

  return (
    <>
      {/* Page header */}
      <header className="topbar">
        <div>
          <h1 className="page-title">Properties</h1>
          <div className="page-subtitle">
            units per property on detail page
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="btn btn-primary !py-2 !text-sm"
            onClick={() => setAddOpen(true)}
          >
            + Add Property
          </button>
        </div>
      </header>

      {/* Filter bar */}
      <section className="card mb-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="prop-search">
              Search
            </label>
            <input
              id="prop-search"
              className="input"
              placeholder="Property name, area"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setSearch(searchInput); }}
            />
          </div>
          <div>
            <label className="label" htmlFor="prop-manager">
              Manager
            </label>
            <select
              id="prop-manager"
              className="input"
              value={pmFilter}
              onChange={(e) => setPmFilter(e.target.value)}
            >
              <option value="ALL">Any manager</option>
              <option value="0">Unassigned</option>
              {pms.map((pm) => (
                <option key={pm.id} value={String(pm.id)}>
                  {pm.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSearch(searchInput)}
            >
              Search
            </button>
          </div>
        </div>
      </section>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Address</th>
              <th>City</th>
              <th>Units</th>
              <th>Manager</th>
              <th>Occupancy</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows rows={5} cols={7} />
            ) : isEmpty ? (
              <tr>
                <td colSpan={7} className="p-0">
                  <EmptyState
                    heading="No properties yet."
                    body="Add your first property to get started."
                    cta={
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setAddOpen(true)}
                      >
                        + Add Property
                      </button>
                    }
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const totalUnits = row._count?.units ?? 0;
                const occupiedUnits = row.units?.length ?? 0;
                const occupancyPct = totalUnits > 0
                  ? Math.round((occupiedUnits / totalUnits) * 100)
                  : null;
                return (
                <tr key={row.id}>
                  <td className="font-poppins font-semibold text-charcoal">{row.name}</td>
                  <td>{row.address}</td>
                  <td>{row.city}</td>
                  <td>{totalUnits > 0 ? totalUnits : <span className="muted">—</span>}</td>
                  <td>{row.active_pm?.name ?? <span className="muted">—</span>}</td>
                  <td>
                    {totalUnits > 0 ? (
                      <span>
                        {occupiedUnits}/{totalUnits}
                        <span className="muted ml-1">({occupancyPct}%)</span>
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-royal-blue font-poppins font-semibold hover:underline focus-visible:outline-saffron rounded"
                      onClick={() => router.push(`/admin/properties/${row.id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination footer */}
        {!loading && !isEmpty && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={activePageSize}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={prev}
            onNext={next}
            onGoToPage={goToPage}
            itemsOnPage={rows.length}
            loading={loading}
          />
        )}
      </div>

      {/* Unit state legend */}
      <section className="section mt-6">
        <h3 className="section-title">Unit State Legend</h3>
        <div className="flex flex-wrap gap-2">
          <span className="badge badge-paid">Available</span>
          <span className="badge badge-prepaid">Occupied</span>
          <span className="badge badge-partial">In-Maintenance</span>
          <span className="badge badge-renewed">Listed</span>
          <span className="badge badge-closed">Retired</span>
        </div>
        <p className="text-sm muted mt-3">
          Retired units are permanent — they are never reactivated. Create a fresh unit if
          needed.
        </p>
      </section>

      {/* Add Property modal */}
      <AddPropertyModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => setRefetchKey((k) => k + 1)}
      />
    </>
  );
}
