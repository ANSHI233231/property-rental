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
 * BUG-002 fix: useSearchParams() is isolated in <SearchParamsReader> which is
 * wrapped in its own Suspense with a null fallback. The outer <form class="auth-card">
 * renders eagerly on the server so `form.auth-card` is always in the SSR HTML.
 */

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginInputSchema, type LoginInput } from "@gharsetu/shared";
import { useAuth, dashboardPathForRole } from "@/lib/auth/context";
import { Field } from "@/components/ui/Field";
import { ApiError } from "@/lib/api/client";

/**
 * Tiny component that owns useSearchParams() — must live inside a Suspense boundary.
 * Reports the `next` search param to the parent via a callback.
 */
function SearchParamsReader({ onNext }: { onNext: (next: string | null) => void }) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  useEffect(() => {
    onNext(next);
  }, [next, onNext]);

  return null;
}

function LoginForm() {
  const router = useRouter();
  const { login, user, loading } = useAuth();
  const [nextParam, setNextParam] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect already-logged-in users
  useEffect(() => {
    if (!loading && user) {
      const dest = nextParam ?? dashboardPathForRole(user.role);
      router.replace(dest);
    }
  }, [loading, user, router, nextParam]);

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
    <>
      {/* SearchParamsReader is isolated in Suspense so the form renders eagerly on the server */}
      <Suspense fallback={null}>
        <SearchParamsReader onNext={setNextParam} />
      </Suspense>

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
            <div className="relative">
              <input
                {...register("password")}
                className="input pr-10"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-charcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-blue rounded"
              >
                {showPassword ? (
                  // eye-off icon
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  // eye icon
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
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
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <LoginForm />
    </main>
  );
}
