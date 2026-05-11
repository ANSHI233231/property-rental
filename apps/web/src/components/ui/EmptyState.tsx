"use client";

/**
 * EmptyState — shown when a list/table has no rows.
 * Every list view must have an explicit "Nothing here yet" state.
 */

interface EmptyStateProps {
  heading: string;
  body?: string;
  cta?: React.ReactNode;
}

export function EmptyState({ heading, body, cta }: EmptyStateProps) {
  return (
    <div role="status" className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <svg
        className="w-12 h-12 text-mid-gray mb-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
      <h3 className="font-poppins font-semibold text-charcoal text-base mb-1">
        {heading}
      </h3>
      {body && <p className="text-slate text-sm mb-4">{body}</p>}
      {cta}
    </div>
  );
}
