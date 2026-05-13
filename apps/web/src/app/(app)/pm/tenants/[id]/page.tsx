"use client";

/**
 * PM Tenant Detail — Phase 3.
 * Personal info + current lease summary. Editable personal fields via PATCH /tenants/:id.
 */

import { useAuth } from "@/lib/auth/context";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDateOnlyIST } from "@/lib/locale";
import { formatINR, LeaseStatusEnum, leaseStatusName } from "@gharsetu/shared";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TenantUpdateSchema, type TenantUpdate } from "@gharsetu/shared";
import { Field } from "@/components/ui/Field";
import { friendlyError } from "@/lib/api/errors";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenantDetail {
  id: number | string;
  name: string;
  email: string;
  phone?: string;
  dob?: string | null;
  id_proof_type?: string | null;
  id_proof_number?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  unit?: { id: number | string; name: string };
  lease?: {
    id: number | string;
    start_date: string;
    end_date: string;
    monthly_rent_paise: string | number;
    security_deposit_paise: string | number;
    status: number | string;
  };
}

function leaseStatusLabel(status: number | string): string {
  if (typeof status === "number") {
    const name = leaseStatusName(status as LeaseStatusEnum);
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function leaseStatusBadgeClass(status: number | string): string {
  const isActive = status === LeaseStatusEnum.ACTIVE || status === "ACTIVE";
  return isActive ? "badge-paid" : "badge-open";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PmTenantDetailPage() {
  const { apiFetch } = useAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TenantUpdate>({
    resolver: zodResolver(TenantUpdateSchema),
  });

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setLoading(true);
      try {
        const res = await apiFetch<TenantDetail>(`/tenants/${id}`);
        if (!cancelled) {
          setTenant(res);
          // DOB from API is a full ISO timestamp; the input expects YYYY-MM-DD.
          const dobIso = res.dob ?? "";
          const dobDate = dobIso.length >= 10 ? dobIso.slice(0, 10) : "";
          reset({
            dob: dobDate || undefined,
            id_proof_type: res.id_proof_type ?? undefined,
            id_proof_number: res.id_proof_number ?? undefined,
            emergency_contact_name: res.emergency_contact_name ?? undefined,
            emergency_contact_phone: res.emergency_contact_phone ?? undefined,
          });
        }
      } catch {
        // 404 or network error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetch();
    return () => { cancelled = true; };
  }, [apiFetch, id, reset]);

  async function onSubmit(data: TenantUpdate) {
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await apiFetch<TenantDetail>(`/tenants/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      setTenant(updated);
      setSaveSuccess(true);
      setEditing(false);
    } catch (err) {
      setSaveError(friendlyError(err));
    }
  }

  const formatDate = (iso: string | null | undefined) => formatDateOnlyIST(iso);

  const formatRent = (paise: string | number | undefined) => {
    if (paise === undefined || paise === null) return "—";
    const val = typeof paise === "string" ? parseInt(paise, 10) : paise;
    return isNaN(val) ? "—" : formatINR(val);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate font-poppins">Loading…</div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="card">
        <p className="text-charcoal font-poppins">Tenant not found.</p>
        <button type="button" className="btn btn-secondary mt-4" onClick={() => router.back()}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">{tenant.name}</h1>
          <div className="page-subtitle">
            {tenant.unit?.name ? `Unit ${tenant.unit.name}` : ""}
          </div>
        </div>
        <button type="button" className="btn btn-secondary !py-2 !text-sm" onClick={() => router.back()}>
          ← Back
        </button>
      </header>

      {/* Personal info */}
      <section className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title m-0">Personal Information</h3>
          {!editing && (
            <button
              type="button"
              className="btn btn-secondary !py-1 !px-3 !text-sm"
              onClick={() => { setEditing(true); setSaveSuccess(false); setSaveError(null); }}
            >
              Edit
            </button>
          )}
        </div>

        {!editing ? (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div><span className="muted">Name:</span> <strong className="text-charcoal">{tenant.name}</strong></div>
            <div><span className="muted">Email:</span> <strong className="text-charcoal">{tenant.email}</strong></div>
            <div><span className="muted">Phone:</span> <strong className="text-charcoal">{tenant.phone ?? "—"}</strong></div>
            <div><span className="muted">Date of Birth:</span> <strong className="text-charcoal">{formatDate(tenant.dob)}</strong></div>
            <div><span className="muted">ID Proof Type:</span> <strong className="text-charcoal">{tenant.id_proof_type ?? "—"}</strong></div>
            <div><span className="muted">ID Proof Number:</span> <strong className="text-charcoal">{tenant.id_proof_number ?? "—"}</strong></div>
            <div><span className="muted">Emergency Contact:</span> <strong className="text-charcoal">{tenant.emergency_contact_name ?? "—"}</strong></div>
            <div><span className="muted">Emergency Phone:</span> <strong className="text-charcoal">{tenant.emergency_contact_phone ?? "—"}</strong></div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field id="dob" label="Date of Birth (YYYY-MM-DD)" error={errors.dob?.message}>
                <input className="input" type="text" placeholder="YYYY-MM-DD" {...register("dob")} />
              </Field>
              <Field id="id_proof_type" label="ID Proof Type" error={errors.id_proof_type?.message}>
                <input className="input" type="text" placeholder="Aadhaar, Passport…" {...register("id_proof_type")} />
              </Field>
              <Field id="id_proof_number" label="ID Proof Number" error={errors.id_proof_number?.message}>
                <input className="input" type="text" {...register("id_proof_number")} />
              </Field>
              <Field id="emergency_contact_name" label="Emergency Contact Name" error={errors.emergency_contact_name?.message}>
                <input className="input" type="text" {...register("emergency_contact_name")} />
              </Field>
              <Field id="emergency_contact_phone" label="Emergency Contact Phone" error={errors.emergency_contact_phone?.message}>
                <input className="input" type="text" placeholder="9876543210" {...register("emergency_contact_phone")} />
              </Field>
            </div>
            {saveError && (
              <div className="field-error show mt-3">{saveError}</div>
            )}
            <div className="flex gap-3 mt-4">
              <button
                type="submit"
                className="btn btn-primary !py-2 !text-sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                className="btn btn-secondary !py-2 !text-sm"
                onClick={() => { setEditing(false); setSaveError(null); }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {saveSuccess && (
          <div className="text-sm mt-2" style={{ color: "var(--color-status-paid)" }}>
            Changes saved successfully.
          </div>
        )}
      </section>

      {/* Current lease summary */}
      {tenant.lease && (
        <section className="card">
          <h3 className="section-title">Current Lease</h3>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div><span className="muted">Unit:</span> <strong className="text-charcoal">{tenant.unit?.name ?? "—"}</strong></div>
            <div><span className="muted">Status:</span> <span className={`badge ${leaseStatusBadgeClass(tenant.lease.status)} ml-1`}>{leaseStatusLabel(tenant.lease.status)}</span></div>
            <div><span className="muted">Start:</span> <strong className="text-charcoal">{formatDate(tenant.lease.start_date)}</strong></div>
            <div><span className="muted">End:</span> <strong className="text-charcoal">{formatDate(tenant.lease.end_date)}</strong></div>
            <div><span className="muted">Monthly Rent:</span> <strong className="text-charcoal">{formatRent(tenant.lease.monthly_rent_paise)}</strong></div>
            <div><span className="muted">Security Deposit:</span> <strong className="text-charcoal">{formatRent(tenant.lease.security_deposit_paise)}</strong></div>
          </div>
          <div className="mt-4">
            <Link
              href={`/pm/leases/${tenant.lease.id}`}
              className="btn btn-secondary !py-2 !text-sm"
            >
              View Lease Details →
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
