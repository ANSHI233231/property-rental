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

// ---------------------------------------------------------------------------
// Eye-toggle button (matches /login). Independent reveal per field.
// ---------------------------------------------------------------------------

function PasswordToggle({
  show,
  onToggle,
}: {
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? "Hide password" : "Show password"}
      aria-pressed={show}
      tabIndex={-1}
      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-charcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-blue rounded"
    >
      {show ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

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
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              className="input pr-10"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("currentPassword")}
            />
            <PasswordToggle show={showCurrent} onToggle={() => setShowCurrent((v) => !v)} />
          </div>
        </Field>

        {/* New password */}
        <div>
          <Field id="cpw-new" label="New password *" error={errors.newPassword?.message}>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                className="input pr-10"
                autoComplete="new-password"
                placeholder="At least 10 characters"
                {...register("newPassword")}
              />
              <PasswordToggle show={showNew} onToggle={() => setShowNew((v) => !v)} />
            </div>
          </Field>
          <ul className="mt-1.5 list-none pl-0 text-xs text-slate space-y-0.5">
            <li>· At least 10 characters</li>
            <li>· Mix of letters, numbers, and a symbol</li>
          </ul>
        </div>

        {/* Confirm new password */}
        <Field id="cpw-confirm" label="Confirm new password *" error={errors.confirmPassword?.message}>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              className="input pr-10"
              autoComplete="new-password"
              placeholder="Repeat new password"
              {...register("confirmPassword")}
            />
            <PasswordToggle show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
          </div>
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
