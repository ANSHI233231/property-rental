"use client";

/**
 * Login page — 1:1 with prototype/login.html
 *
 * Validation contract (prototype/assets/validation.js):
 *   - noValidate on form (no native browser tooltips)
 *   - Errors rendered below field via <Field> wrapper (.field-error.show::before ⚠)
 *   - Error cleared on input (mode: onBlur), re-checked on blur
 *   - Submit button disabled + shows loading state while pending
 *
 * useSearchParams must be inside a Suspense boundary — isolated in LoginForm.
 */

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginInputSchema, type LoginInput } from "@gharsetu/shared";
import { useAuth, dashboardPathForRole } from "@/lib/auth/context";
import { Field } from "@/components/ui/Field";
import { ApiError } from "@/lib/api/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user, loading } = useAuth();

  // Redirect already-logged-in users
  useEffect(() => {
    if (!loading && user) {
      const next = searchParams.get("next") ?? dashboardPathForRole(user.role);
      router.replace(next);
    }
  }, [loading, user, router, searchParams]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    mode: "onBlur",
  });

  async function onSubmit(data: LoginInput) {
    try {
      await login(data.email, data.password);
      // login() sets user in context; the useEffect above handles redirect.
      // If a ?next= param exists, push there immediately.
      const nextParam = searchParams.get("next");
      if (nextParam) {
        router.replace(nextParam);
      }
      // Otherwise the useEffect fires once user state propagates.
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "An unexpected error occurred. Please try again.";
      setError("root", { message });
    }
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Link href="/" className="auth-brand">
        Ghar<span>Setu</span>
      </Link>
      <div className="auth-tagline">Property Rental Management</div>

      <div className="text-center mb-6">
        <Link href="/" className="text-royal-blue font-poppins font-semibold text-sm">
          ← Back to home
        </Link>
      </div>

      <Field id="email" label="Email or Phone" error={errors.email?.message}>
        <input
          {...register("email")}
          className="input"
          type="text"
          placeholder="raj@gharsetu.in or 98xxxxxxxx"
          autoComplete="username"
        />
      </Field>

      <div className="mt-4">
        <Field id="password" label="Password" error={errors.password?.message}>
          <input
            {...register("password")}
            className="input"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" />{" "}
          <span className="muted">Remember me</span>
        </label>
        <Link
          href="/forgot-password"
          className="text-royal-blue font-poppins font-semibold"
        >
          Forgot password?
        </Link>
      </div>

      {errors.root && (
        <div
          role="alert"
          className="mt-4 p-3 rounded bg-bg-overdue text-status-overdue text-sm flex items-start gap-1.5"
        >
          <span className="flex-shrink-0">⚠</span>
          {errors.root.message}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary w-full mt-6"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? "Signing in…" : "Login"}
      </button>

      <div className="mt-6 text-center text-xs muted">
        No public sign-up. Accounts are created by your Admin or Property
        Manager.
      </div>

      <hr className="divider mt-6" />
      <div className="text-xs muted text-center font-poppins font-semibold uppercase tracking-wider mb-3">
        Demo — jump to a role
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/admin/dashboard" className="btn btn-secondary auth-role-btn">
          Admin
        </Link>
        <Link href="/pm/dashboard" className="btn btn-secondary auth-role-btn">
          Property Manager
        </Link>
        <Link href="/maintenance/dashboard" className="btn btn-secondary auth-role-btn">
          Maintenance
        </Link>
        <Link href="/tenant/dashboard" className="btn btn-secondary auth-role-btn">
          Tenant
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <Suspense
        fallback={
          <div className="auth-card text-center text-slate font-poppins">
            Loading…
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
