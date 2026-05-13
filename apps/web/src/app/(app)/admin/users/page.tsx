"use client";

/**
 * Admin Users list — Phase 2.
 * Matches prototype/admin/users.html 1:1.
 * Columns: Name, Role, Scope, Phone, Status, Edit action.
 * Role filter tabs, row-level activate/deactivate.
 * "Add User" → modal. Temp-password displayed once.
 */

import { useAuth } from "@/lib/auth/context";
import { useCallback, useEffect, useState } from "react";
import { Pagination } from "@/components/ui/Pagination";
import { usePaginatedList } from "@/lib/pagination/usePaginatedList";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  UserCreateSchema,
  UserAdminUpdateSchema,
  AdminResetPasswordSchema,
  type UserCreateInput,
  type UserAdminUpdateInput,
  type AdminResetPasswordInput,
  type AdminRoleValue,
  RoleEnum,
  roleName,
} from "@gharsetu/shared";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { friendlyError } from "@/lib/api/errors";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { useRefetchOnFocus } from "@/lib/hooks/use-refetch-on-focus";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateOnlyIST } from "@/lib/locale";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserRow {
  id: number | string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  specialization?: string | null;
  email: string;
  phone?: string | null;
  // API returns role as SMALLINT (0–3) after Step 1 migration; accept string for legacy
  role: RoleEnum | AdminRoleValue;
  is_active: boolean;
  created_at?: string;
}

interface UsersResponse {
  data: UserRow[];
  meta?: { total?: number; hasMore?: boolean; cursor?: string };
  hasMore?: boolean;
  total?: number;
}

