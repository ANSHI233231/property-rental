"use client";

/**
 * Tenant Profile — Phase 6.
 * 1:1 with prototype/tenant/profile.html.
 *
 * Sections:
 *   - Account: name, email (read-only), phone (editable), member-since (DD/MM/YYYY).
 *   - Lease quick-view: unit address, lease period, rent (formatINR).
 *   - Security / Password change (POST /users/me/change-password).
 *   - No "Active sessions" / "Sign out everywhere" UI (SRS §11.3).
 * 2FA: hidden per prototype.
 */

import { useAuth } from "@/lib/auth/context";
import { useEffect, useState, useCallback } from "react";
import { formatDateOnlyIST } from "@/lib/locale";
import { formatINR } from "@gharsetu/shared";
import { PasswordChangeForm } from "@/components/ui/PasswordChangeForm";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Field } from "@/components/ui/Field";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateProfileInputSchema } from "@gharsetu/shared";
import type { UpdateProfileInput } from "@gharsetu/shared";
import { friendlyError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  createdAt?: string | null;
  created_at?: string | null;
}

interface LeaseInfo {
  id: string;
  start_date: string;
  end_date: string;
  monthly_rent_paise: string | number;
  security_deposit_paise: string | number;
  unit?: { name?: string };
  property?: { name?: string; address?: string };
  tenants?: { id: string; name: string; email: string; is_primary: boolean }[];
}

