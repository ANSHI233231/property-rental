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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  UserCreateSchema,
  UserAdminUpdateSchema,
  AdminRoleSchema,
  type UserCreateInput,
  type UserAdminUpdateInput,
  type AdminRoleValue,
} from "@gharsetu/shared";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { friendlyError } from "@/lib/api/errors";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateOnlyIST } from "@/lib/locale";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: AdminRoleValue;
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

function roleLabel(role: AdminRoleValue): string {
  switch (role) {
    case "ADMIN": return "Admin";
    case "PROPERTY_MANAGER": return "Property Manager";
    case "MAINTENANCE": return "Maintenance";
    case "TENANT": return "Tenant";
  }
}

function scopeLabel(user: UserRow): string {
  switch (user.role) {
    case "ADMIN": return "All properties";
    case "MAINTENANCE": return "Read + Update only";
    default: return "—";
  }
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
    formState: { errors, isSubmitting },
  } = useForm<UserCreateInput>({
    resolver: zodResolver(UserCreateSchema),
    defaultValues: { role: "PROPERTY_MANAGER" },
  });

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

        <Field id="user-name" label="Full name" error={errors.name?.message}>
          <input
            className="input"
            placeholder="e.g. Anil Kapoor"
            {...register("name")}
          />
        </Field>

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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserAdminUpdateInput>({
    resolver: zodResolver(UserAdminUpdateSchema),
  });

  useEffect(() => {
    if (user) {
      reset({ name: user.name, phone: user.phone ?? undefined });
    }
  }, [user, reset]);

  function handleClose() {
    reset();
    setServerError("");
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

  return (
    <Modal open={open} onClose={handleClose} title={`Edit — ${user?.name ?? ""}`}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
        <Field id="edit-name" label="Full name" error={errors.name?.message}>
          <input className="input" {...register("name")} />
        </Field>

        <Field id="edit-phone" label="Phone" error={errors.phone?.message}>
          <input className="input" placeholder="98xxxxxxxx" maxLength={10} {...register("phone")} />
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

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState<number | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [roleFilter, setRoleFilter] = useState<AdminRoleValue | "ALL">("ALL");

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [tempPw, setTempPw] = useState<{ user: UserRow; password: string } | null>(null);

  const fetchUsers = useCallback(
    async (role: AdminRoleValue | "ALL", nextCursor?: string) => {
      const params = new URLSearchParams({ limit: "20" });
      if (role !== "ALL") params.set("role", role);
      if (nextCursor) params.set("cursor", nextCursor);
      return apiFetch<UsersResponse>(`/users?${params.toString()}`);
    },
    [apiFetch],
  );

  // Initial / filter change load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRows([]);
    setCursor(undefined);

    fetchUsers(roleFilter)
      .then((res) => {
        if (cancelled) return;
        setRows(res.data ?? []);
        setTotal(res.meta?.total ?? res.total);
        setHasMore(res.meta?.hasMore ?? res.hasMore ?? false);
        setCursor(res.meta?.cursor);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roleFilter, fetchUsers]);

  async function handleLoadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetchUsers(roleFilter, cursor);
      setRows((prev) => [...prev, ...(res.data ?? [])]);
      setHasMore(res.meta?.hasMore ?? res.hasMore ?? false);
      setCursor(res.meta?.cursor);
    } catch {
      // swallow
    } finally {
      setLoadingMore(false);
    }
  }

  function handleRefresh() {
    setRows([]);
    setCursor(undefined);
    setLoading(true);
    fetchUsers(roleFilter)
      .then((res) => {
        setRows(res.data ?? []);
        setTotal(res.meta?.total ?? res.total);
        setHasMore(res.meta?.hasMore ?? res.hasMore ?? false);
        setCursor(res.meta?.cursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

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
      handleRefresh();
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
    handleRefresh();
  }

  const countLabel =
    total != null
      ? `Showing 1–${rows.length} of ${total}`
      : `${rows.length} users`;

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
          <div className="flex items-center justify-between p-4 border-t border-light-gray text-sm muted">
            <div>{countLabel}</div>
            {hasMore && (
              <button
                type="button"
                className="btn btn-secondary !py-1 !px-3 !text-sm"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
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
