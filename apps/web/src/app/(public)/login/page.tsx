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