interface LeasesResponse {
  data?: LeaseInfo[];
  items?: LeaseInfo[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatDateOnlyIST(iso ?? undefined);
}

function formatPaise(paise: string | number | null | undefined): string {
  if (paise === null || paise === undefined) return "—";
  const val = typeof paise === "string" ? parseInt(paise, 10) : paise;
  return isNaN(val) ? "—" : formatINR(val);
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TenantProfilePage() {
  const { user, apiFetch } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [lease, setLease] = useState<LeaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPhone, setEditingPhone] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isSubmitting: isProfileSubmitting },
    reset: resetProfile,
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileInputSchema),
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const me = await apiFetch<UserProfile>("/users/me");
      setProfile(me);

      // Fetch active lease for quick-view
      try {
        const leasesRes = await apiFetch<LeasesResponse>(`/leases?tenantId=${me.id}&status=ACTIVE&limit=1`);
        const leases = leasesRes.data ?? leasesRes.items ?? [];
        setLease(leases[0] ?? null);
      } catch {
        setLease(null);
      }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function handlePasswordChange(currentPassword: string, newPassword: string) {
    await apiFetch("/users/me/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async function handlePhoneSubmit(data: UpdateProfileInput) {
    setProfileSaveError(null);
    setProfileSaveSuccess(false);
    try {
      const updated = await apiFetch<UserProfile>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      setProfile(updated);
      setProfileSaveSuccess(true);
      setEditingPhone(false);
    } catch (err) {
      setProfileSaveError(friendlyError(err));
    }
  }

  function startEditPhone() {
    resetProfile({ phone: profile?.phone ?? "" });
    setProfileSaveError(null);
    setProfileSaveSuccess(false);
    setEditingPhone(true);
  }

  if (loading) {
    return (
      <>
        <header className="topbar">
          <div>
            <h1 className="page-title">My Profile</h1>
            <div className="page-subtitle">Account and security</div>
          </div>
        </header>
        <div className="profile-grid">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </>
    );
  }

  const memberSince = profile?.createdAt ?? profile?.created_at;
  const avatarBg = "#FF6F00"; // Saffron for tenant per prototype

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">My Profile</h1>
          <div className="page-subtitle">Account and security</div>
        </div>
        <div className="topbar-user">
          <span className="hidden md:inline">{profile?.name ?? user?.name}</span>
          <span className="avatar" aria-hidden="true">
            {profile?.name ? initials(profile.name) : (user?.name ? initials(user.name) : "—")}
          </span>
        </div>
      </header>

      <div className="profile-grid">
        {/* Account card */}
        <section className="profile-card" aria-labelledby="account-heading">
          <div className="profile-header">
            <div className="profile-avatar-lg" style={{ background: avatarBg }} aria-hidden="true">
              {profile?.name ? initials(profile.name) : "—"}
            </div>
            <div className="profile-name">{profile?.name ?? "—"}</div>
            <span className="profile-role">Tenant</span>
          </div>

          <h3 id="account-heading">Account</h3>
          <div className="profile-row">
            <span className="field">Name</span>
            <span className="value">{profile?.name ?? "—"}</span>
          </div>
          <div className="profile-row">
            <span className="field">Email</span>
            <span className="value">{profile?.email ?? user?.email ?? "—"}</span>
          </div>
          <div className="profile-row">
            <span className="field">Phone</span>
            <span className="value">
              {editingPhone ? (
                <form onSubmit={(e) => void handleProfileSubmit(handlePhoneSubmit)(e)} className="flex flex-col gap-1" noValidate>
                  <Field id="phone" label="" error={profileErrors.phone?.message}>
                    <input
                      type="tel"
                      className="input"
                      placeholder="10-digit mobile"
                      {...registerProfile("phone")}
                    />
                  </Field>
                  {profileSaveError && (
                    <div className="field-error show" role="alert">{profileSaveError}</div>
                  )}
                  <div className="flex gap-2 mt-1">
                    <button type="submit" className="btn btn-primary !py-1 !text-xs" disabled={isProfileSubmitting} aria-busy={isProfileSubmitting}>
                      {isProfileSubmitting ? "Saving…" : "Save"}
                    </button>
                    <button type="button" className="btn btn-secondary !py-1 !text-xs" onClick={() => setEditingPhone(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {profile?.phone ? `+91 ${profile.phone}` : "Not set"}
                  <button
                    type="button"
                    onClick={startEditPhone}
                    className="ml-2 text-xs text-saffron hover:underline focus-visible:outline-none"
                    aria-label="Edit phone number"
                  >
                    Edit
                  </button>
                </>
              )}
            </span>
          </div>
          {lease && (
            <>
              <div className="profile-row">
                <span className="field">Unit</span>
                <span className="value">
                  {lease.unit?.name ? `${lease.unit.name}` : "—"}
                  {lease.property?.name ? ` · ${lease.property.name}` : ""}
                  {lease.property?.address ? `, ${lease.property.address}` : ""}
                </span>
              </div>
              {lease.tenants && lease.tenants.filter((t) => t.email !== (profile?.email ?? user?.email)).map((t) => (
                <div key={t.id} className="profile-row">
                  <span className="field">Co-tenant</span>
                  <span className="value">{t.name}</span>
                </div>
              ))}
            </>
          )}
          <div className="profile-row">
            <span className="field">Member since</span>
            <span className="value">{formatDate(memberSince)}</span>
          </div>
          <div className="profile-row">
            <span className="field">Account status</span>
            <span className="value">
              <span className="badge badge-active" aria-label="Active">Active</span>
            </span>
          </div>

          {profileSaveSuccess && (
            <p className="text-xs mt-3" style={{ color: "var(--color-status-paid)" }} role="status">
              Profile updated successfully.
            </p>
          )}

          <p className="text-xs muted mt-3">
            Unit, lease and co-tenant details are managed by your Property Manager.
          </p>
        </section>

        {/* Security card */}
        <section className="profile-card" aria-labelledby="security-heading">
          <h3 id="security-heading">Security</h3>
          <PasswordChangeForm onSubmit={handlePasswordChange} />
        </section>
      </div>

      {/* Lease quick-view */}
      {lease && (
        <section className="section mt-8" aria-labelledby="lease-quickview-heading">
          <h3 className="section-title" id="lease-quickview-heading">My Lease — Quick view</h3>
          <div className="card">
            <div className="grid sm:grid-cols-4 gap-6">
              <div>
                <div className="text-xs muted font-poppins font-semibold uppercase tracking-wider">Lease starts</div>
                <div className="font-poppins font-semibold text-charcoal text-lg mt-1">{formatDate(lease.start_date)}</div>
              </div>
              <div>
                <div className="text-xs muted font-poppins font-semibold uppercase tracking-wider">Lease ends</div>
                <div className="font-poppins font-semibold text-charcoal text-lg mt-1">{formatDate(lease.end_date)}</div>
              </div>
              <div>
                <div className="text-xs muted font-poppins font-semibold uppercase tracking-wider">Monthly rent</div>
                <div className="font-poppins font-semibold text-charcoal text-lg mt-1">{formatPaise(lease.monthly_rent_paise)}</div>
              </div>
              <div>
                <div className="text-xs muted font-poppins font-semibold uppercase tracking-wider">Security deposit</div>
                <div className="font-poppins font-semibold text-charcoal text-lg mt-1">{formatPaise(lease.security_deposit_paise)}</div>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
