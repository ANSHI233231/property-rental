"use client";

/**
 * Toast — lightweight success/failure notification.
 * Persists for ~4 s then auto-dismisses.
 * Usage: wrap at admin/pm layout level with <ToastProvider>.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = Math.random().toString(36).slice(2);
      setItems((prev) => [...prev, { id, message, variant }]);
      const t = setTimeout(() => dismiss(id), 4000);
      timers.current.set(id, t);
    },
    [dismiss],
  );

  // Clean up timers on unmount
  useEffect(() => {
    const timerMap = timers.current;
    return () => {
      timerMap.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container — fixed bottom-right on desktop, bottom-center on mobile */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 max-w-sm w-full pointer-events-none"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Individual toast card
// ---------------------------------------------------------------------------

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const variantStyles: Record<ToastVariant, string> = {
    success:
      "bg-bg-paid border-l-4 border-status-paid text-status-paid",
    error:
      "bg-bg-overdue border-l-4 border-status-overdue text-status-overdue",
    info: "bg-bg-prepaid border-l-4 border-status-prepaid text-status-prepaid",
  };

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-card px-4 py-3 shadow-md ${variantStyles[item.variant]}`}
    >
      <span className="flex-1 font-inter text-sm leading-snug">{item.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        className="flex-shrink-0 opacity-60 hover:opacity-100 focus-visible:outline-saffron"
        onClick={() => onDismiss(item.id)}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
