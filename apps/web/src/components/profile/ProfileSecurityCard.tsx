"use client";

/**
 * ProfileSecurityCard — shared across all 4 role profile pages.
 *
 * Buttons:
 *   1. "Change password" — opens ChangePasswordModal
 *   2. "Sign out" — calls auth.logout() → navigates to /login
 *
 * The "Sign out everywhere" button was intentionally removed: no
 * /auth/logout-all endpoint exists yet, so we don't render a placeholder.
 *
 * Password change success:
 *   Fires a toast "Password updated — you'll be signed out for security."
 *   (the BE revokes all refresh tokens on change, so the next API call will
 *    trigger the 401 → redirect to /login flow automatically.)
 */

import { useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/Toast";
import { ChangePasswordModal } from "./ChangePasswordModal";

export function ProfileSecurityCard() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      setSigningOut(false);
    }
  }

  function handlePasswordChangeSuccess() {
    toast(
      "Password updated — you'll be signed out for security.",
      "success",
    );
  }

  return (
    <>
      <section className="profile-card" aria-labelledby="security-card-heading">
        <h3
          id="security-card-heading"
          className="font-poppins font-semibold text-charcoal text-[18px] mb-5"
        >
          Security
        </h3>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="btn btn-secondary w-full"
            onClick={() => setModalOpen(true)}
            aria-label="Change your account password"
          >
            Change password
          </button>

          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            aria-busy={signingOut}
            aria-label="Sign out of your account"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </section>

      <ChangePasswordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handlePasswordChangeSuccess}
      />
    </>
  );
}
