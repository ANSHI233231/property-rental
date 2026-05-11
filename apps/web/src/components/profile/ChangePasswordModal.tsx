"use client";

/**
 * ChangePasswordModal — reusable across all 4 role profile pages.
 *
 * Visual contract (validation.js / Field component):
 *   - No browser tooltips; errors below field via .field-error.show + ⚠ glyph
 *   - Error clears on input (mode: "onChange"); re-validates on blur
 *   - aria-busy on submit button while submitting
 *
 * Error mapping:
 *   - INCORRECT_PASSWORD  → shown under "Current password" field
 *   - WEAK_PASSWORD       → shown under "New password" field
 *   - HTTP_429 / RATE_LIMIT_EXCEEDED → form-level error
 *
 * On success:
 *   - Modal closes
 *   - Parent callback fires (parent shows a toast / success message)
 *   - BE revokes all refresh tokens → user will be logged out on next API call;
 *     the success message must warn the user.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { ChangePasswordInputSchema } from "@gharsetu/shared";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";

// ---------------------------------------------------------------------------
// Schema — extend shared schema with confirmPassword
// ---------------------------------------------------------------------------

const ModalSchema = ChangePasswordInputSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ModalValues = z.infer<typeof ModalSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful password change. Use to show a toast / banner. */
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChangePasswordModal({ open, onClose, onSuccess }: ChangePasswordModalProps) {
  const { apiFetch } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ModalValues>({
    resolver: zodResolver(ModalSchema),
    mode: "onChange",
  });

  const [formError, setFormError] = useState<string | null>(null);

  function handleClose() {
    reset();
    setFormError(null);
    onClose();
  }

  async function onSubmit(data: ModalValues) {
    setFormError(null);
    try {
      await apiFetch("/users/me/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      reset();
      onClose();
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case "INCORRECT_PASSWORD":
            setError("currentPassword", {
              message: "Current password is incorrect",
            });
            break;
          case "WEAK_PASSWORD":
            setError("newPassword", {
              message: err.message ?? "Password does not meet requirements",
            });
            break;
          case "HTTP_429":
          case "RATE_LIMIT_EXCEEDED":
            setFormError(
              "Too many attempts. Please wait a minute before trying again.",
            );
            break;
          default:
            setFormError(err.message ?? "Failed to change password. Please try again.");
        }
      } else {
        setFormError("Failed to change password. Please try again.");
      }
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Change password" maxWidth="max-w-[480px]">
      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        noValidate
        className="mt-5 flex flex-col gap-4"
      >
        {/* Current password */}
        <Field id="cpw-current" label="Current password *" error={errors.currentPassword?.message}>
          <input
            type="password"
            className="input"
            autoComplete="current-password"
            placeholder="••••••••"
            {...register("currentPassword")}
          />
        </Field>

        {/* New password */}
        <div>
          <Field id="cpw-new" label="New password *" error={errors.newPassword?.message}>
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              placeholder="At least 10 characters"
              {...register("newPassword")}
            />
          </Field>
          <ul className="mt-1.5 list-none pl-0 text-xs text-slate space-y-0.5">
            <li>· At least 10 characters</li>
            <li>· Mix of letters, numbers, and a symbol</li>
          </ul>
        </div>

        {/* Confirm new password */}
        <Field id="cpw-confirm" label="Confirm new password *" error={errors.confirmPassword?.message}>
          <input
            type="password"
            className="input"
            autoComplete="new-password"
            placeholder="Repeat new password"
            {...register("confirmPassword")}
          />
        </Field>

        {/* Form-level error (rate limit, unexpected) */}
        {formError && (
          <div className="field-error show" role="alert">
            {formError}
          </div>
        )}

        {/* Footer buttons */}
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
            {isSubmitting ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