interface CreateUserResponse {
  user: UserRow;
  temporaryPassword?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roleLabel(role: RoleEnum | AdminRoleValue): string {
  if (typeof role === "number") {
    return roleName(role);
  }
  // Legacy string fallback
  switch (role as AdminRoleValue) {
    case "ADMIN": return "Admin";
    case "PROPERTY_MANAGER": return "Property Manager";
    case "MAINTENANCE": return "Maintenance";
    case "TENANT": return "Tenant";
    default: return String(role);
  }
}

function scopeLabel(user: UserRow): string {
  const r = user.role;
  const isAdmin = r === RoleEnum.ADMIN || r === "ADMIN";
  const isMaintenance = r === RoleEnum.MAINTENANCE || r === "MAINTENANCE";
  if (isAdmin) return "All properties";
  if (isMaintenance) return "Read + Update only";
  return "—";
}

function formatDate(iso?: string): string {
  return formatDateOnlyIST(iso);
}

// ---------------------------------------------------------------------------
// Temporary Password Modal (one-time display)
// ---------------------------------------------------------------------------

function TempPasswordModal({
  open,
  password,
  userName,
  onClose,
}: {
  open: boolean;
  password: string;
  userName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Account Created">
      <div className="mt-3 space-y-4">
        <div className="alert">
          <div>
            <strong className="font-poppins">This password is shown only once.</strong>{" "}
            Copy it now and share it securely with {userName}.
          </div>
        </div>
        <div>
          <label className="label">Temporary password</label>
          <div className="flex gap-2 mt-1">
            <input
              readOnly
              value={password}
              className="input font-mono flex-1"
              aria-label="Temporary password"
            />
            <button
              type="button"
              className="btn btn-secondary !py-2 !text-sm"
              onClick={handleCopy}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Add User Modal
// ---------------------------------------------------------------------------

function AddUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (user: UserRow, tempPassword?: string | null) => void;
}) {
  const { apiFetch } = useAuth();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserCreateInput>({
    resolver: zodResolver(UserCreateSchema),
    defaultValues: { role: "PROPERTY_MANAGER" },
  });

  const selectedRole = watch("role");

  function handleClose() {
    reset();
    setServerError("");
    onClose();
  }

  async function onSubmit(data: UserCreateInput) {
    setServerError("");
    try {
      const res = await apiFetch<CreateUserResponse>("/users", {
        method: "POST",
        body: JSON.stringify(data),
      });
      reset();
      onCreated(res.user, res.temporaryPassword);
      onClose();
    } catch (err) {
      setServerError(friendlyError(err));
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add New User">
      <p className="muted text-sm mt-1 mb-4">
        Tenants are normally created at lease signing — only add tenants here for manual
        onboarding.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label className="label" htmlFor="user-role">
            Role
          </label>
          <select
            id="user-role"
            className={`input${errors.role ? " error" : ""}`}
            {...register("role")}
          >
            <option value="PROPERTY_MANAGER">Property Manager</option>
            <option value="MAINTENANCE">Maintenance Staff</option>
            <option value="ADMIN">Admin</option>
            <option value="TENANT">Tenant</option>
          </select>
          {errors.role && (
            <div className="field-error show" role="alert">
              {errors.role.message}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field id="user-first-name" label="First name" error={errors.firstName?.message}>
            <input
              className="input"
              placeholder="e.g. Anil"
              {...register("firstName")}
            />
          </Field>
          <Field id="user-last-name" label="Last name" error={errors.lastName?.message}>
            <input
              className="input"
              placeholder="e.g. Kapoor"
              {...register("lastName")}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field id="user-phone" label="Phone" error={errors.phone?.message}>
            <input
              className="input"
              placeholder="98xxxxxxxx"
              maxLength={10}
              {...register("phone")}
            />
          </Field>
          <Field id="user-email" label="Email" error={errors.email?.message}>
            <input
              type="email"
              className="input"
              placeholder="name@gharsetu.in"
              {...register("email")}
            />
          </Field>
        </div>

        <div>
          <Field id="user-password" label="Initial password" error={errors.password?.message}>
            <input
              type="password"
              className="input"
              placeholder="At least 10 characters, with a letter and a digit"
              autoComplete="new-password"
              {...register("password")}
            />
          </Field>
          <p className="text-xs muted mt-1">
            Share this password with the new user privately. They can change it after first login.
          </p>
        </div>

        {selectedRole === "MAINTENANCE" && (
          <Field
            id="user-specialization"
            label="Specialization"
            error={errors.specialization?.message}
          >
            <select
              className={`input${errors.specialization ? " error" : ""}`}
              {...register("specialization")}
              defaultValue=""
            >
              <option value="" disabled>Select a specialization</option>
              <option value="Plumber">Plumber</option>
              <option value="Electrician">Electrician</option>
              <option value="Carpenter">Carpenter</option>
              <option value="Painter">Painter</option>
              <option value="General">General</option>
            </select>
          </Field>
        )}

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
            {isSubmitting ? "Creating…" : "Create Account"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Edit User Modal
// ---------------------------------------------------------------------------

function EditUserModal({
  open,
  onClose,
  user,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  user: UserRow | null;
  onUpdated: () => void;
}) {
  const { apiFetch } = useAuth();
  const { toast } = useToast();
  const [serverError, setServerError] = useState("");
  const [pwServerError, setPwServerError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserAdminUpdateInput>({
    resolver: zodResolver(UserAdminUpdateSchema),
  });

  // Independent sub-form for the Reset Password section — separate endpoint
  // (PATCH /users/:id/reset-password) and a separate audit entry, so we keep
  // it isolated from the profile-update form.
  const {
    register: registerPw,
    handleSubmit: handleSubmitPw,
    reset: resetPw,
    formState: { errors: pwErrors, isSubmitting: pwSubmitting },
  } = useForm<AdminResetPasswordInput>({
    resolver: zodResolver(AdminResetPasswordSchema),
    defaultValues: { newPassword: "" },
  });

  useEffect(() => {
    if (user) {
      reset({
        firstName: user.first_name ?? undefined,
        lastName: user.last_name ?? undefined,
        phone: user.phone ?? undefined,
        email: user.email,
      });
      resetPw({ newPassword: "" });
      setPwServerError("");
    }
  }, [user, reset, resetPw]);

  function handleClose() {
    reset();
    resetPw({ newPassword: "" });
    setServerError("");
    setPwServerError("");
    onClose();
  }

  async function onSubmit(data: UserAdminUpdateInput) {
    if (!user) return;
    setServerError("");
    try {
      await apiFetch(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      toast("User updated.", "success");
      onUpdated();
      onClose();
    } catch (err) {
      setServerError(friendlyError(err));
    }
  }

  async function onResetPassword(data: AdminResetPasswordInput) {
    if (!user) return;
    setPwServerError("");
    try {
      await apiFetch(`/users/${user.id}/reset-password`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      toast(`Password reset for ${user.name}. Share it with them privately.`, "success");
      resetPw({ newPassword: "" });
    } catch (err) {
      setPwServerError(friendlyError(err));
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={`Edit — ${user?.name ?? ""}`}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field id="edit-first-name" label="First name" error={errors.firstName?.message}>
            <input className="input" {...register("firstName")} />
          </Field>
          <Field id="edit-last-name" label="Last name" error={errors.lastName?.message}>
            <input className="input" {...register("lastName")} />
          </Field>
        </div>

        <Field id="edit-phone" label="Phone" error={errors.phone?.message}>
          <input className="input" placeholder="98xxxxxxxx" maxLength={10} {...register("phone")} />
        </Field>

        <Field id="edit-email" label="Email" error={errors.email?.message}>
          <input
            type="email"
            className="input"
            placeholder="name@example.com"
            autoComplete="email"
            {...register("email")}
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
            {isSubmitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <hr className="my-6 border-mid-gray" />

      <form onSubmit={handleSubmitPw(onResetPassword)} noValidate className="space-y-3">
        <div>
          <h3 className="font-poppins font-semibold text-charcoal text-sm">Reset Password</h3>
          <p className="text-xs muted mt-1">
            Sets a new password for this user. They can log in with it immediately. Share it
            with them privately — no email is sent.
          </p>
        </div>

        <Field
          id="edit-new-password"
          label="New password"
          error={pwErrors.newPassword?.message}
        >
          <input
            type="password"
            className="input"
            placeholder="At least 10 characters, with a letter and a digit"
            autoComplete="new-password"
            {...registerPw("newPassword")}
          />
        </Field>

        {pwServerError && (
          <div className="field-error show" role="alert">
            {pwServerError}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="btn btn-secondary !py-2 !text-sm"
            disabled={pwSubmitting}
          >
            {pwSubmitting ? "Resetting…" : "Reset Password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Role filter tabs
// ---------------------------------------------------------------------------

const ROLE_FILTERS: Array<{ label: string; value: AdminRoleValue | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Admins", value: "ADMIN" },
  { label: "Property Managers", value: "PROPERTY_MANAGER" },
  { label: "Maintenance", value: "MAINTENANCE" },
  { label: "Tenants", value: "TENANT" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  const [roleFilter, setRoleFilter] = useState<AdminRoleValue | "ALL">("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [tempPw, setTempPw] = useState<{ user: UserRow; password: string } | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  const extraQuery: Record<string, string | undefined> = {};
  if (roleFilter !== "ALL") extraQuery.role = roleFilter;

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
    refresh,
  } = usePaginatedList<UserRow>({
    url: "/users",
    extraQuery,
    pageSize: 10,
    refetchKey,
  });

  // Refetch when the tab regains focus (cross-role name-change sync).
  useRefetchOnFocus(() => { refresh(); });

  async function handleToggleActive(user: UserRow) {
    const endpoint = user.is_active
      ? `/users/${user.id}/deactivate`
      : `/users/${user.id}/activate`;

    try {
      await apiFetch(endpoint, { method: "POST" });
      toast(
        user.is_active
          ? `${user.name} deactivated.`
          : `${user.name} activated.`,
        "success",
      );
      setRefetchKey((k) => k + 1);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  }

  function handleCreated(user: UserRow, tempPassword?: string | null) {
    if (tempPassword) {
      setTempPw({ user, password: tempPassword });
    } else {
      toast("User created successfully.", "success");
    }
    setRefetchKey((k) => k + 1);
  }

  // Keep useCallback for handleRefresh since useRefetchOnFocus needs it
  const handleRefresh = useCallback(() => {
    setRefetchKey((k) => k + 1);
  }, []);

  return (
    <>
      {/* Page header */}
      <header className="topbar">
        <div>
          <h1 className="page-title">Users</h1>
          <div className="page-subtitle">
            Manage Admin · PM · Maintenance · Tenant accounts
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary !py-2 !text-sm"
          onClick={() => setAddOpen(true)}
        >
          + Add User
        </button>
      </header>

      {/* Role filter tabs */}
      <section className="section">
        <div className="flex gap-2 flex-wrap">
          {ROLE_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              className={
                roleFilter === value
                  ? "btn btn-primary !py-2 !text-sm"
                  : "btn btn-secondary !py-2 !text-sm"
              }
              onClick={() => setRoleFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Users table */}
      <section className="card p-0 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Scope</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows rows={5} cols={7} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-0">
                  <EmptyState
                    heading="No users found."
                    body="Try a different role filter or add a new user."
                    cta={
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setAddOpen(true)}
                      >
                        + Add User
                      </button>
                    }
                  />
                </td>
              </tr>
            ) : (
              rows.map((user) => (
                <tr key={user.id}>
                  <td className="font-poppins font-semibold text-charcoal">{user.name}</td>
                  <td>{roleLabel(user.role)}</td>
                  <td className="muted">{scopeLabel(user)}</td>
                  <td>{user.phone ?? "—"}</td>
                  <td>
                    <span
                      className={
                        user.is_active ? "badge badge-active" : "badge badge-closed"
                      }
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="text-sm muted">{formatDate(user.created_at)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-royal-blue font-poppins font-semibold text-sm hover:underline"
                        onClick={() => setEditUser(user)}
                      >
                        Edit
                      </button>
                      <span className="text-mid-gray">·</span>
                      <button
                        type="button"
                        className={
                          user.is_active
                            ? "text-status-overdue font-poppins font-semibold text-sm hover:underline"
                            : "text-status-paid font-poppins font-semibold text-sm hover:underline"
                        }
                        onClick={() => handleToggleActive(user)}
                      >
                        {user.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination footer */}
        {!loading && rows.length > 0 && (
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
      </section>

      <p className="text-sm muted mt-4">
        No public sign-up. Tenants are auto-created at lease signing. Co-tenants get
        individual logins linked to the same lease.
      </p>

      {/* Modals */}
      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={handleCreated}
      />

      <EditUserModal
        open={editUser !== null}
        onClose={() => setEditUser(null)}
        user={editUser}
        onUpdated={handleRefresh}
      />

      {tempPw && (
        <TempPasswordModal
          open={true}
          password={tempPw.password}
          userName={tempPw.user.name}
          onClose={() => {
            setTempPw(null);
            toast("User created successfully.", "success");
          }}
        />
      )}
    </>
  );
}
