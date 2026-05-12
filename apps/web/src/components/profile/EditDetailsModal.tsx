"use client";

/**
 * EditDetailsModal — reusable across all 4 role profile pages.
 *
 * Wired to PATCH /users/me, which accepts (UpdateProfileDto):
 *   - name?: string ≤ 200 chars
 *   - phone?: string matching /^[6-9]\d{9}$/ (10-digit Indian mobile)
 *
 * Pre-fills from the profile prop. On submit, only sends fields that changed.
 * Calls onSuccess(updatedProfile) so the parent page can refresh its view
 * without an additional GET round-trip.
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";

const ModalSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  email: z.string().trim().email("Must be a valid email address").max(254),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^[6-9]\d{9}$/.test(v),
      "Must be a valid 10-digit Indian mobile number (starts with 6–9)",
    ),
});

type ModalValues = z.infer<typeof ModalSchema>;

export interface ProfileShape {
  id?: number | string;
  name: string;
  email: string;
  phone: string | null;
}

interface EditDetailsModalProps {
  open: boolean;
  onClose: () => void;
  /** Current profile values used to prefill the form. */
  profile: ProfileShape | null;
  /** Called with the server's response after a successful update. */
  onSuccess: (updated: { name: string; email: string; phone: string | null }) => void;
  /**
   * When true, the email field is editable and changes are sent via
   * PATCH /users/:id (admin endpoint). Defaults to false — non-admin
   * profile pages can't change their own email through this modal.
   */
  allowEmailEdit?: boolean;
}

export function EditDetailsModal({
  open,
  onClose,
  profile,
  onSuccess,
  allowEmailEdit = false,
}: EditDetailsModalProps) {
  const { apiFetch } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ModalValues>({
    resolver: zodResolver(ModalSchema),
    mode: "onBlur",
    defaultValues: { name: "", email: "", phone: "" },
  });

  // Re-seed the form when the modal opens or profile changes.
  useEffect(() => {
    if (open) {
      reset({
        name: profile?.name ?? "",
        email: profile?.email ?? "",
        phone: profile?.phone ?? "",
      });
    }
  }, [open, profile, reset]);

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(data: ModalValues) {
    // Diff against the current profile so we don't clobber server values.
    const payload: { name?: string; phone?: string | null; email?: string } = {};
    if (data.name !== (profile?.name ?? "")) payload.name = data.name;
    const normalisedPhone = data.phone === "" ? null : data.phone;
    if (normalisedPhone !== (profile?.phone ?? null)) payload.phone = normalisedPhone;

    const emailChanged =
      allowEmailEdit && data.email.toLowerCase() !== (profile?.email ?? "").toLowerCase();
    if (emailChanged) payload.email = data.email.toLowerCase();

    if (Object.keys(payload).length === 0) {
      handleClose();
      return;
    }

    // If email is changing, we must use the admin endpoint (PATCH /users/:id)
    // because /users/me's DTO does not accept email. The admin endpoint is
    // ADMIN-only — the page enables `allowEmailEdit` only for admin users.
    const useAdminEndpoint = emailChanged;
    const url = useAdminEndpoint && profile?.id ? `/users/${profile.id}` : "/users/me";

    try {
      const updated = await apiFetch<{ name: string; email: string; phone: string | null }>(
        url,
        { method: "PATCH", body: JSON.stringify(payload) },
      );
      onSuccess({ name: updated.name, email: updated.email, phone: updated.phone });
      handleClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const code = err.code ?? "";
        const msg = err.message ?? "Update failed";
        if (code === "EMAIL_TAKEN") setError("email", { message: msg });
        else if (/email/i.test(msg)) setError("email", { message: msg });
        else if (/phone/i.test(msg)) setError("phone", { message: msg });
        else setError("name", { message: msg });
      } else {
        setError("name", { message: "Failed to update. Please try again." });
      }
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Edit details" maxWidth="max-w-[480px]">
      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        noValidate
        className="mt-5 flex flex-col gap-4"
      >
        <Field id="ed-name" label="Name *" error={errors.name?.message}>
          <input
            type="text"
            className="input"
            autoComplete="name"
            placeholder="Your full name"
            {...register("name")}
          />
        </Field>

        {allowEmailEdit ? (
          <Field id="ed-email" label="Email *" error={errors.email?.message}>
            <input
              type="email"
              className="input"
              autoComplete="email"
              placeholder="name@example.com"
              {...register("email")}
            />
          </Field>
        ) : (
          <div>
            <label htmlFor="ed-email" className="field-label">
              Email
            </label>
            <input
              id="ed-email"
              type="email"
              className="input opacity-60 cursor-not-allowed"
              value={profile?.email ?? ""}
              disabled
              readOnly
              aria-describedby="ed-email-hint"
            />
            <p id="ed-email-hint" className="text-xs muted mt-1">
              Contact your admin to change your email.
            </p>
          </div>
        )}

        <Field id="ed-phone" label="Phone" error={errors.phone?.message}>
          <input
            type="tel"
            className="input"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit mobile (leave blank to remove)"
            maxLength={10}
            {...register("phone")}
          />
        </Field>

        <div className="flex gap-3 mt-2 justify-end">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
