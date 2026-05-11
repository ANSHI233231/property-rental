"use client";

/**
 * Property Manager Profile — Phase 6 (refactored: unified two-card layout).
 *
 * Left card — "Account": Name / Email / Phone (editable) / Role / Member since
 * Right card — "Security" (ProfileSecurityCard): Change pwd / Sign out everywhere / Sign out
 */

import { useAuth } from "@/lib/auth/context";
import { useEffect, useState, useCallback } from "react";
import { formatDateOnlyIST } from "@/lib/locale";
import { ProfileSecurityCard } from "@/components/profile/ProfileSecurityCard";
import { EditDetailsModal } from "@/components/profile/EditDetailsModal";
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatDateOnlyIST(iso ?? undefined);
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
// Page
// ---------------------------------------------------------------------------

export default function PmProfilePage() {
  const { user, apiFetch } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
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
      </>
    );
  }

  const memberSince = profile?.createdAt ?? profile?.created_at;
  const avatarBg = "#1565C0"; // Royal blue for PM

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
            <span className="profile-role">Property Manager</span>
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
                  <Field id="pm-phone" label="" error={profileErrors.phone?.message}>
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
            <span className="value">Property Manager</span>
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
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Right card — Security (shared component)                            */}
        {/* ------------------------------------------------------------------ */}
        <ProfileSecurityCard />
      </div>

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
