"use client";

/**
 * Maintenance Staff Profile — Phase 6 (refactored: unified two-card layout).
 * 1:1 with prototype/maintenance/profile.html.
 *
 * Left card — "Account":
 *   Name / Email / Phone (editable) / Role / Permissions / Member since / Status
 *   Footer hint: role scope copy.
 *
 * Right card — "Security" (ProfileSecurityCard):
 *   Change password (modal) / Sign out everywhere (disabled-BE) / Sign out
 *
 * Work stats KPI grid below cards.
 *
 * BL-16: no rent/lease data, no financial data shown here.
 */

import { useAuth } from "@/lib/auth/context";
import { useEffect, useState, useCallback } from "react";
import { differenceInHours, parseISO, startOfMonth } from "date-fns";
import { formatDateOnlyIST } from "@/lib/locale";
import { ProfileSecurityCard } from "@/components/profile/ProfileSecurityCard";
import { EditDetailsModal } from "@/components/profile/EditDetailsModal";
import { SkeletonCard, SkeletonKpi } from "@/components/ui/Skeleton";
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

interface MaintenanceRequest {
  id: string;
  status: string;
  priority: string;
  assigned_at?: string | null;
  in_progress_at?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

interface MaintenanceListResponse {
  data?: MaintenanceRequest[];
  items?: MaintenanceRequest[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  return formatDateOnlyIST(iso);
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Work stats computation
// ---------------------------------------------------------------------------

interface WorkStats {
  totalAssigned: number;
  activeCount: number;
  resolvedThisMonth: number;
  avgResolutionHours: number | null;
}

function computeWorkStats(requests: MaintenanceRequest[]): WorkStats {
  const now = new Date();
  const monthStart = startOfMonth(now);

  const totalAssigned = requests.length;

  const activeCount = requests.filter((r) =>
    ["ASSIGNED", "IN_PROGRESS"].includes(r.status),
  ).length;

  const resolvedThisMonth = requests.filter((r) => {
    if (r.status !== "RESOLVED" && r.status !== "CLOSED") return false;
    if (!r.resolved_at) return false;
    try {
      return parseISO(r.resolved_at) >= monthStart;
    } catch {
      return false;
    }
  }).length;

  const resolvedWithTimes = requests.filter(
    (r) =>
      (r.status === "RESOLVED" || r.status === "CLOSED") &&
      r.assigned_at &&
      r.resolved_at,
  );

  let avgResolutionHours: number | null = null;
  if (resolvedWithTimes.length > 0) {
    const totalHours = resolvedWithTimes.reduce((sum, r) => {
      try {
        const start = parseISO(r.assigned_at!);
        const end = parseISO(r.resolved_at!);
        return sum + Math.max(0, differenceInHours(end, start));
      } catch {
        return sum;
      }
    }, 0);
    avgResolutionHours =
      Math.round((totalHours / resolvedWithTimes.length) * 10) / 10;
  }

  return { totalAssigned, activeCount, resolvedThisMonth, avgResolutionHours };
}

function formatAvgResolution(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 24) return `${hours}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MaintenanceProfilePage() {
  const { user, apiFetch } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workStats, setWorkStats] = useState<WorkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPhone, setEditingPhone] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);

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

      try {
        const res = await apiFetch<MaintenanceListResponse>(
          `/maintenance-requests?assignedToUserId=${me.id}&limit=100`,
        );
        const items =
          res.data ??
          res.items ??
          (Array.isArray(res) ? (res as MaintenanceRequest[]) : []);
        setWorkStats(computeWorkStats(items));
      } catch {
        setWorkStats({
          totalAssigned: 0,
          activeCount: 0,
          resolvedThisMonth: 0,
          avgResolutionHours: null,
        });
      }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
        <section className="section mt-8">
          <div className="kpi-grid">
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </div>
        </section>
      </>
    );
  }

  const memberSince = profile?.createdAt ?? profile?.created_at;
  const avatarBg = "#546E7A"; // Slate for maintenance per prototype

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
            {profile?.name
              ? initials(profile.name)
              : user?.name
                ? initials(user.name)
                : "—"}
          </span>
        </div>
      </header>

      <div className="profile-grid">
        {/* ------------------------------------------------------------------ */}
        {/* Left card — Account                                                  */}
        {/* ------------------------------------------------------------------ */}
        <section className="profile-card">
          {/* Avatar + name + role badge */}
          <div className="profile-header">
            <div
              className="profile-avatar-lg"
              style={{ background: avatarBg }}
              aria-hidden="true"
            >
              {profile?.name ? initials(profile.name) : "—"}
            </div>
            <div className="profile-name">{profile?.name ?? "—"}</div>
            <span className="profile-role">Maintenance Staff</span>
          </div>

          {/* Rows */}
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
                <form
                  onSubmit={(e) =>
                    void handleProfileSubmit(handlePhoneSubmit)(e)
                  }
                  className="flex flex-col gap-1 w-full"
                  noValidate
                >
                  <Field id="maint-phone" label="" error={profileErrors.phone?.message}>
                    <input
                      type="tel"
                      className="input"
                      placeholder="10-digit mobile"
                      {...registerProfile("phone")}
                    />
                  </Field>
                  {profileSaveError && (
                    <div className="field-error show" role="alert">
                      {profileSaveError}
                    </div>
                  )}
                  <div className="flex gap-2 mt-1">
                    <button
                      type="submit"
                      className="btn btn-primary !py-1 !text-xs"
                      disabled={isProfileSubmitting}
                      aria-busy={isProfileSubmitting}
                    >
                      {isProfileSubmitting ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary !py-1 !text-xs"
                      onClick={() => setEditingPhone(false)}
                    >
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
          <div className="profile-row">
            <span className="field">Role</span>
            <span className="value">Maintenance Staff</span>
          </div>
          <div className="profile-row">
            <span className="field">Permissions</span>
            <span className="value">Read &amp; update only</span>
          </div>
          <div className="profile-row">
            <span className="field">Member since</span>
            <span className="value">{formatDate(memberSince)}</span>
          </div>
          <div className="profile-row">
            <span className="field">Account status</span>
            <span className="value">
              <span className="badge badge-active" aria-label="Active">
                Active
              </span>
            </span>
          </div>

          {profileSaveSuccess && (
            <p
              className="text-xs mt-3"
              style={{ color: "var(--color-status-paid)" }}
              role="status"
            >
              Profile updated successfully.
            </p>
          )}

          {/* Edit details button — opens modal */}
          <button
            type="button"
            className="btn btn-secondary w-full mt-5"
            onClick={() => setEditDetailsOpen(true)}
            aria-label="Edit account details"
          >
            Edit details
          </button>

          {/* Role-appropriate footer copy */}
          <p className="text-xs muted mt-3">
            You can read and update existing maintenance requests. You cannot
            create new requests, see rent / lease information, or view tenant
            financial data.
          </p>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Right card — Security (shared component)                            */}
        {/* ------------------------------------------------------------------ */}
        <ProfileSecurityCard />
      </div>

      {/* Work stats — v1 note: computed from last 100 assignments */}
      <section className="section mt-8" aria-labelledby="work-stats-heading">
        <h3 className="section-title" id="work-stats-heading">
          Your Work
        </h3>
        {workStats ? (
          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-label">Active assignments</div>
              <div className="kpi-value">{workStats.activeCount}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Resolved this month</div>
              <div
                className="kpi-value"
                style={{ color: "var(--color-status-paid)" }}
              >
                {workStats.resolvedThisMonth}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Avg. resolution time</div>
              <div className="kpi-value">
                {formatAvgResolution(workStats.avgResolutionHours)}
              </div>
              <div className="kpi-meta">
                From last {workStats.totalAssigned} assignments
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Total assigned</div>
              <div className="kpi-value">{workStats.totalAssigned}</div>
              <div className="kpi-meta">Last 100 shown</div>
            </div>
          </div>
        ) : (
          <div className="kpi-grid">
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </div>
        )}
      </section>

      <EditDetailsModal
        open={editDetailsOpen}
        onClose={() => setEditDetailsOpen(false)}
        profile={profile ? { name: profile.name, email: profile.email, phone: profile.phone ?? null } : null}
        onSuccess={(u) => {
          setProfile((prev) => (prev ? { ...prev, name: u.name, phone: u.phone } : prev));
          setProfileSaveSuccess(true);
        }}
      />
    </>
  );
}
