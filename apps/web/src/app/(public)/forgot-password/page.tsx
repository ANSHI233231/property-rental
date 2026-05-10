"use client";

/**
 * Forgot-password page — 1:1 with prototype/forgot-password.html
 *
 * Two-step UI:
 *   Step 1: email/phone input → POST /auth/forgot-password (always 200, anti-enumeration)
 *   Step 2: generic confirmation screen (shown regardless of server response)
 */

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ForgotPasswordInputSchema, type ForgotPasswordInput } from "@gharsetu/shared";
import { Field } from "@/components/ui/Field";
import { rawFetch } from "@/lib/api/client";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordInputSchema),
    mode: "onBlur",
  });

  async function onSubmit(data: ForgotPasswordInput) {
    try {
      // Fire and forget — always show success (anti-enumeration per SRS §11.2)
      await rawFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: data.email }),
      });
    } catch {
      // Swallow — we show the same confirmation regardless
    }
    setSent(true);
  }

  function handleTryAgain() {
    setSent(false);
    reset();
  }

  if (sent) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <Link href="/" className="auth-brand">
            Ghar<span>Setu</span>
          </Link>
          <div className="auth-tagline">Check your inbox</div>

          <div className="text-center my-6">
            <div
              className="inline-flex items-center justify-center rounded-full"
              style={{ width: 72, height: 72, background: "#E8F5E9" }}
            >
              <svg
                viewBox="0 0 24 24"
                width="36"
                height="36"
                fill="none"
                stroke="#2E7D32"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                <path d="m22 6-10 7L2 6" />
              </svg>
            </div>
            <h3 className="mt-4">Reset link sent</h3>
            <p className="text-sm muted mt-2">
              If an account exists for that contact, a reset link has been sent.
              <br />
              It will expire in 30 minutes.
            </p>
          </div>

          <div className="rounded-lg p-4 text-sm mb-4 bg-light-gray">
            <div className="font-poppins font-semibold text-charcoal mb-1">
              Didn&rsquo;t get it?
            </div>
            <ul className="list-disc pl-5 space-y-1 muted">
              <li>Check your spam folder</li>
              <li>Make sure you typed the correct email or phone</li>
              <li>Wait a minute — delivery can be delayed</li>
            </ul>
          </div>

          <button
            type="button"
            className="btn btn-secondary w-full"
            onClick={handleTryAgain}
          >
            Try a different email / phone
          </button>

          <div className="mt-4 text-center text-sm">
            <Link href="/login" className="text-royal-blue font-poppins font-semibold">
              Back to login
            </Link>
          </div>
        </div>
      </main>
    );
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
        <div className="auth-tagline">Reset your password</div>

        <div className="mb-6 p-4 rounded-lg bg-bg-prepaid" style={{ color: "#075a8c" }}>
          <div className="font-poppins font-semibold text-sm mb-1">How this works</div>
          <p className="text-sm">
            Enter the email or phone you signed in with. If we find a matching
            account, we&rsquo;ll send a reset link valid for 30 minutes.
          </p>
        </div>

        <Field id="identifier" label="Email or Phone" error={errors.email?.message}>
          <input
            {...register("email")}
            className="input"
            type="text"
            placeholder="raj@gharsetu.in or 98xxxxxxxx"
            autoComplete="username"
          />
        </Field>
        <p className="text-xs muted mt-2">
          We&rsquo;ll send the reset link to the contact method on file.
        </p>

        <button
          type="submit"
          className="btn btn-primary w-full mt-6"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? "Sending…" : "Send reset link"}
        </button>

        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-royal-blue font-poppins font-semibold">
            ← Back to login
          </Link>
        </div>

        <hr className="divider mt-6" />
        <p className="text-xs muted text-center">
          Don&rsquo;t have an account? GharSetu doesn&rsquo;t have public
          sign-up. Ask your <strong>Admin</strong> or{" "}
          <strong>Property Manager</strong> to create one for you.
        </p>
      </form>
    </main>
  );
}
