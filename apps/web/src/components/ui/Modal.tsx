"use client";

/**
 * Modal — accessible dialog with focus trap + Esc to close.
 * Matches prototype/.../assets/styles.css .modal-backdrop + .modal styles.
 *
 * aria-modal="true" — screen readers treat content outside as inert.
 * Focus is trapped inside while open; returns to trigger on close.
 */

import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// Focus trap helper
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
}

// ---------------------------------------------------------------------------
// Modal component
// ---------------------------------------------------------------------------

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Max width class — default "max-w-[480px]". */
  maxWidth?: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, maxWidth = "max-w-[480px]", children }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store trigger element to restore focus on close
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus first element in modal after paint
      requestAnimationFrame(() => {
        const first = getFocusable(modalRef.current!)[0];
        first?.focus();
      });
    } else {
      previousFocusRef.current?.focus();
    }
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Tab trapping
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable(modalRef.current!);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    },
    [],
  );

  if (!open) return null;

  const titleId = "modal-title";

  const content = (
    <div
      ref={backdropRef}
      className="modal-backdrop open"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`modal ${maxWidth} w-full`}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 id={titleId} className="font-poppins font-semibold text-charcoal text-[20px] m-0">
            {title}
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-slate hover:text-charcoal transition-colors focus-visible:outline-saffron rounded"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : null;
}
