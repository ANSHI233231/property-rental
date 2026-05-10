"use client";

/**
 * Admin Properties list — Phase 2.
 * Matches prototype/admin/properties.html 1:1.
 * Columns: Property, Address, City, Units, Manager, Occupancy, View link.
 * Cursor pagination (20 per page), "Add Property" → modal.
 */

import { useAuth } from "@/lib/auth/context";
import { useCallback, useEffect, useState } from "react";
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
  _count?: { units?: number };
}

interface PropertiesResponse {
  data: PropertyRow[];
  meta?: { total?: number; cursor?: string; hasMore?: boolean };
  nextCursor?: string;
  hasMore?: boolean;
  total?: number;
}

// ---------------------------------------------------------------------------
// Inline properties table (typed, avoids generic cast issue)
// ---------------------------------------------------------------------------

function PropertiesTable({
  rows,
  loading,
  countLabel,
  hasMore,
  onLoadMore,
  loadingMore,
  onView,
  onAdd,
}: {
  rows: PropertyRow[];
  loading: boolean;
  countLabel: string;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore: boolean;
  onView: (row: PropertyRow) => void;
  onAdd: () => void;
}) {
  const isEmpty = !loading && rows.length === 0;

  return (
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
                      onClick={onAdd}
                    >
                      + Add Property
                    </button>
                  }
                />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className="font-poppins font-semibold text-charcoal">{row.name}</td>
                <td>{row.address}</td>
                <td>{row.city}</td>
                <td>{row._count?.units ?? "—"}</td>
                <td>{row.active_pm?.name ?? <span className="muted">—</span>}</td>
                <td className="muted">—</td>
                <td>
                  <button
                    type="button"
                    className="text-royal-blue font-poppins font-semibold hover:underline focus-visible:outline-saffron rounded"
                    onClick={() => onView(row)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination footer */}
      {!loading && !isEmpty && (
        <div className="flex items-center justify-between p-4 border-t border-light-gray text-sm muted">
          <div>{countLabel}</div>
          {hasMore && (
            <button
              type="button"
              className="btn btn-secondary !py-1 !px-3 !text-sm"
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
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
  const { apiFetch } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState<number | undefined>();
  const [addOpen, setAddOpen] = useState(false);

  const fetchProperties = useCallback(
    async (nextCursor?: string) => {
      const params = new URLSearchParams({ limit: "20" });
      if (nextCursor) params.set("cursor", nextCursor);
      return apiFetch<PropertiesResponse>(`/properties?${params.toString()}`);
    },
    [apiFetch],
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchProperties()
      .then((res) => {
        if (cancelled) return;
        setRows(res.data ?? []);
        setHasMore(res.meta?.hasMore ?? res.hasMore ?? false);
        setCursor(res.meta?.cursor ?? res.nextCursor);
        setTotal(res.meta?.total ?? res.total);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchProperties]);

  async function handleLoadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetchProperties(cursor);
      setRows((prev) => [...prev, ...(res.data ?? [])]);
      setHasMore(res.meta?.hasMore ?? res.hasMore ?? false);
      setCursor(res.meta?.cursor ?? res.nextCursor);
    } catch {
      // swallow — user can retry
    } finally {
      setLoadingMore(false);
    }
  }

  function handleRefresh() {
    setCursor(undefined);
    setRows([]);
    setLoading(true);
    fetchProperties()
      .then((res) => {
        setRows(res.data ?? []);
        setHasMore(res.meta?.hasMore ?? res.hasMore ?? false);
        setCursor(res.meta?.cursor ?? res.nextCursor);
        setTotal(res.meta?.total ?? res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  const countLabel =
    total != null
      ? `Showing 1–${rows.length} of ${total}`
      : `${rows.length} properties`;

  return (
    <>
      {/* Page header */}
      <header className="topbar">
        <div>
          <h1 className="page-title">Properties</h1>
          <div className="page-subtitle">
            {total != null ? `${total} buildings` : "—"} · units per property on detail page
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
            />
          </div>
          <div>
            <label className="label" htmlFor="prop-manager">
              Manager
            </label>
            <select id="prop-manager" className="input">
              <option>Any manager</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="prop-occupancy">
              Occupancy
            </label>
            <select id="prop-occupancy" className="input">
              <option>Any</option>
              <option>Below 80%</option>
              <option>80–95%</option>
              <option>Above 95%</option>
            </select>
          </div>
        </div>
      </section>

      {/* Table */}
      <PropertiesTable
        rows={rows}
        loading={loading}
        countLabel={countLabel}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        loadingMore={loadingMore}
        onView={(row) => router.push(`/admin/properties/${row.id}`)}
        onAdd={() => setAddOpen(true)}
      />

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
        onCreated={handleRefresh}
      />
    </>
  );
}
