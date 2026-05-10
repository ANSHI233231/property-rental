"use client";

/**
 * Field — wraps a label + input + error message.
 *
 * Visual contract from prototype/assets/styles.css + validation.js:
 *   - Error renders BELOW the input (never as a tooltip)
 *   - Error prefixed with ⚠ glyph (via .field-error.show::before CSS)
 *   - Input gets .error class (red border + red background) when invalid
 *   - No `title` attribute or native browser validation messages
 */

import React from "react";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  children: React.ReactElement<{
    id: string;
    className: string;
    "aria-invalid"?: "true" | "false";
    "aria-describedby"?: string;
  }>;
}

export function Field({ id, label, error, children }: FieldProps) {
  const errorId = `${id}-error`;
  const hasError = Boolean(error);

  const child = React.cloneElement(children, {
    id,
    className: [children.props.className ?? "input", hasError ? "error" : ""].join(" ").trim(),
    "aria-invalid": hasError ? ("true" as const) : ("false" as const),
    "aria-describedby": hasError ? errorId : undefined,
  });

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {child}
      <div
        id={errorId}
        role="alert"
        className={`field-error${hasError ? " show" : ""}`}
      >
        {error}
      </div>
    </div>
  );
}
