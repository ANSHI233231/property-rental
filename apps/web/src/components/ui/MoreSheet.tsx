"use client";

/**
 * MoreSheet — overflow nav surface for the mobile bottom tab bar.
 *
 * The bottom tab bar has a hard limit of 5 slots (design rule), but Admin
 * has 8 nav items and PM has 7. Slot 5 is rendered as a "More" tile that
 * opens this sheet — a bottom-anchored panel listing the overflow nav
 * items and an explicit Logout action.
 *
 * Per AGENTS.md and the phase6 source-level check
 * (apps/web/src/__tests__/phase6.test.ts), this component avoids every
 * forbidden token (the hamburger glyph, the lucide / shadcn menu-icon
 * components, and aria-label strings containing "open menu" / "toggle menu"
 * / "hamburger"). The trigger uses three horizontal dots + an aria-label of
 * "More options".
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export interface MoreItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  items: MoreItem[];
  /** Same logout handler used by the desktop sidebar footer. */
  onLogout: () => void;
  /** ARIA label for the sheet container — required for screen readers. */
  title?: string;
}

export function MoreSheet({ open, onClose, items, onLogout, title = "More options" }: MoreSheetProps) {
  const pathname = usePathname();
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <div
        className={`more-sheet-backdrop${open ? " open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className={`more-sheet${open ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="more-sheet-handle" aria-hidden="true" />
        <div className="more-sheet-title">{title}</div>

        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={`more-sheet-link${isActive(item.href) ? " active" : ""}`}
            aria-current={isActive(item.href) ? "page" : undefined}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}

        <button
          type="button"
          className="more-sheet-link"
          onClick={() => { onClose(); onLogout(); }}
        >
          {/* Sign-out icon — door + arrow. Same family as the sidebar SVGs. */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Logout
        </button>
      </div>
    </>
  );
}

/**
 * Three-dot "More" tile — used as the 5th item in the bottom tab bar.
 * Caller wires the onClick to open the MoreSheet.
 */
export function MoreTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}
