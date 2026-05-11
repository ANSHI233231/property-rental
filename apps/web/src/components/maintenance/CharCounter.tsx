"use client";

/**
 * CharCounter — live character count indicator.
 *
 * Visual contract from prototype/tenant/maintenance.html:
 *   - Renders "<current>/<min> minimum"
 *   - Red (.counter.error) when current < min
 *   - Neutral (.counter) when current >= min
 *
 * Matches prototype .counter class from styles.css.
 */

interface CharCounterProps {
  current: number;
  min: number;
}

export function CharCounter({ current, min }: CharCounterProps) {
  const isError = current < min;
  return (
    <div
      className={`counter${isError ? " error" : ""}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {current}/{min} minimum
    </div>
  );
}
