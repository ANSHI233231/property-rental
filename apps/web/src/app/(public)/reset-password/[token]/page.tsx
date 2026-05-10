"use client";

/**
 * Reset-password page.
 * Token comes from URL path: /reset-password/<token>
 *
 * On success → redirect to /login with a flash message.
 * Validates newPassword + confirmPassword client-side (confirm is FE-only).
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ResetPasswordInputSchema } from "@gharsetu/shared";
import { Field } from "@/components/ui/Field";
import { rawFetch, ApiError } from "@/lib/api/client";

/** Extend the shared schema with a confirmPassword field (FE-only). */
const ResetFormSchema = ResetPasswordInputSchema.omit({ token: true }).extend({
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
});

type ResetForm = z.infer<typeof ResetFormSchema>;

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ResetForm>({
    resolver: zodResolver(ResetFormSchema),
    mode: "onBlur",
  });

  async function onSubmit(data: ResetForm) {
    try {
      const res = await rawFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: data.newPassword }),
      });

      if (!res.ok) {
        let message = "Reset link is invalid or has expired.";
        try {
          const body = await res.json();
          if (body?.error?.message) message = body.error.message as string;
        } catch { /* ignore */ }
        throw new ApiError(res.status, "RESET_FAILED", message);
      }

      // Redirect to login with flash via search param
      router.replace("/login?flash=password-reset");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "An unexpected error occurred. Please try again.";
      setError("root", { message });
    }
  }

  return (
    <main className="auth-shell">
      <form
        className="auth-card"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <Link href="/" className="auth-brand">
          Ghar<span>Setu</span>
        </Link>
        <div className="auth-tagline">Set a new password</div>

        {isSubmitSuccessful && (
          <div
            role="status"
            className="mb-4 p-3 rounded bg-bg-paid text-status-paid text-sm"
          >
            Password reset successfully. Redirecting to login…
          </div>
        )}

        {errors.root && (
          <div
            role="alert"
            className="mb-4 p-3 rounded bg-bg-overdue text-status-overdue text-sm flex items-start gap-1.5"
          >
            <span className="flex-shrink-0">⚠</span>
            {errors.root.message}
          </div>
        )}

        <Field id="newPassword" label="New Password" error={errors.newPassword?.message}>
          <input
            {...register("newPassword")}
            className="input"
            type="password"
            placeholder="••••••••••"
            autoComplete="new-password"
          />
        </Field>

        <p className="text-xs muted mt-1">
          At least 10 characters, one letter and one number.
        </p>

        <div className="mt-4">
          <Field
            id="confirmPassword"
            label="Confirm Password"
            error={errors.confirmPassword?.message}
          >
            <input
              {...register("confirmPassword")}
              className="input"
              type="password"
              placeholder="••••••••••"
              autoComplete="new-password"
            />
          </Field>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full mt-6"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? "Resetting…" : "Reset password"}
        </button>

        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-royal-blue font-poppins font-semibold">
            ← Back to login
          </Link>
        </div>
      </form>
    </main>
  );
}
