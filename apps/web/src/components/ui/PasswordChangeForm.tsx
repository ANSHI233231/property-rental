"use client";

/**
 * PasswordChangeForm — Phase 6.
 * Shared across Tenant and Maintenance profile pages.
 *
 * Visual contract (validation.js):
 *   - No browser tooltips; errors below field with ⚠ glyph via .field-error.show
 *   - Error clears on input; re-validates on blur
 *   - aria-busy on submit button while submitting
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Field } from "@/components/ui/Field";
import { ChangePasswordInputSchema } from "@gharsetu/shared";
import { useState } from "react";

const FormSchema = ChangePasswordInputSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormValues = z.infer<typeof FormSchema>;

interface PasswordChangeFormProps {
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
}

export function PasswordChangeForm({ onSubmit }: PasswordChangeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
  });

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleFormSubmit(data: FormValues) {
    setSubmitError(null);
    setSuccess(false);
    try {
      await onSubmit(data.currentPassword, data.newPassword);
      setSuccess(true);
      reset();
    } catch (err) {
      if (err && typeof err === "object") {
        const e = err as { message?: string };
        setSubmitError(e.message ?? "Failed to change password. Please try again.");
      } else {
        setSubmitError("Failed to change password. Please try again.");
      }
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(handleFormSubmit)(e)} noValidate>
      <div className="mb-4">
        <Field id="cur-pw" label="Current password" error={errors.currentPassword?.message}>
          <input
            type="password"
            className="input"
            placeholder="••••••••"
            autoComplete="current-password"
            {...register("currentPassword")}
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Field id="new-pw" label="New password" error={errors.newPassword?.message}>
          <input
            type="password"
            className="input"
            placeholder="At least 10 characters"
            autoComplete="new-password"
            {...register("newPassword")}
          />
        </Field>
        <Field id="conf-pw" label="Confirm new" error={errors.confirmPassword?.message}>
          <input
            type="password"
            className="input"
            placeholder="Repeat new password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
        </Field>
      </div>

      {submitError && (
        <div className="field-error show mt-2 mb-3" role="alert">
          {submitError}
        </div>
      )}
      {success && (
        <div className="text-sm mb-3" style={{ color: "var(--color-status-paid)" }} role="status">
          Password changed successfully.
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary !py-2 !text-sm"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
